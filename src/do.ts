import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import { flattenObject, type SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const row = (value: unknown, path: string, index: number): Row => ({
  ...(record(value) ? { ...flattenObject(value, 2), ...Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, item !== null && typeof item === "object" ? JSON.stringify(item) : item])) } : { value }),
  native_json: JSON.stringify(value), source_path: path, source_index: index,
});
function tableName(value: unknown): string {
  if (!record(value)) return "observations";
  if ("matrix_id" in value) return "matrices";
  if ("tax_id" in value && "species" in value && !("model_name" in value)) return "species";
  if ("tffm_id" in value) return "tffm";
  if ("release_number" in value && "year" in value) return "releases";
  if (typeof value.base_id === "string" && value.base_id.startsWith("DL")) return "profiles";
  if (typeof value.base_id === "string" && value.base_id.startsWith("BP")) return "models";
  if ("name" in value && "url" in value && Object.keys(value).length <= 3) return "listings";
  return "observations";
}

/** Lossless query rows keep PFM/CWM, versions and model context distinct. */
export class JasparDataDO extends RestStagingDO {
  protected getTabularData(value: unknown): unknown {
    const data = record(value) && Array.isArray(value.content) && record(value.structuredContent) && "data" in value.structuredContent
      ? value.structuredContent.data : value;
    if (Array.isArray(data)) return { [tableName(data[0])]: data.map((v, i) => row(v, `/${i}`, i)) };
    if (!record(data)) return data;
    if (typeof data.sql === "string" && Array.isArray(data.rows)) return { query_rows: data.rows.map((v, i) => row(v, `/rows/${i}`, i)) };
    const tables: Record<string, Row[]> = {};
    const context = { ...data };
    const listKey = Array.isArray(data.results) ? "results" : "items";
    const values = data[listKey];
    if (Array.isArray(values)) {
      tables[tableName(values[0])] = values.map((v, i) => row(v, `/${listKey}/${i}`, i));
      delete context[listKey];
    }
    if (typeof data.matrix_id === "string" && data.pfm) tables.matrix_detail = [row(data, "", 0)];
    appendNestedTables(data, tables, context);
    if (!Object.keys(tables).length) tables.native_observations = [row(data, "", 0)];
    tables.response_context = [{ native_json: JSON.stringify(context) }];
    return tables;
  }

  protected getSchemaHints(value: unknown): SchemaHints {
    const tables = this.getTabularData(value);
    const columnTypes: Record<string, string> = { native_json: "TEXT", source_path: "TEXT" };
    if (record(tables)) for (const values of Object.values(tables)) {
      if (!Array.isArray(values)) continue;
      for (const item of values) if (record(item)) for (const [key, value] of Object.entries(item)) {
        if (typeof value === "string") columnTypes[key] = "TEXT";
      }
    }
    return { columnTypes };
  }
}

function appendNestedTables(data: Row, tables: Record<string, Row[]>, context: Row) {
  for (const [field, name] of [["profile_summary", "profiles"], ["model", "models"], ["matrix", "release_matrix"]]) if (record(data[field])) {
    tables[name] = [...(tables[name] ?? []), row(data[field], `/${field}`, 0)];
    delete context[field];
  }
  for (const field of ["models", "other_models"]) if (record(data[field]) && Array.isArray(data[field].results)) {
    const { results, ...paging } = data[field];
    tables[field] = results.map((v, i) => row(v, `/${field}/results/${i}`, i));
    context[field] = paging;
  }
  for (const field of ["motifs", "amp_motifs", "other_motifs"]) if (Array.isArray(data[field])) {
    tables[field] = data[field].map((v, i) => row(v, `/${field}/${i}`, i));
    delete context[field];
  }
}
