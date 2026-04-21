/**
 * JASPAR REST API catalog -- covers the public endpoints under
 * https://jaspar.elixir.no/api/v1 (migrated from jaspar.genereg.net).
 *
 * JASPAR is the open-access database of curated, non-redundant transcription-factor
 * (TF) binding profiles (position frequency matrices / PWMs / TFFMs).
 *
 * Out of scope: sequence scanning / motif-hit discovery. That is a separate EBI
 * service (JASPAR_profile_inference / scan), not the JASPAR REST API.
 */

import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const jasparCatalog: ApiCatalog = {
    name: "JASPAR",
    baseUrl: "https://jaspar.elixir.no/api/v1",
    version: "2026 (release 11)",
    auth: "none",
    endpointCount: 12,
    notes:
        "- JASPAR stores curated TF binding profiles: PFMs (position frequency matrices), PWMs, and TFFMs\n" +
        "- All collection paths require a trailing slash (Django REST Framework convention)\n" +
        "- Matrix IDs look like MA0002.2: MA0002 is the base_id, 2 is the version\n" +
        "- Use /matrix/{base_id}/versions/ (no version suffix) to enumerate matrix versions\n" +
        "- Use /matrix/{matrix_id}/ (with version suffix) to fetch full PFM data for one version\n" +
        "- Matrix listings support filters: collection (CORE, UNVALIDATED), tax_group (vertebrates,\n" +
        "  plants, insects, fungi, nematodes, urochordates, trematodes, diatoms, dictyostelium,\n" +
        "  cnidaria, oomycota), tf_name, tf_class, tf_family, data_type (ChIP-seq, SELEX, PBM, etc.),\n" +
        "  version=latest for only the newest version of each base_id\n" +
        "- DRF pagination: results come in {count, next, previous, results:[...]} envelope; use\n" +
        "  ?page=N and ?page_size=N (default 10, max per listing varies)\n" +
        "- Responses default to HTML (browsable API) unless Accept: application/json or\n" +
        "  ?format=json is sent -- the adapter injects format=json automatically\n" +
        "- TF class/family taxonomy is embedded IN each matrix record's 'class' and 'family'\n" +
        "  arrays; there is no standalone /tffamilies/ endpoint. Filter matrices with\n" +
        "  tf_class=... or tf_family=... to browse by family\n" +
        "- Out of scope: sequence scanning / motif hit discovery (separate EBI service)",
    endpoints: [
        // === Matrices (the core resource) ===
        {
            method: "GET",
            path: "/matrix/",
            summary:
                "List transcription-factor binding matrices with optional filters. Returns a paginated" +
                " envelope {count, next, previous, results}. Each result is a compact matrix summary" +
                " with matrix_id, name, base_id, version, collection, and sequence_logo URL. Pass" +
                " version=latest to get only the newest version of each TF profile.",
            category: "matrices",
            queryParams: [
                { name: "collection", type: "string", required: false, description: "Collection name (CORE, UNVALIDATED)" },
                { name: "tax_group", type: "string", required: false, description: "Taxonomic group (vertebrates, plants, insects, fungi, nematodes, urochordates, trematodes, diatoms, dictyostelium, cnidaria, oomycota)" },
                { name: "tax_id", type: "string", required: false, description: "NCBI taxonomy ID (e.g. 9606 for human)" },
                { name: "tf_name", type: "string", required: false, description: "Transcription factor name (e.g. Runx1)" },
                { name: "tf_class", type: "string", required: false, description: "TF class (e.g. 'Runt domain factors')" },
                { name: "tf_family", type: "string", required: false, description: "TF family (e.g. 'Runt-related factors')" },
                { name: "data_type", type: "string", required: false, description: "Experimental data type (ChIP-seq, SELEX, PBM, HT-SELEX, DAP-seq, etc.)" },
                { name: "version", type: "string", required: false, description: "Pass 'latest' to return only the most recent version of each base_id" },
                { name: "release", type: "string", required: false, description: "Restrict to a specific JASPAR release number" },
                { name: "search", type: "string", required: false, description: "Free-text search across matrix metadata" },
                { name: "page", type: "number", required: false, description: "Page number (1-indexed)" },
                { name: "page_size", type: "number", required: false, description: "Results per page" },
                { name: "format", type: "string", required: false, description: "Response format; adapter defaults to 'json'", enum: ["json"] },
            ],
        },
        {
            method: "GET",
            path: "/matrix/{matrix_id}/",
            summary:
                "Get the full record for a single matrix version (e.g. MA0002.2). Returns PFM data" +
                " (A/C/G/T counts per position), class/family arrays, species, UniProt IDs, PubMed" +
                " references, and TFFM cross-link if present. Typical response size 5-20 KB.",
            category: "matrices",
            pathParams: [
                {
                    name: "matrix_id",
                    type: "string",
                    required: true,
                    description: "Matrix ID with version suffix (e.g. 'MA0002.2', 'UN0305.1')",
                },
            ],
        },
        {
            method: "GET",
            path: "/matrix/{base_id}/versions/",
            summary:
                "List all versions of a matrix by its base ID (WITHOUT the version suffix, e.g." +
                " 'MA0002'). Returns a compact list with matrix_id, name, version, and collection" +
                " for each version. Useful to discover whether a matrix has been updated.",
            category: "versions",
            pathParams: [
                {
                    name: "base_id",
                    type: "string",
                    required: true,
                    description: "Matrix base ID WITHOUT version suffix (e.g. 'MA0002', not 'MA0002.2')",
                },
            ],
        },

        // === Collections ===
        {
            method: "GET",
            path: "/collections/",
            summary:
                "List JASPAR collections. Current collections: CORE (curated, experimentally" +
                " validated TF binding profiles) and UNVALIDATED (profiles not yet curated to CORE" +
                " quality). Returns {name, url} for each.",
            category: "collections",
        },
        {
            method: "GET",
            path: "/collections/{collection}/",
            summary:
                "Get matrices in a specific collection (CORE or UNVALIDATED). Returns the same" +
                " paginated envelope as /matrix/?collection=... with full filter-set available as" +
                " query parameters. Useful when you know you want only curated (CORE) profiles.",
            category: "collections",
            pathParams: [
                {
                    name: "collection",
                    type: "string",
                    required: true,
                    description: "Collection name (CORE, UNVALIDATED)",
                    enum: ["CORE", "UNVALIDATED"],
                },
            ],
            queryParams: [
                { name: "tax_group", type: "string", required: false, description: "Taxonomic group filter" },
                { name: "tf_name", type: "string", required: false, description: "Transcription factor name filter" },
                { name: "page", type: "number", required: false, description: "Page number" },
                { name: "page_size", type: "number", required: false, description: "Results per page" },
            ],
        },

        // === Species ===
        {
            method: "GET",
            path: "/species/",
            summary:
                "List species represented in JASPAR with their NCBI tax_id. Paginated." +
                " Useful to discover which organisms have profiles in JASPAR before filtering.",
            category: "species",
            queryParams: [
                { name: "page", type: "number", required: false, description: "Page number" },
                { name: "page_size", type: "number", required: false, description: "Results per page" },
            ],
        },
        {
            method: "GET",
            path: "/species/{tax_id}/",
            summary:
                "Get matrices associated with a specific species (by NCBI tax_id, e.g. 9606 for" +
                " human, 10090 for mouse). Returns the same paginated matrix listing shape as" +
                " /matrix/?tax_id=...",
            category: "species",
            pathParams: [
                {
                    name: "tax_id",
                    type: "string",
                    required: true,
                    description: "NCBI taxonomy ID (e.g. '9606' for Homo sapiens, '10090' for Mus musculus)",
                },
            ],
        },

        // === Taxa (note: upstream path is /taxon/, not /taxa/) ===
        {
            method: "GET",
            path: "/taxon/",
            summary:
                "List taxonomic groupings used by JASPAR (vertebrates, plants, insects, fungi," +
                " nematodes, urochordates, trematodes, diatoms, dictyostelium, cnidaria, oomycota)." +
                " Returns {name, url} for each. NOTE: the upstream path is /taxon/, not /taxa/.",
            category: "taxa",
        },
        {
            method: "GET",
            path: "/taxon/{taxon_name}/",
            summary:
                "Get matrices in a specific taxonomic group. Returns a paginated matrix listing" +
                " filtered to that group (vertebrates, plants, insects, etc.).",
            category: "taxa",
            pathParams: [
                {
                    name: "taxon_name",
                    type: "string",
                    required: true,
                    description: "Taxon name slug (e.g. 'vertebrates', 'plants', 'insects', 'fungi', 'nematodes')",
                },
            ],
        },

        // === Releases ===
        {
            method: "GET",
            path: "/releases/",
            summary:
                "List JASPAR releases (historical versions). Each entry has year, release_number," +
                " pubmed_id, and active flag. Useful to check release history / find the citation" +
                " PubMed ID for a given release year.",
            category: "versions",
        },
        {
            method: "GET",
            path: "/releases/{release_number}/",
            summary:
                "Get detail for a single JASPAR release, including the citation text, DOI, and" +
                " PubMed reference. Use to pin analyses to a specific database snapshot.",
            category: "versions",
            pathParams: [
                {
                    name: "release_number",
                    type: "string",
                    required: true,
                    description: "Release number (e.g. '11' for JASPAR 2026, '10' for JASPAR 2024)",
                },
            ],
        },

        // === TFFM (TF Flexible Models) ===
        {
            method: "GET",
            path: "/tffm/",
            summary:
                "List TFFMs (TF Flexible Models) -- HMM-like extensions of PFMs that model" +
                " inter-position dependencies. Each TFFM is linked to a backing JASPAR matrix." +
                " Returns {tffm_id, base_id, name, matrix_id, log_p_*, experiment_name, *_url}" +
                " per entry. Paginated.",
            category: "tffamilies",
            queryParams: [
                { name: "page", type: "number", required: false, description: "Page number" },
                { name: "page_size", type: "number", required: false, description: "Results per page" },
            ],
        },
    ],
};
