/**
 * JASPAR REST API HTTP client.
 *
 * Wraps restFetch with the JASPAR ELIXIR API base URL.
 * JASPAR migrated from jaspar.genereg.net -> jaspar.elixir.no (verified 301 redirect 2026-04-20).
 * No authentication required -- open access.
 *
 * The JASPAR REST API is built on Django REST Framework and content-negotiates via
 * both the Accept header and a `?format=json` query parameter. We send Accept: application/json,
 * which is sufficient for programmatic access; the adapter may also append ?format=json
 * defensively on paths without trailing slashes to match upstream expectations.
 */

import { restFetch, type RestFetchOptions } from "@bio-mcp/shared/http/rest-fetch";

const JASPAR_BASE = "https://jaspar.elixir.no/api/v1";

export interface JasparFetchOptions extends Omit<RestFetchOptions, "retryOn"> {
    /** Override base URL */
    baseUrl?: string;
}

/**
 * Fetch from the JASPAR REST API.
 */
export async function jasparFetch(
    path: string,
    params?: Record<string, unknown>,
    opts?: JasparFetchOptions,
): Promise<Response> {
    const baseUrl = opts?.baseUrl ?? JASPAR_BASE;
    const headers: Record<string, string> = {
        Accept: "application/json",
        ...(opts?.headers ?? {}),
    };

    return restFetch(baseUrl, path, params, {
        ...opts,
        headers,
        retryOn: [429, 500, 502, 503],
        retries: opts?.retries ?? 3,
        timeout: opts?.timeout ?? 30_000,
        userAgent:
            "jaspar-mcp-server/1.0 (bio-mcp; https://github.com/QuentinCody/jaspar-mcp-server)",
    });
}
