# jaspar-mcp-server

MCP server wrapping the JASPAR REST API -- the open-access database of curated, non-redundant transcription-factor (TF) binding profiles (PFMs / PWMs / TFFMs).

- Upstream API docs: <https://jaspar.elixir.no/api/v1/docs> (migrated from `jaspar.genereg.net`)
- Base URL: `https://jaspar.elixir.no/api/v1`
- Auth: none (open access)
- Port (local dev): `8827`

## Tools (Code Mode only)

- `jaspar_search` -- discover catalog endpoints (matrices, collections, species, taxa, versions, TFFMs)
- `jaspar_execute` -- run JavaScript in a V8 isolate with `api.get()` / `api.post()` against the JASPAR REST API
- `jaspar_query_data` -- SQL queries against staged responses
- `jaspar_get_schema` -- schema / listing of staged datasets in the current session

## Example

```js
// Inside jaspar_execute
const matrix = await api.get('/matrix/MA0002.2/');
return { name: matrix.name, collection: matrix.collection };
```

Out of scope: sequence scanning / motif-hit discovery (separate EBI service, not the JASPAR REST API).
