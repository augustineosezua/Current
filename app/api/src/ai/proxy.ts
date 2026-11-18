// ROADMAP 2.9: the cloud fallback for AI features, used only on iPhones that can't run Apple's on-device model.
// Stateless by design: it checks Plus, rate-limits per install, calls Claude Haiku with structured output and
// returns the parsed result. It stores nothing and never logs request or response bodies. The Anthropic key
// stays here, server-side; it is never shipped in the app.
//
// Prompts and schemas come from app/packages/core so the on-device model and this proxy answer each task the
// same way, and so the app can't send its own prompt (this is not an open LLM endpoint).
import Anthropic from "@anthropic-ai/sdk";
import express, { type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";

import { buildPrompt, validateAiRequest, validateAiResult, type AiRequest, type AiTask } from "../../../packages/core/src/aiPrompts.ts";

const MODEL = "claude-haiku-5-5";
// thinking counts toward max_tokens on Haiku 5.5, so leave room above each task's reply size
const THINKING_HEADROOM = 1024;
const ENTITLEMENT = process.env.REVENUECAT_ENTITLEMENT ?? "plus";
const ENTITLEMENT_CACHE_MS = 10 * 60 * 1000;

const anthropic = new Anthropic();

// install id -> when its Plus check stops being trusted; only ids and times, never budget data
const entitlementCache = new Map<string, { active: boolean; until: number }>();

// whether this RevenueCat app user currently has Plus, cached for a few minutes
async function hasPlus(appUserId: string): Promise<boolean> {
  const cached = entitlementCache.get(appUserId);
  if (cached && cached.until > Date.now()) return cached.active;

  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) throw new Error("REVENUECAT_SECRET_KEY is not set");
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`RevenueCat returned ${res.status}`);
  const body = (await res.json()) as { subscriber?: { entitlements?: Record<string, { expires_date: string | null }> } };
  const entitlement = body.subscriber?.entitlements?.[ENTITLEMENT];
  // a null expiry is a non-expiring grant
  const active = !!entitlement && (entitlement.expires_date === null || Date.parse(entitlement.expires_date) > Date.now());

  entitlementCache.set(appUserId, { active, until: Date.now() + ENTITLEMENT_CACHE_MS });
  if (entitlementCache.size > 50_000) entitlementCache.clear();
  return active;
}

// the install's RevenueCat app user id, sent by the app on every request
function installId(req: Request): string | null {
  const id = req.header("x-app-user-id");
  return id && id.length <= 128 ? id : null;
}

// one model call: the task's prompt and schema in, the validated JSON out (or null)
async function run<T extends AiTask>(request: AiRequest & { task: T }) {
  const prompt = buildPrompt(request);
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: prompt.maxTokens + THINKING_HEADROOM,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    output_config: { effort: "low", format: { type: "json_schema", schema: { ...prompt.schema } } },
  });
  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return null;
  try {
    return validateAiResult(request.task, JSON.parse(text), request);
  } catch {
    return null;
  }
}

export const aiRouter = express.Router();

// per install: plenty for a person, not enough to use this as a free model endpoint
aiRouter.use(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => installId(req) ?? "anonymous",
  }),
);

// /ai/parse, /ai/explain, /ai/ask (route and answer), /ai/recap; the body's `task` must match the path
const PATHS: Record<string, readonly AiTask[]> = {
  parse: ["parse"],
  explain: ["explain"],
  ask: ["route", "answer"],
  recap: ["recap"],
};

aiRouter.post("/:path", express.json({ limit: "16kb" }), async (req: Request, res: Response) => {
  const allowed = PATHS[String(req.params.path)];
  if (!allowed) return res.status(404).json({ error: "not_found" });

  const id = installId(req);
  if (!id) return res.status(401).json({ error: "missing_install_id" });

  const request = validateAiRequest(req.body);
  if (!request || !allowed.includes(request.task)) return res.status(400).json({ error: "bad_request" });

  try {
    if (!(await hasPlus(id))) return res.status(403).json({ error: "plus_required" });
    const result = await run(request);
    if (!result) return res.status(422).json({ error: "no_answer" });
    return res.json({ result });
  } catch (e) {
    // log the kind of failure only, never the request
    console.error(`ai ${request.task} failed: ${e instanceof Anthropic.APIError ? `anthropic ${e.status}` : (e as Error).name}`);
    return res.status(502).json({ error: "upstream" });
  }
});
