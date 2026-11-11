import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";

export const releaseFileEndpoint: ApiEndpoint = {
  method: "GET", path: "/release-files/2026/CORE/{matrix_id}", category: "release-files", featured: true,
  summary: "Read an exact matrix version from the 2026 non-redundant CORE JASPAR artifact with its complete-file SHA-256. Local adapter route, not an upstream REST endpoint.",
  pathParams: [{ name: "matrix_id", type: "string", required: true, description: "Exact versioned CORE matrix ID, e.g. MA1104.3; no latest-version fallback" }],
  queryParams: [{ name: "expected_sha256", type: "string", required: false, description: "Optional 64-digit hex SHA-256 from a previous read. Reject changed bytes instead of returning a matrix." }],
  responseShape: "{requested_matrix_id, found, matrix: {matrix_id, name, width, pfm: {A,C,G,T}, raw_jaspar} | null, artifact: {release, collection, subset, format, url, sha256, hash_scope, bytes, retrieved_at}, interpretation}",
  usageHint: "Reads only the official 2026 CORE non-redundant file, with an 8 MiB / 30-second limit. PFM values are strings preserving count spelling. found:false means this exact ID is absent from this artifact; it does not trigger current REST lookup. Return the artifact metadata with the matrix. No taxon/species/experiment metadata is invented. Large results retain the normal Code Mode staging handle.",
};

export const releaseFileWorkflow: WorkflowRecipe = {
  title: "Read a 2026 CORE matrix with its release-file checksum",
  description: "Select exact version MA1104.3 from the official 2026 CORE non-redundant artifact. Retain the full response or staging handle. Repeat with expected_sha256 from artifact.sha256 to detect source-file drift.",
  keywords: ["2026", "CORE", "release", "snapshot", "checksum", "SHA256", "PFM", "GATA6"],
  code: 'return await api.get("/release-files/2026/CORE/{matrix_id}", {matrix_id:"MA1104.3"});',
};
