const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(filename) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const guard = loadTypeScriptModule(path.join(__dirname, "..", "src", "lib", "ai-guard.ts"));

test("AI cache key is stable for equivalent trimmed requests", () => {
  const first = guard.aiRequestHash({ type: "process", prompt: "  Test  ", companyName: "Company" });
  const second = guard.aiRequestHash({ type: "process", prompt: "Test", companyName: "Company" });
  assert.equal(first, second);
});

test("AI in-memory cache returns an existing result", async () => {
  const context = { client: null, userId: "cache-test-user" };
  const value = { dataUrl: "data:image/png;base64,AA==", model: "test-model" };
  await guard.saveCachedVisual(context, "cache-test-hash", value);
  assert.deepEqual(await guard.readCachedVisual(context, "cache-test-hash"), value);
});

test("AI rate limit blocks the eleventh paid generation", async () => {
  const context = { client: null, userId: `limit-test-${Date.now()}` };
  for (let index = 0; index < 10; index += 1) {
    const result = await guard.consumeAiGeneration(context, `hash-${index}`);
    assert.equal(result.allowed, true);
  }
  const blocked = await guard.consumeAiGeneration(context, "hash-11");
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});
