/** Normalize legacy filters and refuse upstream parameters known to be ignored. */
export function prepareJasparRequest(path: string, input: Record<string, unknown> = {}): { path: string; params: Record<string, unknown> } {
  const url = new URL(path, "https://jaspar.elixir.no/api/v1/");
  let pathname = path.split("?")[0];
  const params: Record<string, unknown> = Object.fromEntries(url.searchParams);
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) params[key] = value;
  }
  if (params.tf_name !== undefined) {
    if (params.name !== undefined && params.name !== params.tf_name) {
      throw new Error("Conflicting name and legacy tf_name filters");
    }
    params.name = params.tf_name;
    delete params.tf_name;
  }
  // Collection detail ignores name/tax_group; the matrix listing honors both.
  const collection = pathname.match(/^\/collections\/(CORE|UNVALIDATED)\/?$/);
  if (collection && (params.name !== undefined || params.tax_group !== undefined)) {
    params.collection = collection[1];
    pathname = "/matrix/";
  }
  if (params.release !== undefined && params.release !== "") {
    if (!["2020", "2022"].includes(String(params.release))) {
      throw new Error("Unsupported JASPAR release filter: only documented years 2020 and 2022 are accepted. Other values silently return current data upstream. Use versioned matrix IDs or year-specific artifacts at https://jaspar.elixir.no/downloads/; release metadata is not a dataset snapshot.");
    }
  }
  if (/^\/dl\/?$/.test(pathname)) {
    const unsupported = Object.keys(params).filter(key => !["page", "page_size", "format"].includes(key));
    if (unsupported.length) throw new Error(`Unverified or ignored deep-learning filters: ${unsupported.join(", ")}. Paginate /dl/ and inspect the returned records instead.`);
  }
  const detail = pathname.match(/^\/dl\/(summary|model)\/([^/]+)\/?$/);
  if (detail && !/\.\d+$/.test(detail[2])) {
    throw new Error("Deep-learning identifiers require a version suffix, e.g. DL0001.1 or BP000273.1");
  }
  if (params.format === undefined) params.format = "json";
  return { path: pathname, params };
}
