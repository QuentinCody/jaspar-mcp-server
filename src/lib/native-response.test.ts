import { afterEach, expect, it, vi } from "vitest";
import { createJasparApiFetch } from "./api-adapter";
import { readText } from "./response";

const api = createJasparApiFetch();
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("negotiates native matrix text formats without forcing an incompatible JSON Accept header", async () => {
  const text = ">MA1104.2\tGATA6\nA [ 01 2.00 ]\n";
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(text, { headers: { "content-type": "text/jaspar" } }));
  vi.stubGlobal("fetch", fetcher);
  expect(await api({ method: "GET", path: "/matrix/MA1104.2/", params: { format: "jaspar" } })).toEqual({ status: 200, data: text });
  expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Accept")).toBe("*/*");
});

it.each([
  ["/matrix/MA1104.2/", { matrix_id: "MA1104.1" }],
  ["/dl/summary/DL0001.1/", { profile_summary: { base_id: "DL0001", version: "2" } }],
  ["/dl/model/BP000273.1/", { model: { base_id: "BP000274", version: "1" } }],
])("retains native evidence when a versioned detail silently substitutes another identifier: %s", async (path, raw) => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(raw)));
  await expect(api({ method: "GET", path })).rejects.toMatchObject({ status: 409, data: { resource: raw, response: JSON.stringify(raw) } });
});

it("preserves complete bounded error text and malformed JSON evidence", async () => {
  const text = "unavailable α".repeat(5000);
  vi.stubGlobal("fetch", vi.fn(async () => new Response(text, { status: 404 })));
  await expect(api({ method: "GET", path: "/matrix/MA999999.1/" })).rejects.toMatchObject({ status: 404, data: { response: text } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response('{"results":', { headers: { "content-type": "application/json" } })));
  await expect(api({ method: "GET", path: "/matrix/" })).rejects.toMatchObject({ status: 502, data: { response: '{"results":' } });
});

it("rejects Content-Range even with HTTP 200 and bounds stalled cancellation", async () => {
  await expect(readText(new Response('{}', { headers: { "content-range": "bytes 0-1/9" } }))).rejects.toMatchObject({ status: 502 });
  vi.useFakeTimers();
  const cancel = vi.fn(() => new Promise<void>(() => {}));
  const response = new Response(new ReadableStream({ pull: () => new Promise<void>(() => {}), cancel }));
  const check = expect(readText(response)).rejects.toMatchObject({ status: 504 });
  await vi.advanceTimersByTimeAsync(15001); await check;
  expect(cancel).toHaveBeenCalledOnce(); expect(response.body?.locked).toBe(false);
});

it("rejects bodies over the bound and invalid UTF-8", async () => {
  await expect(readText(new Response("a".repeat(2 * 1024 * 1024 + 1)))).rejects.toMatchObject({ status: 502 });
  await expect(readText(new Response(new Uint8Array([0xff])))).rejects.toThrow();
});

it("does not silently discard a GET body", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await expect(api({ method: "GET", path: "/matrix/", body: { release: 2026 } })).rejects.toMatchObject({ status: 405 });
  expect(fetcher).not.toHaveBeenCalled();
});
