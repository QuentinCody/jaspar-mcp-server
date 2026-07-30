/**
 * JASPAR Code Mode -- registers search + execute tools for full API access.
 *
 * search: In-process catalog query, returns matching endpoints with docs.
 * execute: V8 isolate with api.get/api.post + searchSpec/listCategories.
 */

import type { McpServer } from "@bio-mcp/shared/mcp";
import { createSearchTool } from "@bio-mcp/shared/codemode/search-tool";
import { createExecuteTool } from "@bio-mcp/shared/codemode/execute-tool";
import { jasparCatalog } from "../spec/catalog";
import { createJasparApiFetch } from "../lib/api-adapter";

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

    // Register the search tool (in-process, no isolate)
    const searchTool = createSearchTool({
        prefix: "jaspar",
        catalog: jasparCatalog,
    });
    searchTool.register(server as unknown as { tool: (...args: unknown[]) => void });

    // Register the execute tool (V8 isolate via DynamicWorkerExecutor)
    const executeTool = createExecuteTool({
        prefix: "jaspar",
        // Verifiable provenance: jaspar_execute results carry a _meta.citation.
        source: { id: "jaspar", name: "JASPAR", url: "https://jaspar.elixir.no" },
        catalog: jasparCatalog,
        apiFetch,
        doNamespace: env.JASPAR_DATA_DO,
        loader: env.CODE_MODE_LOADER,
    });
    executeTool.register(server as unknown as { tool: (...args: unknown[]) => void });
}
