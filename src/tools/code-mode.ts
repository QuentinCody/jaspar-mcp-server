/**
 * JASPAR Code Mode -- registers search + execute tools for full API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import type { McpServer } from "@bio-mcp/shared/mcp";
import { createJasparApiFetch } from "../lib/api-adapter";
import { jasparResponse } from "../lib/tool-result";
import { jasparCatalog } from "../spec/catalog";

interface CodeModeEnv {
    JASPAR_DATA_DO: DurableObjectNamespace;
    CODE_MODE_LOADER: WorkerLoader;
}

/**
 * Register jaspar_search and jaspar_execute tools.
 */
export function registerCodeMode(
    server: McpServer,
    env: CodeModeEnv,
): void {
    const apiFetch = createJasparApiFetch();
    const registrar = { tool: (...args: unknown[]) => {
        const [name, ...rest] = args;
        // SAFETY: shared factories supply SDK registration arguments and handlers.
        const handler = rest.pop() as (input: unknown, extra: unknown) => ReturnType<typeof jasparResponse>;
        const respond = (input: unknown, extra: unknown) => jasparResponse(() => handler(input, extra), env, String(name), extra, input);
        const register = server.tool.bind(server) as (...values: unknown[]) => void;
        register(name, ...rest, respond);
        register(`mcp_${String(name)}`, ...rest, respond);
    } };

    // Register the search tool (in-process, no isolate)
    const searchTool = createSearchTool({
        prefix: "jaspar",
        catalog: jasparCatalog,
    });
    searchTool.register(registrar);

    // Register the execute tool (V8 isolate via DynamicWorkerExecutor)
    const executeTool = createExecuteTool({
        prefix: "jaspar",
        // Verifiable provenance: jaspar_execute results carry a _meta.citation.
        source: { id: "jaspar", name: "JASPAR", url: "https://jaspar.elixir.no" },
        catalog: jasparCatalog,
        apiFetch,
        preserveApiErrors: true,
        timeout: 90_000,
        maxInlineBytes: 30 * 1024,
        stagingThreshold: 30 * 1024,
        doNamespace: env.JASPAR_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(registrar);
}
