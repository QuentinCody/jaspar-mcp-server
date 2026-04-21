/**
 * JasparDataDO — Durable Object for staging large JASPAR responses.
 *
 * Extends RestStagingDO with schema hints for transcription-factor binding profiles.
 */

import { RestStagingDO } from "@bio-mcp/shared/staging/rest-staging-do";
import type { SchemaHints } from "@bio-mcp/shared/staging/schema-inference";

export class JasparDataDO extends RestStagingDO {
    protected getSchemaHints(data: unknown): SchemaHints | undefined {
        if (!data || typeof data !== "object") return undefined;

        // Single matrix detail (has matrix_id, pfm, etc.)
        const obj = data as Record<string, unknown>;
        if (typeof obj.matrix_id === "string" && obj.pfm) {
            return {
                tableName: "matrix_detail",
                indexes: ["matrix_id", "base_id", "name", "collection", "tax_group"],
            };
        }

        // Paginated list envelope: { count, next, previous, results: [...] }
        if (Array.isArray(obj.results)) {
            const sample = obj.results[0] as Record<string, unknown> | undefined;
            if (sample) {
                // Matrix listing
                if ("matrix_id" in sample && "collection" in sample) {
                    return {
                        tableName: "matrices",
                        indexes: ["matrix_id", "base_id", "name", "collection", "version"],
                    };
                }
                // Species listing
                if ("tax_id" in sample && "species" in sample) {
                    return {
                        tableName: "species",
                        indexes: ["tax_id", "species"],
                    };
                }
                // TFFM listing
                if ("tffm_id" in sample) {
                    return {
                        tableName: "tffm",
                        indexes: ["tffm_id", "base_id", "name", "matrix_id"],
                    };
                }
                // Collections/taxon listings (simple {name, url})
                if ("name" in sample && "url" in sample && Object.keys(sample).length <= 3) {
                    return {
                        tableName: "listings",
                        indexes: ["name"],
                    };
                }
                // Releases listing
                if ("release_number" in sample && "year" in sample) {
                    return {
                        tableName: "releases",
                        indexes: ["release_number", "year", "pubmed_id"],
                    };
                }
            }
        }

        // Top-level array (less common for JASPAR, but handle it)
        if (Array.isArray(data) && data.length > 0) {
            const first = data[0] as Record<string, unknown>;
            if ("matrix_id" in first) {
                return {
                    tableName: "matrices",
                    indexes: ["matrix_id", "base_id", "name", "collection"],
                };
            }
        }

        return undefined;
    }
}
