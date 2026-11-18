// 2.9 The AI layer's prompts and output schemas, shared by the on-device model and the cloud proxy so both
// backends answer the same task the same way. Plain data only, no imports: the API imports this file directly.
// The model never does arithmetic. It parses text, picks a tool, or writes sentences from figures it is given.

export type AiLanguage = "en" | "fr";

export interface AiFigure {
  label: string;
  value: string;
}

// one earlier message in a chat, so a general answer can follow the conversation
export interface AiTurn {
  role: "user" | "assistant";
  text: string;
}

export const ASK_TOOLS = [
  "spending",
  "safe_to_spend",
  "upcoming_bills",
  "goal_progress",
  "term_money",
  "afford",
  "top_places",
  "recent",
  "accounts",
  "log_expense",
  "decline",
] as const;
export type AskTool = (typeof ASK_TOOLS)[number];
export const ASK_RANGES = ["this_period", "this_week", "last_week", "this_month", "last_month", "last_30_days"] as const;
export type AskRange = (typeof ASK_RANGES)[number];

export type AiRequest =
  // 2.1 quick add: pull the amount, merchant and category out of a short note
  | { task: "parse"; language: AiLanguage; text: string; categories: string[] }
  // 2.2 explain an afford verdict from the figures code worked out
  | { task: "explain"; language: AiLanguage; figures: AiFigure[] }
  // 2.13 pick which budget tool answers a question
  | { task: "route"; language: AiLanguage; question: string; categories: string[]; goals: string[] }
  // 2.13 answer the question from the tool's figures
  | { task: "answer"; language: AiLanguage; question: string; figures: AiFigure[] }
  // 2.10 three or four sentences about the week
  | { task: "recap"; language: AiLanguage; figures: AiFigure[] }
  // Ask Current as a general assistant, for anything that isn't a question about the user's own numbers
  | { task: "chat"; language: AiLanguage; question: string; history: AiTurn[] }
  // Ask Current as an assistant that can use the app's tools: one step of the loop, either a tool to call or the
  // reply. On-device only; the cloud proxy never accepts it.
  | {
      task: "assistant";
      language: AiLanguage;
      question: string;
      history: AiTurn[];
      // tools already called for this message, with what they found
      results: AiToolResult[];
      categories: string[];
      goals: string[];
      // after the last allowed tool call: the model may only reply
      mustReply: boolean;
    };

// what one tool call found, fed back to the model for its next step
export interface AiToolResult {
  tool: AskTool;
  figures: AiFigure[];
}

// the assistant's tools, as the model sees them
export const ASSISTANT_ACTIONS = [...ASK_TOOLS.filter((t) => t !== "decline"), "reply"] as const;
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export type AiTask = AiRequest["task"];

// what each task returns
export interface AiResults {
  parse: { amount: string; merchant: string; category: string };
  explain: { explanation: string };
  route: { tool: AskTool; category: string; range: AskRange; goal: string; amount: string };
  answer: { reply: string };
  recap: { recap: string };
  chat: { reply: string };
  assistant: { action: AssistantAction; category: string; range: AskRange; goal: string; amount: string; merchant: string; reply: string };
}

// JSON Schema, kept to the subset both Apple's Foundation Models and Claude's structured output accept
export interface JsonSchema {
  type: "object";
  properties: Record<string, { type: "string"; description?: string; enum?: readonly string[] }>;
  required: string[];
  additionalProperties: false;
}

export interface BuiltPrompt {
  system: string;
  user: string;
  schema: JsonSchema;
  // the longest useful reply, in tokens
  maxTokens: number;
}

// request size limits, enforced by the proxy and respected by the app
export const AI_LIMITS = { text: 200, question: 1000, listItems: 40, itemLength: 60, figures: 24, figureLength: 120, historyTurns: 8, turnLength: 800 } as const;

const NONE = "none";

const VOICE =
  "Write like a friend who's good with money: short, casual, second person, plain words. " +
  "Never joke about being short of money, never guilt the user, never celebrate spending. ";

const NUMBERS =
  "Use only the figures you are given, copied exactly as written. Never calculate, add, subtract, round or estimate a number, " +
  "and never mention a number that isn't in the figures. ";

const SCOPE =
  "You only talk about this person's own budget in this app. Don't give advice about investing, loans, taxes, credit cards or credit scores. ";

function language(lang: AiLanguage): string {
  return lang === "fr" ? "Write in Canadian French. " : "Write in English. ";
}

function figureList(figures: readonly AiFigure[]): string {
  return figures.map((f) => `- ${f.label}: ${f.value}`).join("\n");
}

function stringSchema(fields: Record<string, { description: string; enum?: readonly string[] }>): JsonSchema {
  const properties: JsonSchema["properties"] = {};
  for (const [name, field] of Object.entries(fields)) {
    properties[name] = field.enum ? { type: "string", description: field.description, enum: field.enum } : { type: "string", description: field.description };
  }
  return { type: "object", properties, required: Object.keys(fields), additionalProperties: false };
}

// the system prompt, user message and output schema for one request
export function buildPrompt(request: AiRequest): BuiltPrompt {
  switch (request.task) {
    case "parse":
      return {
        system:
          "You read a short note someone typed about money they spent and fill in fields. " +
          "amount: the amount exactly as written in the note, digits only with its decimal part, or an empty string if there is none. Never calculate it. " +
          "merchant: the shop, service or thing, short, as the note names it, or an empty string. " +
          `category: the best match from the allowed list, or "${NONE}" if nothing fits.`,
        user: request.text,
        schema: stringSchema({
          amount: { description: "Amount as written, e.g. 4.50, or empty" },
          merchant: { description: "Where or what, e.g. Uber" },
          category: { description: "One of the user's categories", enum: [...request.categories, NONE] },
        }),
        maxTokens: 80,
      };
    case "explain":
      return {
        system:
          VOICE +
          NUMBERS +
          SCOPE +
          language(request.language) +
          "Someone asked whether they can afford something. The answer was already worked out; explain it in one short paragraph of two or three sentences, starting with the verdict.",
        user: figureList(request.figures),
        schema: stringSchema({ explanation: { description: "Two or three sentences" } }),
        maxTokens: 200,
      };
    case "route":
      return {
        system:
          "Pick the one tool that answers a question about the user's own budget. " +
          "spending: how much was spent, optionally in one category and over a range. " +
          "safe_to_spend: how much they can spend now or per day. " +
          "upcoming_bills: bills coming up. " +
          "goal_progress: savings goals, optionally one goal. " +
          "term_money: how long semester or term money lasts. " +
          "afford: whether they can afford an amount; put the amount as written in amount. " +
          "decline: anything that isn't about the user's own numbers in this app (general questions, chat, explanations, writing help, advice); a general assistant answers those. " +
          `Use "${NONE}" or an empty string for fields the question doesn't need. ` +
          `Categories: ${request.categories.join(", ") || NONE}. Goals: ${request.goals.join(", ") || NONE}.`,
        user: request.question,
        schema: stringSchema({
          tool: { description: "The tool to use", enum: ASK_TOOLS },
          category: { description: "A category name from the list, or none", enum: [...request.categories, NONE] },
          range: { description: "The time range, this_period if unsure", enum: ASK_RANGES },
          goal: { description: "A goal name from the list, or none", enum: [...request.goals, NONE] },
          amount: { description: "For afford: the amount as written, or empty" },
        }),
        maxTokens: 80,
      };
    case "answer":
      return {
        system:
          VOICE +
          NUMBERS +
          SCOPE +
          language(request.language) +
          "Answer the question in at most three sentences using only these figures. If they don't answer it, say what you can tell from them.",
        user: `Question: ${request.question}\n\nFigures:\n${figureList(request.figures)}`,
        schema: stringSchema({ reply: { description: "At most three sentences" } }),
        maxTokens: 220,
      };
    case "recap":
      return {
        system:
          VOICE +
          NUMBERS +
          language(request.language) +
          "Write a recap of the user's week in three or four short sentences from these figures. Mention the daily number last.",
        user: figureList(request.figures),
        schema: stringSchema({ recap: { description: "Three or four sentences" } }),
        maxTokens: 240,
      };
    case "assistant":
      return {
        system:
          "You are Current, a warm, chatty money buddy inside a student budgeting app, running privately on the user's phone. " +
          "Talk like a friend: natural, encouraging, a little personal, and follow the conversation (\"what about last week?\" means the same question for last week). " +
          "Ask a short follow-up question when it would help. Help with anything they ask, money or not. " +
          "You're not a licensed advisor: for investing, taxes, loans, credit cards or credit scores give general information, not personal recommendations, and say so briefly. " +
          "You can use the app's tools to look things up. Each step, either call ONE tool or reply. " +
          "Tools: spending (how much was spent, optional category and range); safe_to_spend (what they can spend now and per day); " +
          "upcoming_bills; goal_progress (optional goal); term_money (semester money); afford (put the price in amount); " +
          "top_places (where money went, optional range); recent (latest purchases, optional category); accounts (balances); " +
          "log_expense (record a purchase they mention: amount, merchant, category; they confirm it before it's saved). " +
          "Call a tool whenever the answer depends on their numbers, and don't call the same tool twice with the same settings. " +
          "When you reply, any number about the user must be copied exactly from the tool results; never calculate, estimate or invent one. " +
          "If a tool found nothing, say so kindly. Keep replies short unless they ask for detail. " +
          `Use "${NONE}" or an empty string for fields you don't need. ` +
          `Their categories: ${request.categories.join(", ") || NONE}. Their goals: ${request.goals.join(", ") || NONE}. ` +
          language(request.language),
        user:
          (request.history.length ? `Conversation so far:\n${request.history.map((h) => `${h.role === "user" ? "User" : "You"}: ${h.text}`).join("\n")}\n\n` : "") +
          `User: ${request.question}` +
          (request.results.length
            ? `\n\nTool results so far:\n${request.results.map((r) => `[${r.tool}]\n${figureList(r.figures) || "nothing found"}`).join("\n")}`
            : "") +
          (request.mustReply ? "\n\nNow reply to the user." : ""),
        schema: stringSchema({
          action: {
            description: request.mustReply ? "reply" : "A tool to call, or reply",
            enum: request.mustReply ? ["reply"] : ASSISTANT_ACTIONS,
          },
          category: { description: "For spending, recent or log_expense: a category from the list, or none", enum: [...request.categories, NONE] },
          range: { description: "For spending or top_places: the time range, this_period if unsure", enum: ASK_RANGES },
          goal: { description: "For goal_progress: a goal from the list, or none", enum: [...request.goals, NONE] },
          amount: { description: "For afford or log_expense: the amount as written, or empty" },
          merchant: { description: "For log_expense: where or what, or empty" },
          reply: { description: "When action is reply: your message to the user. Otherwise empty" },
        }),
        maxTokens: 600,
      };
    case "chat":
      return {
        system:
          "You are Current, a friendly assistant inside a student budgeting app, running privately on the user's phone. " +
          "Help with whatever they ask: questions, explanations, writing, ideas, everyday money know-how. Be clear and warm, and keep it short unless they want detail. " +
          "You can't see their budget in this message; if they ask about their own numbers, tell them to ask about spending, bills, goals or what's safe to spend. " +
          "For investing, taxes, loans, credit cards or credit scores, give general information and say it isn't personal advice. " +
          "Never make up figures about the user. " +
          language(request.language),
        user: `${request.history.map((h) => `${h.role === "user" ? "User" : "You"}: ${h.text}`).join("\n")}${request.history.length ? "\n" : ""}User: ${request.question}`,
        schema: stringSchema({ reply: { description: "Your answer" } }),
        maxTokens: 600,
      };
  }
}

const LANGUAGES: readonly string[] = ["en", "fr"];

function str(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max ? value : null;
}

function list(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > AI_LIMITS.listItems) return null;
  const items = value.map((v) => str(v, AI_LIMITS.itemLength));
  return items.every((v): v is string => v !== null) ? items : null;
}

function figures(value: unknown): AiFigure[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > AI_LIMITS.figures) return null;
  const out: AiFigure[] = [];
  for (const f of value) {
    const label = str((f as AiFigure)?.label, AI_LIMITS.figureLength);
    const v = str((f as AiFigure)?.value, AI_LIMITS.figureLength);
    if (!label || !v) return null;
    out.push({ label, value: v });
  }
  return out;
}

// a well-formed request within the size limits, or null; the proxy rejects anything else
export function validateAiRequest(body: unknown): AiRequest | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const lang = LANGUAGES.includes(b.language as string) ? (b.language as AiLanguage) : null;
  if (!lang) return null;
  switch (b.task) {
    case "parse": {
      const text = str(b.text, AI_LIMITS.text);
      const categories = list(b.categories);
      return text && categories ? { task: "parse", language: lang, text, categories } : null;
    }
    case "route": {
      const question = str(b.question, AI_LIMITS.question);
      const categories = list(b.categories);
      const goals = list(b.goals);
      return question && categories && goals ? { task: "route", language: lang, question, categories, goals } : null;
    }
    case "answer": {
      const question = str(b.question, AI_LIMITS.question);
      const f = figures(b.figures);
      return question && f ? { task: "answer", language: lang, question, figures: f } : null;
    }
    case "chat": {
      const question = str(b.question, AI_LIMITS.question);
      const raw = Array.isArray(b.history) ? b.history.slice(-AI_LIMITS.historyTurns) : null;
      const history = raw?.map((h) => {
        const role = (h as AiTurn)?.role;
        const text = str((h as AiTurn)?.text, AI_LIMITS.turnLength);
        return (role === "user" || role === "assistant") && text ? { role, text } : null;
      });
      return question && history && history.every((h) => h !== null) ? { task: "chat", language: lang, question, history: history as AiTurn[] } : null;
    }
    case "explain":
    case "recap": {
      const f = figures(b.figures);
      return f ? { task: b.task, language: lang, figures: f } : null;
    }
    default:
      return null;
  }
}

// a model reply that matches the task's schema, or null
export function validateAiResult<T extends AiTask>(task: T, value: unknown, request: AiRequest): AiResults[T] | null {
  if (!value || typeof value !== "object") return null;
  const { schema } = buildPrompt(request);
  const v = value as Record<string, unknown>;
  for (const [name, field] of Object.entries(schema.properties)) {
    if (typeof v[name] !== "string") return null;
    if (field.enum && !field.enum.includes(v[name] as string)) return null;
  }
  void task;
  return Object.fromEntries(Object.keys(schema.properties).map((k) => [k, v[k]])) as unknown as AiResults[T];
}
