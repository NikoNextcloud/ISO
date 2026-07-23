const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const test = require("node:test");
const ts = require("typescript");

function loadTypeScriptModule(filename, aliases = {}) {
  const source = fs.readFileSync(filename, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  const defaultRequire = loaded.require.bind(loaded);
  loaded.require = (request) => aliases[request] ?? defaultRequire(request);
  loaded._compile(compiled, filename);
  return loaded.exports;
}

const prompt = loadTypeScriptModule(path.join(__dirname, "..", "src", "lib", "ai-review-prompt.ts"));
const openai = loadTypeScriptModule(
  path.join(__dirname, "..", "src", "lib", "openai-ai.ts"),
  { "@/lib/ai-review-prompt": prompt }
);

test("OpenAI review uses the Responses API with strict structured output", async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_REVIEW_MODEL;
  let captured;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_REVIEW_MODEL = "test-review-model";
  global.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      output: [{ content: [{ type: "output_text", text: '{"suggestions":[]}' }] }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await openai.generateOpenAiTextReview("Фирмен контекст", [{
      id: "s1",
      text: "Организацията управлява своите документи по установен и контролиран ред."
    }]);
    assert.equal(captured.url, "https://api.openai.com/v1/responses");
    assert.equal(captured.init.headers.Authorization, "Bearer test-key");
    assert.equal(captured.body.model, "test-review-model");
    assert.equal(captured.body.store, false);
    assert.equal(captured.body.text.format.type, "json_schema");
    assert.equal(captured.body.text.format.strict, true);
    assert.equal(result.response, '{"suggestions":[]}');
    assert.equal(result.model, "OpenAI · test-review-model");
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_REVIEW_MODEL;
    else process.env.OPENAI_REVIEW_MODEL = previousModel;
  }
});

test("OpenAI review reports a missing server-side key", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(
      () => openai.generateOpenAiTextReview("Контекст", [{ id: "s1", text: "Текст за проверка." }]),
      /OPENAI_API_KEY/
    );
  } finally {
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
  }
});

test("OpenAI output helper supports the SDK-style output_text field", () => {
  assert.equal(openai.extractOpenAiOutputText({ output_text: '{"suggestions":[]}' }), '{"suggestions":[]}');
});
