import { selectReleaseMatrix } from "./release-matrix";

export const CORE_2026_URL = "https://jaspar.elixir.no/download/data/2026/CORE/JASPAR2026_CORE_non-redundant_pfms_jaspar.txt";
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 30000;

/** One fixed provider artifact; limits apply to decoded bytes and the entire read. */
async function readReleaseFile(): Promise<Uint8Array> {
  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("JASPAR release file exceeded the 30-second deadline"));
    }, TIMEOUT_MS);
  });
  try {
    const response = await Promise.race([fetch(CORE_2026_URL, { redirect: "manual", signal: controller.signal, headers: { Accept: "text/plain" } }), deadline]);
    if (response.status !== 200 || response.headers.has("content-range")) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error(`JASPAR release file HTTP ${response.status}; a complete file without Content-Range is required`);
    }
    if (Number(response.headers.get("content-length")) > MAX_BYTES) {
      void response.body?.cancel().catch(() => undefined);
      throw new Error("JASPAR release file exceeds 8 MiB");
    }
    if (!response.body) throw new Error("Empty JASPAR release file");
    reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > MAX_BYTES) throw new Error("JASPAR release file exceeds 8 MiB");
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally {
    clearTimeout(timer);
    controller.abort();
    if (reader) { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  }
}

/** Local Code Mode route, deliberately separate from the current-data REST API. */
export async function getReleaseMatrix(path: string, input: Record<string, unknown> = {}) {
  const match = path.split("?")[0].match(/^\/release-files\/2026\/CORE\/(MA\d+\.[1-9]\d*)\/?$/);
  if (!match) throw new Error("Use /release-files/2026/CORE/{matrix_id} with an exact versioned CORE ID (e.g. MA1104.2)");
  const params: Record<string, unknown> = { ...input };
  for (const [key, value] of new URL(path, "https://jaspar.elixir.no").searchParams) {
    if (Object.keys(params).includes(key)) throw new Error(`Duplicate release-file parameter ${key}`);
    params[key] = value;
  }
  if (Object.keys(params).some(key => key !== "expected_sha256")) throw new Error("Release-file lookup accepts only expected_sha256; it does not apply REST filters");
  const expected = params.expected_sha256;
  if (expected !== undefined && (typeof expected !== "string" || !/^[a-fA-F0-9]{64}$/.test(expected))) throw new Error("expected_sha256 must be a 64-character hexadecimal SHA-256");
  const bytes = await readReleaseFile();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (typeof expected === "string" && sha256 !== expected.toLowerCase()) throw new Error("JASPAR release file checksum mismatch; no matrix returned");
  const matrix = selectReleaseMatrix(new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes), match[1]);
  return {
    requested_matrix_id: match[1], found: matrix !== null, matrix,
    artifact: { release: "2026", collection: "CORE", subset: "non-redundant", format: "jaspar", url: CORE_2026_URL,
      sha256, hash_scope: "complete decoded HTTP response bytes", bytes: bytes.byteLength, retrieved_at: new Date().toISOString() },
    interpretation: "Exact version lookup within this release artifact only. Missing records do not establish biological absence. PFM count strings preserve source spelling; this file does not provide the full REST metadata record.",
  };
}
