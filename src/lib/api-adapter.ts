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

/**
 * Create an ApiFetchFn that routes through the JASPAR REST API.
 * No auth needed -- JASPAR is open access.
 */
export function createJasparApiFetch(): ApiFetchFn {
    return async (request) => {
        // Defensively ensure JSON responses: DRF's browsable API defaults to HTML.
        const params: Record<string, unknown> = { ...(request.params ?? {}) };
        if (params.format === undefined) {
            params.format = "json";
        }

        const response = await jasparFetch(request.path, params);

        if (!response.ok) {
            let errorBody: string;
            try {
                errorBody = await response.text();
            } catch {
                errorBody = response.statusText;
            }
            const error = new Error(
                `HTTP ${response.status}: ${errorBody.slice(0, 200)}`,
            ) as Error & {
                status: number;
                data: unknown;
            };
            error.status = response.status;
            error.data = errorBody;
            throw error;
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("json")) {
            const text = await response.text();
            return { status: response.status, data: text };
        }

        const data = await response.json();
        return { status: response.status, data };
    };
}
