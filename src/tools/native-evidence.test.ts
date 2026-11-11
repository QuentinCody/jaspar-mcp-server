import { verifyCitationEnvelope } from "@bio-mcp/shared";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({ RpcTarget: class {}, DurableObject: class { constructor(public ctx: unknown, public env: unknown) {} } }));

import { fixture, recover } from "./staging-fixture";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function invoke(f: ReturnType<typeof fixture>, name: string, args: Record<string, unknown>, failed = false) {
  const result = await f.tools[name].handler(args, {});
  expect(result.isError === true, JSON.stringify(result).slice(0, 500)).toBe(failed);
  expect(result.content.length).toBeGreaterThan(0);
  const sc = result.structuredContent;
  const id = sc.staged ? sc.data_access_id : sc.data?.__staged ? sc.data.data_access_id : undefined;
  const staged = id ? await recover(f, id, "") : undefined;
  const proof = await verifyCitationEnvelope({ citation: sc._meta?.citation, structuredContent: sc, toolArguments: args,
    ...(staged ? { materialized: { value: staged } } : {}) });
  expect(proof.verification).toMatchObject({ query: "verified", result: "verified" });
  expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThanOrEqual(30720);
  return { sc, id, data: sc.staged ? staged.structuredContent.data : sc.data?.__staged ? staged : sc.data };
}

it.each(["", "mcp_"])("verifies every %s alias including canonical SQL arguments and errors", async prefix => {
  const f = fixture();
  try {
    await invoke(f, `${prefix}jaspar_search`, { query: "2026" });
    await invoke(f, `${prefix}jaspar_execute`, { code: "return {value:'001'};" });
    await invoke(f, `${prefix}jaspar_execute`, { code: "" }, true);
    await invoke(f, `${prefix}jaspar_query_data`, { data_access_id: "missing", sql: "SELECT * FROM missing" }, true);
    await invoke(f, `${prefix}jaspar_get_schema`, { data_access_id: "missing" });
  } finally { f.close(); }
});

it("recovers full nested profiles and their native paging context through SQL", async () => {
  const f = fixture();
  const profile = { base_id: "DL0001", version: "1", primary_motif_id: "001", tf: { species: "Homo sapiens", tax_group: "vertebrates" },
    pfm: { A: [0, 20] }, cwm: { A: [-0.01, 0] }, logos: ["α😀".repeat(7000)] };
  const raw = { count: 240, next: "https://jaspar.elixir.no/api/v1/dl/?page=2", results: { version: "latest", id_type: "summary", results: [profile] } };
  vi.stubGlobal("fetch", async () => Response.json(raw));
  try {
    const result = await invoke(f, "jaspar_execute", { code: 'return await api.get("/dl/", {page_size:1});' });
    expect(result.id).toBeTruthy(); expect(result.data.results).toEqual([profile]);
    expect(result.sc._meta.citation.record_count).toBe(1);
    const rows = await invoke(f, "mcp_jaspar_query_data", { data_access_id: result.id, sql: "SELECT cwm,pfm,primary_motif_id,typeof(primary_motif_id) AS kind FROM profiles" });
    expect(rows.data.rows[0]).toEqual({ cwm: JSON.stringify(profile.cwm), pfm: JSON.stringify(profile.pfm), primary_motif_id: "001", kind: "text" });
    const context = await invoke(f, "jaspar_query_data", { data_access_id: result.id, sql: "SELECT native_json FROM response_context" });
    expect(JSON.parse(context.data.rows[0].native_json)).toEqual({ count: 240, next: raw.next, profile_listing: { version: "latest", id_type: "summary" } });
  } finally { f.close(); }
});

it("retains signed motifs, source context and original release count strings in composed staging", async () => {
  const f = fixture();
  const data = { model: { base_id: "BP000273", version: "1", species: "Homo sapiens", cell_line: "HepG2", source_id: "ENCSR267TGY", pfm: { A: [0, 20] }, cwm: { A: [-0.2, 0] } },
    other_motifs: [{ source_id: "001", cwm: { G: [-0.5] }, pfm: { G: [25] } }], other_models: { count: 2, next: "?page=2", results: [{ base_id: "BP000274", version: "2" }] },
    notes: "α😀".repeat(7000), matrix: { matrix_id: "MA1104.2", raw_jaspar: ">MA1104.2 GATA6\nA [ 01 2.00 ]\n", pfm: { A: ["01", "2.00"] } }, artifact: { release: "2026", sha256: "fixture" } };
  try {
    const result = await invoke(f, "jaspar_execute", { code: `return ${JSON.stringify(data)};` });
    expect(result.sc.staged).toBe(true); expect(result.data).toEqual(data);
    const models = await invoke(f, "jaspar_query_data", { data_access_id: result.id, sql: "SELECT native_json FROM models" });
    expect(JSON.parse(models.data.rows[0].native_json)).toEqual(data.model);
    const motifs = await invoke(f, "jaspar_query_data", { data_access_id: result.id, sql: "SELECT native_json FROM other_motifs" });
    expect(JSON.parse(motifs.data.rows[0].native_json)).toEqual(data.other_motifs[0]);
    const matrix = await invoke(f, "jaspar_query_data", { data_access_id: result.id, sql: "SELECT raw_jaspar,pfm FROM release_matrix" });
    expect(matrix.data.rows[0]).toEqual({ raw_jaspar: data.matrix.raw_jaspar, pfm: JSON.stringify(data.matrix.pfm) });
  } finally { f.close(); }
});

it("recovers the complete native error through failure and SQL staging", async () => {
  const f = fixture(); const text = "unavailable α".repeat(7000);
  vi.stubGlobal("fetch", async () => new Response(text, { status: 404 }));
  try {
    const result = await invoke(f, "jaspar_execute", { code: 'return await api.get("/matrix/MA999999.1/");' }, true);
    expect(result.data).toMatchObject({ __api_error: true, status: 404 });
    const evidence = result.data.data.__staged ? await recover(f, result.data.data.data_access_id, "") : result.data.data;
    expect(evidence.response).toBe(text);
  } finally { f.close(); }
});
