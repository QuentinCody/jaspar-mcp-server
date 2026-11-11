import type { ApiEndpoint, WorkflowRecipe } from "@bio-mcp/shared/codemode/catalog";

export const deepLearningEndpoints: ApiEndpoint[] = [
  {
    method: "GET", path: "/dl/", category: "deep-learning", featured: true,
    summary: "Discover deep-learning TF profile summaries with versioned IDs and links to JASPAR matrices.",
    queryParams: [
      {name: "page", type: "number", required: false, description: "One-based page number"},
      {name: "page_size", type: "number", required: false, description: "Profiles per page; use small pages to inspect complete metadata"},
    ],
    responseShape: "{count, next, previous, profile_listing: {version, id_type}, results: [{base_id, version, tf_name, tf, primary_motif, jaspar_ref, logos}]}",
    usageHint: "The adapter normalizes upstream results.results to results and retains listing metadata in profile_listing for accurate staging. api.getAll needs itemsField:'results', strategy:'page', pageSizeParam:'page_size'. name/search filters are ignored upstream and rejected here. Inspect returned TF/species fields; retain disagreements rather than inferring species from tax_group.",
    example: 'return await api.get("/dl/", {page: 1, page_size: 2});',
  },
  {
    method: "GET", path: "/dl/summary/{profile_id}/", category: "deep-learning",
    summary: "Inspect a versioned DL profile, its motifs, species, UniProt links and paginated model metadata.",
    pathParams: [{name: "profile_id", type: "string", required: true, description: "Versioned profile ID, e.g. DL0001.1; unversioned IDs fail upstream"}],
    usageHint: "Keep profile_summary, motifs and models together. PFM counts differ from signed contribution-weight matrices (CWM). models is a separate paginated envelope; do not assume its first page lists every model.",
    example: 'return await api.get("/dl/summary/{profile_id}/", {profile_id: "DL0001.1"});',
  },
  {
    method: "GET", path: "/dl/model/{model_id}/", category: "deep-learning", featured: true,
    summary: "Retrieve versioned BPNet model metadata, cell line, source experiment, interpreted motifs and external HDF5 download URLs.",
    pathParams: [{name: "model_id", type: "string", required: true, description: "Versioned model ID discovered from a profile, e.g. BP000273.1"}],
    usageHint: "This returns metadata, not an executable model or REST inference. Preserve model and TF-MoDISco URLs, model version, cell line and source experiment. External binary access is separate; this server does not load or execute HDF5. inMOTIFin is a separate Python simulation tool.",
    example: 'return await api.get("/dl/model/{model_id}/", {model_id: "BP000273.1"});',
  },
];

export const jasparWorkflows: WorkflowRecipe[] = [
  {
    title: "Inspect version-pinned ARNT2 motif and BPNet metadata",
    description: "Retain complete records for matrix MA1464.2, summary DL0001.1 and model BP000273.1. IDs pin record versions; release metadata alone does not pin the database. Model files require separate downloads and a compatible local runtime.",
    keywords: ["2026", "BPNet", "CWM", "PFM", "ARNT2", "model", "version"],
    code: 'const matrix = await api.get("/matrix/{matrix_id}/", {matrix_id:"MA1464.2"}); const profile = await api.get("/dl/summary/{profile_id}/", {profile_id:"DL0001.1"}); const model = await api.get("/dl/model/{model_id}/", {model_id:"BP000273.1"}); return {matrix, profile, model, interpretation:"PFM counts and signed CWM contributions are distinct. Preserve model/cell/experiment context; these predictions are not experimental binding evidence."};',
  },
  {
    title: "Read historical 2022 matrix listings explicitly",
    description: "Use the documented year filter, never release_number. The 2020 backend currently errors; other year/number values silently select current data and are rejected. For exact-version reads from the 2026 CORE artifact, discover the release-file workflow, which retains the complete-file checksum.",
    keywords: ["release", "2022", "2026", "snapshot", "reproducibility"],
    code: 'const response = await api.get("/matrix/", {release:"2022", page:1, page_size:2}); return {requested_release:"2022", response, complete:response.next === null};',
  },
];
