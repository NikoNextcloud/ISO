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
const gemini = loadTypeScriptModule(
  path.join(__dirname, "..", "src", "lib", "gemini-ai.ts"),
  { "@/lib/ai-review-prompt": prompt }
);

test("Gemini review uses generateContent with structured JSON output", async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_REVIEW_MODEL;
  let captured;
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_REVIEW_MODEL = "gemini-test-model";
  global.fetch = async (url, init) => {
    captured = { url, init, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"suggestions":[]}' }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await gemini.generateGeminiTextReview("Фирмен контекст", [{
      id: "s1",
      text: "Организацията управлява своите документи по установен и контролиран ред."
    }]);
    assert.equal(
      captured.url,
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent"
    );
    assert.equal(captured.init.headers["x-goog-api-key"], "test-key");
    assert.equal(captured.body.generationConfig.responseMimeType, "application/json");
    const responseSchema = captured.body.generationConfig.responseSchema;
    assert.deepEqual(responseSchema.propertyOrdering, ["suggestions"]);
    assert.equal(JSON.stringify(responseSchema).includes("additionalProperties"), false);
    assert.deepEqual(
      responseSchema.properties.suggestions.items.propertyOrdering,
      ["id", "suggested", "reason", "category", "confidence"]
    );
    assert.equal(captured.body.contents[0].role, "user");
    assert.equal(result.response, '{"suggestions":[]}');
    assert.equal(result.model, "Gemini · gemini-test-model");
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_REVIEW_MODEL;
    else process.env.GEMINI_REVIEW_MODEL = previousModel;
  }
});

test("Gemini review reports a missing server-side key", async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(
      () => gemini.generateGeminiTextReview("Контекст", [{ id: "s1", text: "Текст за проверка." }]),
      /GEMINI_API_KEY/
    );
  } finally {
    if (previousKey !== undefined) process.env.GEMINI_API_KEY = previousKey;
  }
});

test("Gemini replaces retired 2.0 models with the active default", () => {
  const previousModel = process.env.GEMINI_REVIEW_MODEL;
  try {
    process.env.GEMINI_REVIEW_MODEL = "gemini-2.0-flash";
    assert.equal(gemini.geminiReviewModel(), "gemini-3.5-flash");
    process.env.GEMINI_REVIEW_MODEL = "models/gemini-2.0-flash-lite";
    assert.equal(gemini.geminiReviewModel(), "gemini-3.5-flash");
    process.env.GEMINI_REVIEW_MODEL = "gemini-3.1-flash-lite";
    assert.equal(gemini.geminiReviewModel(), "gemini-3.1-flash-lite");
  } finally {
    if (previousModel === undefined) delete process.env.GEMINI_REVIEW_MODEL;
    else process.env.GEMINI_REVIEW_MODEL = previousModel;
  }
});

test("Gemini falls back to Flash-Lite when the preferred model has zero quota", async () => {
  const previousFetch = global.fetch;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_REVIEW_MODEL;
  const urls = [];
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_REVIEW_MODEL = "gemini-3.5-flash";
  global.fetch = async (url) => {
    urls.push(url);
    if (urls.length === 1) {
      return new Response(JSON.stringify({
        error: { message: "Quota exceeded for metric, limit: 0, model: gemini-3.5-flash" }
      }), { status: 429, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"suggestions":[]}' }] } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await gemini.generateGeminiTextReview("Контекст", [{
      id: "s1",
      text: "Текст за проверка."
    }]);
    assert.match(urls[0], /gemini-3\.5-flash:generateContent$/);
    assert.match(urls[1], /gemini-3\.1-flash-lite:generateContent$/);
    assert.equal(result.model, "Gemini · gemini-3.1-flash-lite");
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.GEMINI_REVIEW_MODEL;
    else process.env.GEMINI_REVIEW_MODEL = previousModel;
  }
});

test("Gemini output helper joins all returned text parts", () => {
  assert.equal(
    gemini.extractGeminiOutputText({
      candidates: [{ content: { parts: [{ text: '{"suggestions":' }, { text: "[]}" }] } }]
    }),
    '{"suggestions":[]}'
  );
});
