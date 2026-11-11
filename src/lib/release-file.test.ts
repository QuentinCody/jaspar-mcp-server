import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { afterEach, expect, it, vi } from "vitest";
import { jasparCatalog } from "../spec/catalog";
import { releaseFileWorkflow } from "../spec/release-file";
import { createJasparApiFetch } from "./api-adapter";
import { CORE_2026_URL } from "./release-file";

// Synthetic records using the provider's documented labeled JASPAR format.
const older = ">MA1104.1 GATA6\r\nA [ 01 2.00 ]\r\nC [ 0 3 ]\r\nG [ 4 5 ]\r\nT [ 6 7 ]\r\n";
const selected = older.replace("MA1104.1", "MA1104.3").replace("01 2.00", "1e1 .50");
const file = older + selected;
const hash = createHash("sha256").update(file).digest("hex");
const path = "/release-files/2026/CORE/MA1104.3";
const adapter = createJasparApiFetch();
const read = (params: Record<string, unknown> = {}, route = path) => adapter({ method: "GET", path: route, params });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("runs the discoverable recipe through the real proxy and preserves exact version, count spelling and complete-file hash", async () => {
  const fetch = vi.fn(async () => new Response(file));
  vi.stubGlobal("fetch", fetch);
  const proxy = createApiProxyTool({ catalog: jasparCatalog, apiFetch: adapter, doNamespace: {} as DurableObjectNamespace, stagingPrefix: "jaspar" });
  const api = { get: (path: string, params: Record<string, unknown>) => proxy.handler({ method: "GET", path, params }, {} as Parameters<typeof proxy.handler>[1]) };
  const result = await runInNewContext(`(async()=>{${releaseFileWorkflow.code}})()`, { api });
  expect(result).toMatchObject({ found: true, requested_matrix_id: "MA1104.3", matrix: { matrix_id: "MA1104.3", name: "GATA6", width: 2, raw_jaspar: selected, pfm: { A: ["1e1", ".50"], C: ["0", "3"] } },
    artifact: { release: "2026", collection: "CORE", subset: "non-redundant", url: CORE_2026_URL, sha256: hash, bytes: Buffer.byteLength(file), retrieved_at: expect.any(String) } });
  expect(fetch).toHaveBeenCalledExactlyOnceWith(CORE_2026_URL, expect.objectContaining({ redirect: "manual", headers: { Accept: "text/plain" } }));
  expect(jasparCatalog.endpointCount).toBe(jasparCatalog.endpoints.length);
  expect(jasparCatalog.workflows).toContain(releaseFileWorkflow);
});

it("accepts a recorded checksum in params or the query string and rejects changed file bytes", async () => {
  const fetch = vi.fn(async () => new Response(file)); vi.stubGlobal("fetch", fetch);
  expect(await read({ expected_sha256: hash.toUpperCase() })).toMatchObject({ data: { found: true } });
  expect(await read({}, `${path}?expected_sha256=${hash}`)).toMatchObject({ data: { found: true } });
  fetch.mockImplementation(async () => new Response(`${file}\n`));
  await expect(read({ expected_sha256: hash })).rejects.toThrow("checksum mismatch");
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("reports exact-version absence within the artifact without substituting a REST record", async () => {
  const fetch = vi.fn(async () => new Response(older)); vi.stubGlobal("fetch", fetch);
  expect(await read()).toMatchObject({ data: { found: false, matrix: null, requested_matrix_id: "MA1104.3", artifact: { sha256: createHash("sha256").update(older).digest("hex") } } });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  ["/release-files/2024/CORE/MA1104.3", {}], ["/release-files/2026/CORE/MA1104", {}],
  ["/release-files/2026/CORE/UN1104.2", {}], [path, { expected_sha256: "bad" }],
  [path, { release: "2022" }], [path, { url: "https://example.com" }], [path, { tax_group: "vertebrates" }],
])("rejects unsupported release/file selection before fetching: %s %j", async (route, params) => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(read(params, route)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});

it.each([404, 503, 206, 302, 307])("rejects unavailable, redirected or partial artifact HTTP %i without REST fallback", async status => {
  const fetch = vi.fn(async () => new Response(file, { status })); vi.stubGlobal("fetch", fetch);
  await expect(read()).rejects.toThrow(`HTTP ${status}`); expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  "", "<html>Unavailable</html>", selected + selected,
  selected.replace("C [", "A ["), selected.replace("C [ 0 3 ]", "C [ 0 ]"),
  selected.replace("C [ 0 3 ]", "C [ ]"), selected.replace("C [ 0 3 ]", "C [ -1 3 ]"),
  selected.replace("C [ 0 3 ]", "C [ NaN 3 ]"), selected.replace("C [ 0 3 ]", "C [ 1e999 3 ]"),
  `${file}>malformed tail\n`, selected.replace("T [ 6 7 ]\r\n", ""),
])("rejects malformed files instead of returning a matrix or claiming absence (%#)", async content => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(content)));
  await expect(read()).rejects.toThrow();
});

it("rejects invalid UTF-8 rather than hashing one record and returning replacement characters", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array([0xff]))));
  await expect(read()).rejects.toThrow();
});

it.each([true, false])("bounds the complete read with content-length present=%s", async withLength => {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(8 * 1024 * 1024 + 1)); }, cancel });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { headers: withLength ? { "content-length": String(8 * 1024 * 1024 + 1) } : {} })));
  await expect(read()).rejects.toThrow("exceeds 8 MiB"); expect(cancel).toHaveBeenCalled();
});

it("applies one deadline across headers and a stalled body, cancelling the read", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  let signal: AbortSignal | undefined;
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    signal = init.signal;
    await new Promise(resolve => setTimeout(resolve, 20000));
    return new Response(new ReadableStream({ cancel }));
  }));
  const pending = expect(read()).rejects.toThrow("30-second deadline");
  await vi.advanceTimersByTimeAsync(30000); await pending;
  expect(signal?.aborted).toBe(true); expect(cancel).toHaveBeenCalled();
});

it("bounds a stalled header fetch even when it ignores the abort signal", async () => {
  vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
  const pending = expect(read()).rejects.toThrow("30-second deadline");
  await vi.advanceTimersByTimeAsync(30000); await pending;
});

it("rejects partial HTTP 200 artifacts even when the bytes form valid complete records", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(file, { headers: { "content-range": `bytes 0-${file.length - 1}/${file.length + 100}` } })));
  await expect(read()).rejects.toThrow("complete file without Content-Range");
});

it("rejects duplicate artifact checksum pins before reading", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(read({ expected_sha256: hash }, `${path}?expected_sha256=${hash}`)).rejects.toThrow("Duplicate");
  await expect(read({}, `${path}?expected_sha256=${hash}&expected_sha256=${hash}`)).rejects.toThrow("Duplicate");
  expect(fetch).not.toHaveBeenCalled();
});
