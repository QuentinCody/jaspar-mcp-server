/// <reference types="node" />
import { runInNewContext } from "node:vm";
import { paginateAll } from "@bio-mcp/shared/codemode/paginate";
import { createApiProxyTool } from "@bio-mcp/shared/tools/api-proxy";
import { afterEach, expect, it, vi } from "vitest";
import { createJasparApiFetch } from "../lib/api-adapter";
import { jasparCatalog } from "./catalog";
import { jasparWorkflows } from "./deep-learning";

afterEach(() => vi.unstubAllGlobals());

it("executes version-pinned recipes through the public proxy without dropping scientific context", async () => {
  const calls: URL[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input); calls.push(url);
    if (url.pathname.includes("/matrix/MA1464.2/")) return Response.json({matrix_id:"MA1464.2", pfm:{A:[20]}});
    if (url.pathname.includes("/summary/")) return Response.json({profile_summary:{base_id:"DL0001", version:"1", cwm:{A:[-0.1]}}});
    if (url.pathname.includes("/model/")) return Response.json({model:{base_id:"BP000273", version:"1", cell_line:"HepG2", source_id:"ENCSR267TGY"}});
    return Response.json({count:2981, next:"https://jaspar.elixir.no/api/v1/matrix/?release=2022&page=2", results:[{matrix_id:"MA0002.2"}]});
  }));
  // SAFETY: bounded fixture responses never need staging or session capabilities.
  const proxy = createApiProxyTool({catalog:jasparCatalog, apiFetch:createJasparApiFetch(), doNamespace:{} as DurableObjectNamespace, stagingPrefix:"jaspar"});
  // SAFETY: these fixture calls access neither session nor workspace capabilities.
  const ctx = {} as Parameters<typeof proxy.handler>[1];
  const api = {get:(path: string, params: Record<string, unknown>)=>proxy.handler({method:"GET",path,params},ctx)};
  const result = await runInNewContext(`(async()=>{${jasparWorkflows[0].code}})()`,{api});
  expect(result.matrix).toMatchObject({matrix_id:"MA1464.2",pfm:{A:[20]}});
  expect(result.profile.profile_summary.cwm.A).toEqual([-0.1]);
  expect(result.model.model).toMatchObject({version:"1",cell_line:"HepG2",source_id:"ENCSR267TGY"});
  const historical = await runInNewContext(`(async()=>{${jasparWorkflows[1].code}})()`,{api});
  expect(historical).toMatchObject({requested_release:"2022",complete:false,response:{count:2981}});
  expect(calls.map(url=>url.pathname)).toEqual(["/api/v1/matrix/MA1464.2/","/api/v1/dl/summary/DL0001.1/","/api/v1/dl/model/BP000273.1/","/api/v1/matrix/"]);
  expect(calls[3].searchParams.get("release")).toBe("2022");
});

it("walks nested discovery pages and reports an explicit incomplete cap", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const page = Number(new URL(input).searchParams.get("page"));
    return Response.json({count:3,next:page<3?`?page=${page+1}`:null,results:{version:"latest",id_type:"summary",results:[{base_id:`DL000${page}`,version:"1"}]}});
  }));
  const adapter = createJasparApiFetch();
  const getPage = async (params: Record<string, unknown>) => (await adapter({method:"GET",path:"/dl/",params})).data;
  const opts = {strategy:"page" as const, pageSize:1, pageSizeParam:"page_size", itemsField:"results"};
  const all = await paginateAll(getPage,{},opts);
  expect(all.items).toEqual([{base_id:"DL0001",version:"1"},{base_id:"DL0002",version:"1"},{base_id:"DL0003",version:"1"}]);
  expect(all.completeness).toMatchObject({complete:true,returned:3,total_available:3});
  const capped = await paginateAll(getPage,{}, {...opts,maxPages:1});
  expect(capped.items).toEqual([{base_id:"DL0001",version:"1"}]);
  expect(capped.completeness).toMatchObject({complete:false,returned:1,total_available:3});
});
