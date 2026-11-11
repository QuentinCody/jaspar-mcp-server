import { afterEach, expect, it, vi } from "vitest";
import { createJasparApiFetch } from "./api-adapter";
import { prepareJasparRequest } from "./request";

afterEach(() => vi.unstubAllGlobals());

it("translates legacy names in query strings and params without mutating callers", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({count: 2, results: [{name: "ARNT2"}]}));
  vi.stubGlobal("fetch", fetch);
  const params = {tf_name: "ARNT2", page: 2, format: undefined};
  await createJasparApiFetch()({method: "GET", path: "/matrix/?page=1", params});
  const url = new URL(String(fetch.mock.calls[0][0]));
  expect(Object.fromEntries(url.searchParams)).toEqual({name: "ARNT2", page: "2", format: "json"});
  expect(params).toEqual({tf_name: "ARNT2", page: 2, format: undefined});
  expect(prepareJasparRequest("/matrix/?tf_name=ARNT2&name=ARNT2").params.name).toBe("ARNT2");
  expect(() => prepareJasparRequest("/matrix/?name=RUNX1", {tf_name: "ARNT2"})).toThrow("Conflicting");
  expect(prepareJasparRequest("/collections/CORE/", {tf_name:"ARNT2"})).toEqual({path:"/matrix/",params:{name:"ARNT2",collection:"CORE",format:"json"}});
});

it("refuses silently ignored release values before network access", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  const api = createJasparApiFetch();
  for (const release of ["2026", "2024", "11", "9999"]) {
    await expect(api({method: "GET", path: `/matrix/?release=${release}`})).rejects.toThrow("silently return current data");
  }
  expect(fetch).not.toHaveBeenCalled();
  expect(prepareJasparRequest("/matrix/", {release: 2022}).params.release).toBe(2022);
  expect(prepareJasparRequest("/matrix/?release=2020").params.release).toBe("2020");
  expect(prepareJasparRequest("/matrix/?release=").params.release).toBe("");
});

it("preserves nested discovery and versioned models including signed CWM values", async () => {
  const discovery = {count: 240, next: "https://jaspar.elixir.no/api/v1/dl/?page=2", results: {version: "latest", id_type: "summary", results: [{base_id: "DL0001", version: "1", jaspar_ref: "MA1464.2"}]}};
  const model = {model: {base_id: "BP000273", version: "1", cell_line: "HepG2", source_id: "ENCSR267TGY", pfm: {A: [20]}, cwm: {A: [-0.1]}, model_url: "https://mencius.uio.no/model.h5"}};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json(discovery)).mockResolvedValueOnce(Response.json(model)));
  const api = createJasparApiFetch();
  expect(await api({method: "GET", path: "/dl/", params: {page: 1, page_size: 2}})).toEqual({status: 200, data: {...discovery,results:discovery.results.results,profile_listing:{version:"latest",id_type:"summary"}}});
  expect(await api({method: "GET", path: "/dl/model/BP000273.1/"})).toEqual({status: 200, data: model});
  expect(() => prepareJasparRequest("/dl/summary/DL0001/")).toThrow("version suffix");
  expect(() => prepareJasparRequest("/dl/?search=ARNT2")).toThrow("ignored deep-learning filters");
  expect(() => prepareJasparRequest("/dl", {name: "ARNT2"})).toThrow("ignored deep-learning filters");
});

it("preserves provider errors and explicit formats while rejecting unexpected HTML", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("missing", {status: 404})).mockResolvedValueOnce(new Response("<html>error</html>")).mockResolvedValueOnce(new Response(">MA0002.2\nA [1 2]")));
  const api = createJasparApiFetch();
  await expect(api({method: "GET", path: "/matrix/missing/"})).rejects.toMatchObject({status: 404, data: { response: "missing", http_status: 404 }});
  await expect(api({method: "GET", path: "/matrix/"})).rejects.toThrow("Expected JSON");
  expect(await api({method: "GET", path: "/matrix/MA0002.2/?format=jaspar"})).toEqual({status: 200, data: ">MA0002.2\nA [1 2]"});
});

it("rejects unsupported writes without converting them to reads", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(createJasparApiFetch()({method: "POST", path: "/matrix/"})).rejects.toThrow("GET reads only");
  expect(fetch).not.toHaveBeenCalled();
});
