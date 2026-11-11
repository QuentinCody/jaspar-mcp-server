/**
 * JASPAR API adapter -- wraps jasparFetch into the ApiFetchFn interface
 * for use by the Code Mode __api_proxy tool.
 *
 * The JASPAR REST API uses Django REST Framework. Collection endpoints require trailing
 * slashes (e.g. /matrix/, /species/, /taxon/, /collections/, /releases/, /tffm/). The
 * catalog paths bake these in, but the adapter defensively injects `?format=json` if the
 * caller omits it, which makes the browsable-API renderer prefer JSON over its HTML
 * auto-generated pages.
 */

import type { ApiFetchFn } from "@bio-mcp/shared/codemode/catalog";
import { jasparFetch } from "./http";
import { getReleaseMatrix } from "./release-file";
import { prepareJasparRequest } from "./request";
import { fail, object, readText } from "./response";

/**
 * Create an ApiFetchFn that routes through the JASPAR REST API.
 * No auth needed -- JASPAR is open access.
 */
export function createJasparApiFetch(): ApiFetchFn {
    return async (request) => {
        if (request.method !== "GET" || request.body !== undefined) fail("JASPAR supports GET reads only, without a body", 405);
        if (request.path.startsWith("/release-files/")) {
            return { status: 200, data: await getReleaseMatrix(request.path, request.params) };
        }
        const { path, params } = prepareJasparRequest(request.path, request.params);
        const response = await jasparFetch(path, params);
        const text = await readText(response);
        const evidence = { response: text, http_status: response.status, content_type: response.headers.get("content-type"), path, params };
        if (!response.ok) fail(`HTTP ${response.status} from JASPAR`, response.status, evidence);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            if (params.format === "json") fail("Expected JSON from JASPAR; received a non-JSON response", 502, evidence);
            return { status: response.status, data: text };
        }
        let raw: unknown;
        try { raw = JSON.parse(text); }
        catch { fail("Invalid JSON from JASPAR", 502, evidence); }
        const matrix = path.match(/^\/matrix\/((?:MA|UN)\d+\.\d+)\/$/);
        const detail = path.match(/^\/dl\/(summary|model)\/([^/]+)\/$/);
        if (matrix || detail) {
            const data = object(raw);
            const record = detail ? object(data[detail[1] === "summary" ? "profile_summary" : "model"]) : data;
            const returned = detail ? `${record.base_id}.${record.version}` : record.matrix_id;
            const requested = detail ? detail[2] : matrix?.[1];
            if (returned !== requested) fail("JASPAR returned a different or unverified versioned identifier", 409, { ...evidence, resource: raw });
        }
        const data = path === "/dl/" ? normalizeDeepLearningPage(raw) : raw;
        return { status: response.status, data };
    };
}

/** Expose real profile rows to the shared staging/completeness engine. */
function normalizeDeepLearningPage(data: unknown): unknown {
    if (!data || typeof data !== "object" || !("results" in data)) return data;
    const envelope = data.results;
    if (!envelope || typeof envelope !== "object" || !("results" in envelope) || !Array.isArray(envelope.results)) return data;
    const { results, ...profile_listing } = envelope;
    return { ...data, results, profile_listing };
}
