import type { McpServer } from "@bio-mcp/shared/mcp";
import { createGetSchemaHandler } from "@bio-mcp/shared/staging/utils";
import { z } from "zod";
import { jasparResponse } from "../lib/tool-result";

interface SchemaEnv {
    JASPAR_DATA_DO?: unknown;
}

export function registerGetSchema(server: McpServer, env?: SchemaEnv): void {
    const handler = createGetSchemaHandler("JASPAR_DATA_DO", "jaspar");

    for (const name of ["jaspar_get_schema", "mcp_jaspar_get_schema"]) server.registerTool(
        name,
        {
            title: "Get Staged JASPAR Data Schema",
            description:
                "Get schema information for staged JASPAR data. Shows table structures and row counts. " +
                "If called without a data_access_id, lists all staged datasets available in this session.",
            inputSchema: {
                data_access_id: z
                    .string()
                    .min(1)
                    .optional()
                    .describe(
                        "Data access ID for the staged dataset. If omitted, lists all staged datasets in this session.",
                    ),
            },
        },
        async (args, extra) => {
            const runtimeEnv =
                env || (extra as { env?: SchemaEnv })?.env || {};
            return jasparResponse(() => handler(
                args as Record<string, unknown>,
                runtimeEnv as Record<string, unknown>,
                (extra as Record<string, unknown>),
            ), runtimeEnv, name, extra, args);
        },
    );
}
