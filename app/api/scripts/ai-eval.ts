// ROADMAP 2.9 quality check for the cloud backend: runs the shared AI test set against Claude Haiku with the same
// prompts and schemas the proxy uses, and prints the pass rate. Each run costs a few cents.
// Usage (from app/api): ANTHROPIC_API_KEY=... npx tsx scripts/ai-eval.ts
import Anthropic from "@anthropic-ai/sdk";

import { AI_EVAL_SET, EVAL_CATEGORIES, gradeAiEval } from "../../packages/core/src/aiEval.ts";
import { buildPrompt, validateAiResult, type AiRequest } from "../../packages/core/src/aiPrompts.ts";

const client = new Anthropic();
let passed = 0;

for (const c of AI_EVAL_SET) {
  const request: AiRequest =
    c.task === "parse"
      ? { task: "parse", language: "en", text: c.text, categories: EVAL_CATEGORIES }
      : { task: "route", language: "en", question: c.question, categories: EVAL_CATEGORIES, goals: ["Laptop"] };
  const prompt = buildPrompt(request);
  const response = await client.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: prompt.maxTokens + 1024,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { effort: "low", format: { type: "json_schema", schema: { ...prompt.schema } } },
  });
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "null";
  const result = validateAiResult(request.task, JSON.parse(text), request);
  const ok = !!result && gradeAiEval(c, result as never);
  if (ok) passed++;
  else console.log(`FAIL ${c.task === "parse" ? c.text : c.question} -> ${text}`);
}

console.log(`${passed}/${AI_EVAL_SET.length} passed`);
