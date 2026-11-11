# jaspar-mcp-server

MCP server wrapping the JASPAR REST API -- the open-access database of curated, non-redundant transcription-factor (TF) binding profiles (PFMs / PWMs / TFFMs).

- Upstream API docs: <https://jaspar.elixir.no/api/v1/docs> (migrated from `jaspar.genereg.net`)
- Base URL: `https://jaspar.elixir.no/api/v1`
- Auth: none (open access)
- Port (local dev): `8827`

## Tools (Code Mode only)

- `jaspar_search` -- discover catalog endpoints and recipes (matrices, collections, species, taxa, versions, TFFMs, deep-learning profiles/models, release files)
- `jaspar_execute` -- run JavaScript in a V8 isolate with `api.get()` against the JASPAR REST API and supported release artifact
- `jaspar_query_data` -- SQL queries against staged responses
- `jaspar_get_schema` -- schema / listing of staged datasets in the current session

All four tools also have `mcp_` aliases. Complete response envelopes above 30 KiB
stage in the existing Durable Object with `_staging` metadata and a citation hash
covering the stored original response. Use the returned handle for SQL retrieval.

## Example

```js
// Inside jaspar_execute
const matrix = await api.get('/matrix/MA0002.2/');
return { name: matrix.name, collection: matrix.collection };
```

Out of scope: sequence scanning / motif-hit discovery (separate EBI service, not the JASPAR REST API).

## Deep-learning models and reproducibility

Discover profiles with `api.get('/dl/', {page:1, page_size:2})`. Records are nested at
`response.results` (normalized from upstream `results.results`); listing `version` and
`id_type` are retained in `profile_listing`. Retain `count`, `next` and `previous`.
For multiple pages, use `api.getAll('/dl/', {}, {strategy:'page', pageSize:2,
pageSizeParam:'page_size', itemsField:'results', maxPages:2})` and inspect its
completeness result. The provider currently ignores `name` and `search` on this route;
the adapter rejects these filters instead of returning an apparently filtered dataset.

```js
// Version-pinned records; the catalog also offers this complete workflow.
const profile = await api.get('/dl/summary/{profile_id}/', {profile_id:'DL0001.1'});
const model = await api.get('/dl/model/{model_id}/', {model_id:'BP000273.1'});
const matrix = await api.get('/matrix/{matrix_id}/', {matrix_id:'MA1464.2'});
return {profile, model, matrix};
```

Keep model version, cell line, source experiment and species context. Signed contribution-weight
matrices (CWM) are distinct from PFM counts. Profile model lists have their own pagination.
Metadata provides separate model and TF-MoDISco HDF5 URLs. Bounded range probes on
October 4, 2026 still fail to connect to the external file host; complete binary access
and execution remain unverified. The MCP server does not download/execute these models.
[inMOTIFin](https://jaspar.elixir.no/tools/) is an external Python simulation package.

Matrix search uses `name`, e.g. `{name:'ARNT2'}`. Legacy `tf_name` is translated;
conflicting values are rejected. Filtered CORE/UNVALIDATED collection reads route through
`/matrix/` because collection detail ignores these filters. `/releases/11/` supplies citation metadata for 2026,
not a pinned database. The only documented historical `release` query values are
`2020` and `2022` (years, not release numbers); the 2020 backend currently returns an error.
Other values silently select current data upstream and are rejected by this adapter.
For a dated bulk snapshot, use the official
[2026 CORE PFM artifact](https://jaspar.elixir.no/download/data/2026/CORE/JASPAR2026_CORE_non-redundant_pfms_jaspar.txt)
and retain its checksum and retrieval date. Versioned record IDs do not pin the whole database.

The local Code Mode route below reads that artifact, selects an exact matrix
version and returns its raw JASPAR record, count strings, source URL, release,
retrieval time and SHA-256 of the complete decoded HTTP file bytes:

```js
return await api.get('/release-files/2026/CORE/{matrix_id}', {matrix_id:'MA1104.3'});
```

Repeat with `expected_sha256` set to the recorded `artifact.sha256` to reject file
changes. This is a local adapter route, not an upstream REST endpoint. It bounds
each read to 8 MiB and 30 seconds and rejects partial or malformed files. A missing
exact ID returns `found:false`, without substituting a current matrix version.
It provides no species/experiment metadata beyond what the file contains.
Return the entire response or staging handle to retain that evidence.

Native validation on October 4, 2026 read the complete **817,525-byte** artifact:
**2,633 matrices**, **25,378 positions**, maximum width **33**; SHA-256
`0dc9b7f9e159a8376c2e52edf373863ae21518bb760ceeea494ad6b746092e53`.
An independent parser checks every record. GATA6 `MA1104.3` is present and
`MA1104.2` is absent from this non-redundant file, although the older version
remains available through REST. No latest-version substitution occurs.

REST JSON, JASPAR and PFM reads retain native data. Explicit text formats use a
compatible Accept header; forcing JSON caused native HTTP 406. REST bodies have
a 2 MiB / 15-second read bound, a 30-second request-header budget, strict UTF-8
decoding and partial-response rejection. Complete bounded native errors are
retained through staging. Versioned matrix/profile/model JSON must report the
requested identifier. Artifact redirects are rejected using the Worker-supported
manual redirect mode; a partial HTTP 200 cannot establish a complete-file checksum.

All 240 native DL profiles are covered by the three-page acceptance comparison.
SQL projections preserve complete `native_json`, source paths, nested motif data,
signed CWM values, PFM counts and response context. Model and profile versions,
species and experimental metadata remain distinct. Citation record counts describe
returned source records, excluding auxiliary SQLite context/child rows.

Native receipts, Worker acceptance, proof checks and validation logs are recorded
in `scratch/2026-10-04-jaspar/`. These checks cover bounded native reads and exact
artifact selections; they do not establish model executability or release-wide REST
snapshot completeness. Run `pnpm --filter @bio-mcp/shared run build` before deployment
and restart the Worker after shared-package changes.

<!-- license-and-data-terms:start -->
## License and data terms

The code in this repository is licensed under the Apache License 2.0 (see `LICENSE`).
If you use it in your work, please cite it (see `CITATION.cff`). Citation is requested, not required.

The license covers the code only. Data that this server returns comes from JASPAR and stays under the terms of that source: CC BY 4.0.
You are responsible for your use of the data under those terms.
<!-- license-and-data-terms:end -->
