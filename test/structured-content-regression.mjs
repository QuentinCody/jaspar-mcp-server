#!/usr/bin/env node

/**
 * Regression tests for jaspar-mcp-server structuredContent responses.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assertContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (haystack.includes(needle)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    console.log(`  Missing: ${needle}`);
    console.log(`  File: ${filePath}`);
    failedTests++;
  }
}

function assertNotContains(filePath, haystack, needle, testName) {
  totalTests++;
  if (!haystack.includes(needle)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    console.log(`  Should not contain: ${needle}`);
    console.log(`  File: ${filePath}`);
    failedTests++;
  }
}

function assertFileExists(relPath, testName) {
  totalTests++;
  const fullPath = path.join(SERVER_ROOT, relPath);
  if (fs.existsSync(fullPath)) {
    console.log(`${GREEN}\u2713${RESET} ${testName}`);
    passedTests++;
    return fs.readFileSync(fullPath, 'utf-8');
  } else {
    console.log(`${RED}\u2717${RESET} ${testName}`);
    failedTests++;
    return '';
  }
}

console.log(`${BLUE}JASPAR Structured Content Regression Tests${RESET}`);

// Verify core server files exist
const index = assertFileExists('src/index.ts', 'index.ts exists');
const doFile = assertFileExists('src/do.ts', 'do.ts exists');
const aiStub = assertFileExists('src/ai-stub.ts', 'ai-stub.ts exists');
const catalog = assertFileExists('src/spec/catalog.ts', 'catalog.ts exists');
const adapter = assertFileExists('src/lib/api-adapter.ts', 'api-adapter.ts exists');
const http = assertFileExists('src/lib/http.ts', 'http.ts exists');
const codeMode = assertFileExists('src/tools/code-mode.ts', 'code-mode.ts exists');
const queryData = assertFileExists('src/tools/query-data.ts', 'query-data.ts exists');
const getSchema = assertFileExists('src/tools/get-schema.ts', 'get-schema.ts exists');
const wrangler = assertFileExists('wrangler.jsonc', 'wrangler.jsonc exists');
const pkg = assertFileExists('package.json', 'package.json exists');

// Verify we did NOT inherit hand-built HPA tools
totalTests++;
if (!fs.existsSync(path.join(SERVER_ROOT, 'src/tools/search.ts'))) {
  console.log(`${GREEN}\u2713${RESET} src/tools/search.ts absent (no hand-built search tool)`);
  passedTests++;
} else {
  console.log(`${RED}\u2717${RESET} src/tools/search.ts should not exist (no hand-built search tool per plan)`);
  failedTests++;
}

totalTests++;
if (!fs.existsSync(path.join(SERVER_ROOT, 'src/tools/gene-lookup.ts'))) {
  console.log(`${GREEN}\u2713${RESET} src/tools/gene-lookup.ts absent (HPA-specific, deleted)`);
  passedTests++;
} else {
  console.log(`${RED}\u2717${RESET} src/tools/gene-lookup.ts should not exist (HPA-specific)`);
  failedTests++;
}

// index.ts structure
if (index) {
  assertContains('src/index.ts', index, 'JasparDataDO', 'index.ts exports JasparDataDO');
  assertContains('src/index.ts', index, 'MyMCP', 'index.ts declares MyMCP');
  assertContains('src/index.ts', index, 'McpAgent', 'index.ts imports McpAgent');
  assertContains('src/index.ts', index, 'registerCodeMode', 'index.ts registers Code Mode tools');
  assertContains('src/index.ts', index, 'registerQueryData', 'index.ts registers query-data tool');
  assertContains('src/index.ts', index, 'registerGetSchema', 'index.ts registers get-schema tool');
  assertContains('src/index.ts', index, '/health', 'index.ts has /health endpoint');
  assertContains('src/index.ts', index, '/mcp', 'index.ts has /mcp endpoint');
  assertContains('src/index.ts', index, 'name: "jaspar"', 'index.ts uses "jaspar" McpServer name');
  assertNotContains('src/index.ts', index, 'registerSearch', 'index.ts does not register hand-built search tool');
  assertNotContains('src/index.ts', index, 'registerGeneLookup', 'index.ts does not register HPA gene-lookup tool');
}

// do.ts structure
if (doFile) {
  assertContains('src/do.ts', doFile, 'RestStagingDO', 'do.ts extends RestStagingDO');
  assertContains('src/do.ts', doFile, 'JasparDataDO', 'do.ts exports JasparDataDO');
  assertContains('src/do.ts', doFile, 'matrix_id', 'do.ts recognises matrix_id field');
}

// ai-stub.ts
if (aiStub) {
  assertContains('src/ai-stub.ts', aiStub, 'export function jsonSchema', 'ai-stub exports jsonSchema');
}

// Catalog structure
if (catalog) {
  assertContains('src/spec/catalog.ts', catalog, 'ApiCatalog', 'catalog imports ApiCatalog type');
  assertContains('src/spec/catalog.ts', catalog, 'jasparCatalog', 'catalog exports jasparCatalog');
  assertContains('src/spec/catalog.ts', catalog, 'https://jaspar.elixir.no/api/v1', 'catalog uses elixir.no base URL');
  assertContains('src/spec/catalog.ts', catalog, '/matrix/', 'catalog has /matrix/ endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/matrix/{matrix_id}/', 'catalog has matrix detail endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/matrix/{base_id}/versions/', 'catalog has matrix versions endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/collections/', 'catalog has /collections/ endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/species/', 'catalog has /species/ endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/taxon/', 'catalog has /taxon/ endpoint (correct upstream spelling)');
  assertContains('src/spec/catalog.ts', catalog, '/releases/', 'catalog has /releases/ endpoint');
  assertContains('src/spec/catalog.ts', catalog, '/tffm/', 'catalog has /tffm/ endpoint');
  assertContains('src/spec/catalog.ts', catalog, 'category: "matrices"', 'catalog covers matrices category');
  assertContains('src/spec/catalog.ts', catalog, 'category: "collections"', 'catalog covers collections category');
  assertContains('src/spec/catalog.ts', catalog, 'category: "species"', 'catalog covers species category');
  assertContains('src/spec/catalog.ts', catalog, 'category: "taxa"', 'catalog covers taxa category');
  assertContains('src/spec/catalog.ts', catalog, 'category: "versions"', 'catalog covers versions category');
  assertContains('src/spec/catalog.ts', catalog, 'category: "tffamilies"', 'catalog covers tffamilies category');

  // Count endpoints in catalog (quick sanity check, minimum 8)
  const methodCount = (catalog.match(/method: "GET"/g) || []).length +
                      (catalog.match(/method: "POST"/g) || []).length;
  totalTests++;
  if (methodCount >= 8) {
    console.log(`${GREEN}\u2713${RESET} catalog has at least 8 endpoints (found ${methodCount})`);
    passedTests++;
  } else {
    console.log(`${RED}\u2717${RESET} catalog has fewer than 8 endpoints (found ${methodCount})`);
    failedTests++;
  }
}

// http.ts
if (http) {
  assertContains('src/lib/http.ts', http, 'jasparFetch', 'http.ts exports jasparFetch');
  assertContains('src/lib/http.ts', http, 'https://jaspar.elixir.no/api/v1', 'http.ts uses elixir.no base URL');
  assertContains('src/lib/http.ts', http, 'application/json', 'http.ts sends JSON Accept header');
}

// api-adapter.ts
if (adapter) {
  assertContains('src/lib/api-adapter.ts', adapter, 'createJasparApiFetch', 'adapter exports createJasparApiFetch');
  assertContains('src/lib/api-adapter.ts', adapter, 'ApiFetchFn', 'adapter imports ApiFetchFn');
  assertContains('src/lib/api-adapter.ts', adapter, 'jasparFetch', 'adapter uses jasparFetch');
  assertContains('src/lib/api-adapter.ts', adapter, 'json', 'adapter handles JSON content type');
  assertContains('src/lib/api-adapter.ts', adapter, 'format', 'adapter defends against HTML responses via format param');
}

// code-mode.ts
if (codeMode) {
  assertContains('src/tools/code-mode.ts', codeMode, '"jaspar"', 'code-mode uses jaspar prefix');
  assertContains('src/tools/code-mode.ts', codeMode, 'createSearchTool', 'code-mode registers search tool');
  assertContains('src/tools/code-mode.ts', codeMode, 'createExecuteTool', 'code-mode registers execute tool');
  assertContains('src/tools/code-mode.ts', codeMode, 'JASPAR_DATA_DO', 'code-mode uses JASPAR_DATA_DO binding');
}

// query-data / get-schema
if (queryData) {
  assertContains('src/tools/query-data.ts', queryData, 'jaspar_query_data', 'registers jaspar_query_data');
  assertContains('src/tools/query-data.ts', queryData, 'JASPAR_DATA_DO', 'query-data references JASPAR_DATA_DO');
}
if (getSchema) {
  assertContains('src/tools/get-schema.ts', getSchema, 'jaspar_get_schema', 'registers jaspar_get_schema');
  assertContains('src/tools/get-schema.ts', getSchema, 'JASPAR_DATA_DO', 'get-schema references JASPAR_DATA_DO');
}

// wrangler.jsonc
if (wrangler) {
  assertContains('wrangler.jsonc', wrangler, 'jaspar-mcp-server', 'wrangler sets name to jaspar-mcp-server');
  assertContains('wrangler.jsonc', wrangler, '"nodejs_compat"', 'wrangler enables nodejs_compat');
  assertContains('wrangler.jsonc', wrangler, '"ai": "./src/ai-stub.ts"', 'wrangler aliases ai -> ai-stub');
  assertContains('wrangler.jsonc', wrangler, 'JasparDataDO', 'wrangler declares JasparDataDO');
  assertContains('wrangler.jsonc', wrangler, 'JASPAR_DATA_DO', 'wrangler binds JASPAR_DATA_DO');
  assertContains('wrangler.jsonc', wrangler, '"port": 8827', 'wrangler dev port is 8827');
  assertContains('wrangler.jsonc', wrangler, 'CODE_MODE_LOADER', 'wrangler declares CODE_MODE_LOADER worker loader');
}

// package.json
if (pkg) {
  assertContains('package.json', pkg, '"name": "jaspar-mcp-server"', 'package name is jaspar-mcp-server');
  assertContains('package.json', pkg, 'wrangler dev --port 8827', 'package dev script uses port 8827');
  assertContains('package.json', pkg, '@bio-mcp/shared', 'package depends on @bio-mcp/shared');
}

console.log(`\n${BLUE}Test Results Summary${RESET}`);
console.log(`Total tests: ${totalTests}`);
console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
console.log(`${RED}Failed: ${failedTests}${RESET}`);

if (failedTests > 0) {
  console.log(`\n${RED}Regression tests FAILED.${RESET}`);
  process.exit(1);
}

console.log(`\n${GREEN}JASPAR structured content regression tests passed.${RESET}`);
