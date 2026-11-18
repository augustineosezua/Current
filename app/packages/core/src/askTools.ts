// 2.13 Ask Current: the fixed set of tools the model can choose from. Core answers each one with plain facts;
// the app turns facts into labelled figures, and the model only writes a reply from those.
import { checkAfford, type AffordResult } from "./afford";
import type { AskRange, AskTool } from "./aiPrompts";
import { getBillStatus } from "./bills";
import { addDays, daysBetween, endOfMonth, startOfDay, startOfMonth } from "./dates";
import { sortGoalsByPriority } from "./goals";
import { previousRange, startOfWeek, type DayRange } from "./insights";
import { toCents, type Cents } from "./money";
import { calculateSafeToSpend, type StsInput } from "./sts";
import { getSpending } from "./summary";
import { getTopMerchants } from "./insights";
import { getTermPlanSummary } from "./termPlan";
import { isTermPlanCurrent } from "./limits";

export interface AskToolCall {
  tool: AskTool;
  category?: string;
  // several categories answered together, e.g. every food category for "food"; wins over `category`
  categories?: string[];
  // the everyday word the question used for that group ("food"), for the reply
  topic?: AskTopic;
  range?: AskRange;
  goal?: string;
  amount?: string;
}

// one fact a tool found; the app labels and formats it
export type AskFact =
  | { kind: "range"; range: DayRange; label: AskRange }
  // with a topic, `parts` splits the amount by category and categoryId is null
  | { kind: "spent"; amount: Cents; categoryId: string | null; topic?: AskTopic; parts?: { categoryId: string; amount: Cents }[] }
  | { kind: "previousSpent"; amount: Cents; categoryId: string | null; topic?: AskTopic }
  | { kind: "topCategory"; categoryId: string | null; amount: Cents }
  | { kind: "safeToSpend"; amount: Cents }
  | { kind: "perDay"; amount: Cents; until: Date; daysLeft: number }
  | { kind: "bill"; name: string; amount: Cents; dueDate: Date; overdue: boolean }
  | { kind: "billsTotal"; amount: Cents; through: Date }
  | { kind: "goal"; name: string; saved: Cents; target: Cents; dueDate: Date; thisPeriod: Cents }
  | { kind: "termPlan"; name: string; amount: Cents; released: Cents; perWeek: Cents; endDate: Date }
  | { kind: "afford"; result: AffordResult }
  | { kind: "place"; name: string; amount: Cents; count: number }
  | { kind: "transaction"; date: Date; amount: Cents; merchant: string | null; categoryId: string | null }
  | { kind: "account"; name: string | null; type: string; balance: Cents }
  | { kind: "nothing"; about: AskTool };

export interface AskAnswer {
  tool: AskTool;
  facts: AskFact[];
  // out of scope: the app replies with the fixed decline line, no model reply
  declined: boolean;
}

export interface AskInput extends StsInput {
  categories: StsInput["categories"];
}

const BILL_WINDOW_DAYS = 14;

// questions that are financial advice, caught before the model sees them
const OUT_OF_SCOPE = [
  /\b(invest\w*|stocks?|shares|etfs?|crypto\w*|bitcoin|index funds?|rrsp|tfsa|resp|401\s?k|roth|ira|isa|pension)\b/i,
  /\b(tax|taxes|taxed|irs|cra|hmrc)\b/i,
  /\bcredit (score|rating|report|limit)\b/i,
  /\b(mortgage|refinanc\w*|interest rates?|apr)\b/i,
  /\b(should|which|best|worth)\b.*\b(loan|credit card|line of credit|borrow\w*)\b/i,
];

// true when a question asks for advice the app never gives
export function isOutOfScope(question: string): boolean {
  return OUT_OF_SCOPE.some((p) => p.test(question));
}

// a named range as calendar days; this_period is the budget period up to today
export function resolveAskRange(range: AskRange, periodStart: Date, now: Date): DayRange {
  const today = startOfDay(now);
  switch (range) {
    case "this_week":
      return { start: startOfWeek(today), end: today };
    case "last_week": {
      const start = addDays(startOfWeek(today), -7);
      return { start, end: addDays(start, 6) };
    }
    case "this_month":
      return { start: startOfMonth(today), end: today };
    case "last_month": {
      const start = startOfMonth(addDays(startOfMonth(today), -1));
      return { start, end: endOfMonth(start) };
    }
    case "last_30_days":
      return { start: addDays(today, -29), end: today };
    case "this_period":
      return { start: startOfDay(periodStart), end: today };
  }
}

// name -> id, matching whole names first and then a name that contains the text
function findByName<T extends { id: string; name: string }>(items: readonly T[], name: string | undefined): T | null {
  const wanted = name?.trim().toLowerCase();
  if (!wanted || wanted === "none") return null;
  return items.find((i) => i.name.toLowerCase() === wanted) ?? items.find((i) => i.name.toLowerCase().includes(wanted)) ?? null;
}

// answer one tool call from the budget; nothing here is written anywhere
export function answerAskTool(call: AskToolCall, input: AskInput, now: Date): AskAnswer {
  const answer = (facts: AskFact[]): AskAnswer => ({ tool: call.tool, facts, declined: false });
  const sts = calculateSafeToSpend(input, now);
  const today = startOfDay(now);

  switch (call.tool) {
    case "decline":
      return { tool: "decline", facts: [], declined: true };

    case "spending": {
      const label = call.range ?? "this_period";
      const range = resolveAskRange(label, sts.period.start, now);
      const before = previousRange(range);
      const spending = getSpending(input.transactions, input.categories, range.start, range.end);
      const previous = getSpending(input.transactions, input.categories, before.start, before.end);
      const amountIn = (s: typeof spending, id: string) => s.byCategory.find((c) => c.categoryId === id)?.amount ?? 0;

      // a group of categories ("food": groceries, eating out, coffee) adds them up and shows each one
      const group = [...new Set((call.categories ?? []).map((n) => findByName(input.categories, n)).filter((c) => c !== null))];
      if (group.length > 1 || (group.length === 1 && call.topic)) {
        const parts = group.map((c) => ({ categoryId: c.id, amount: amountIn(spending, c.id) })).sort((a, b) => b.amount - a.amount);
        const total = parts.reduce((sum, p) => sum + p.amount, 0);
        const before = group.reduce((sum, c) => sum + amountIn(previous, c.id), 0);
        return answer([
          { kind: "range", range, label },
          { kind: "spent", amount: total, categoryId: null, topic: call.topic, parts },
          { kind: "previousSpent", amount: before, categoryId: null, topic: call.topic },
        ]);
      }

      const category = group[0] ?? findByName(input.categories, call.category);
      const pick = (s: typeof spending) => (category ? amountIn(s, category.id) : s.total);
      const facts: AskFact[] = [
        { kind: "range", range, label },
        { kind: "spent", amount: pick(spending), categoryId: category?.id ?? null },
        { kind: "previousSpent", amount: pick(previous), categoryId: category?.id ?? null },
      ];
      if (!category) for (const c of spending.byCategory.slice(0, 3)) facts.push({ kind: "topCategory", categoryId: c.categoryId, amount: c.amount });
      return answer(facts);
    }

    case "safe_to_spend":
      return answer([
        { kind: "safeToSpend", amount: sts.safeToSpend },
        { kind: "perDay", amount: sts.daily.perDay, until: sts.daily.periodEnd, daysLeft: sts.daily.daysLeft },
      ]);

    case "upcoming_bills": {
      const through = addDays(today, BILL_WINDOW_DAYS);
      const due = input.bills
        .filter((b) => !b.isPaid && daysBetween(b.dueDate, through) >= 0)
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      if (due.length === 0) return answer([{ kind: "nothing", about: "upcoming_bills" }, { kind: "billsTotal", amount: 0, through }]);
      return answer([
        ...due.slice(0, 8).map(
          (b): AskFact => ({ kind: "bill", name: b.name, amount: b.amount, dueDate: b.dueDate, overdue: getBillStatus(b, now) === "overdue" }),
        ),
        { kind: "billsTotal", amount: due.reduce((s, b) => s + b.amount, 0), through },
      ]);
    }

    case "goal_progress": {
      const one = findByName(input.goals, call.goal);
      const goals = one ? [one] : sortGoalsByPriority(input.goals).filter((g) => !g.isCompleted);
      if (goals.length === 0) return answer([{ kind: "nothing", about: "goal_progress" }]);
      const held = new Map(sts.goals.funded.map((f) => [f.goal.id, f.amount]));
      return answer(
        goals.slice(0, 6).map((g) => ({
          kind: "goal",
          name: g.name,
          saved: g.amountSaved,
          target: g.amount,
          dueDate: g.dueDate,
          thisPeriod: held.get(g.id) ?? 0,
        })),
      );
    }

    case "term_money": {
      const plans = input.termPlans.filter((p) => isTermPlanCurrent(p, now));
      if (plans.length === 0) return answer([{ kind: "nothing", about: "term_money" }]);
      return answer(
        plans.map((p) => {
          const s = getTermPlanSummary(p, now);
          return { kind: "termPlan", name: p.name, amount: p.amount, released: s.released, perWeek: s.perWeek, endDate: s.endDate };
        }),
      );
    }

    case "afford": {
      const amount = call.amount ? toCents(call.amount) : null;
      if (amount === null || amount <= 0) return answer([{ kind: "nothing", about: "afford" }]);
      return answer([{ kind: "afford", result: checkAfford(input, amount, now) }]);
    }

    case "top_places": {
      const label = call.range ?? "this_period";
      const range = resolveAskRange(label, sts.period.start, now);
      const places = getTopMerchants(input.transactions, input.categories, range, 5);
      if (places.length === 0) return answer([{ kind: "range", range, label }, { kind: "nothing", about: "top_places" }]);
      return answer([{ kind: "range", range, label }, ...places.map((p): AskFact => ({ kind: "place", ...p }))]);
    }

    case "recent": {
      // the latest entries, optionally in one category
      const category = findByName(input.categories, call.category);
      const recent = [...input.transactions]
        .filter((t) => t.amount > 0 && (!category || t.categoryId === category.id))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, 8);
      if (recent.length === 0) return answer([{ kind: "nothing", about: "recent" }]);
      return answer(
        recent.map((t): AskFact => ({ kind: "transaction", date: t.date, amount: t.amount, merchant: t.merchantName, categoryId: t.categoryId ?? null })),
      );
    }

    case "accounts":
      if (input.accounts.length === 0) return answer([{ kind: "nothing", about: "accounts" }]);
      return answer(input.accounts.map((a): AskFact => ({ kind: "account", name: a.name ?? null, type: a.type, balance: a.balance })));

    // a write: the app shows it for the user to confirm, so there's nothing to look up
    case "log_expense":
      return answer([]);
  }
}

// everyday words for groups of categories. `asked` is what a question says, `matches` is what a category name
// contains; both lists cover English and French. A question about "food" then counts groceries, eating out,
// takeout and coffee together, whatever the user named those categories.
export const ASK_TOPICS = {
  food: {
    asked: /\b(food|eat(ing)?|meals?|groceries|grocery|take ?-?outs?|restaurants?|dining|fast food|snacks?|lunch(es)?|dinners?|breakfasts?|coffees?|uber ?eats|door ?dash|skip the dishes|nourriture|bouffe|manger|repas|épicerie|restos?|cafés?)\b/,
    matches: /grocer|food|eat|restaurant|dining|take ?-?out|coffee|caf[eé]|snack|meal|lunch|dinner|breakfast|épicerie|resto|nourriture|bouffe|repas/,
  },
  transport: {
    asked: /\b(transport(ation)?|transit|getting around|commut\w*|bus(es)?|subway|metro|train|ubers?|lyft|taxis?|gas|parking|car|presto|déplacements?|essence|stationnement|autobus|voiture)\b/,
    matches: /transit|transport|gas|fuel|car\b|uber|lyft|taxi|parking|bus|train|presto|essence|voiture|stationnement|déplacement/,
  },
  fun: {
    asked: /\b(fun|entertainment|going out|nights? out|drinks|bars?|movies?|concerts?|games?|sorties?|divertissement|loisirs?)\b/,
    matches: /fun|entertain|going out|night|bar\b|drink|movie|concert|game|sortie|divertissement|loisir/,
  },
  shopping: {
    asked: /\b(shopping|clothes|clothing|stuff i bought|magasinage|vêtements?)\b/,
    matches: /shop|cloth|apparel|magasin|vêtement/,
  },
  home: {
    asked: /\b(rent|housing|utilities|hydro|internet|phone bill|loyer|logement|électricité)\b/,
    matches: /rent|home|housing|bill|utilit|hydro|internet|phone|loyer|logement|maison|facture/,
  },
} as const;
export type AskTopic = keyof typeof ASK_TOPICS;

// letters only, so "Take-out", "takeout" and "take out" compare equal
function squash(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// which categories a spending question is about: the ones it names (loosely: plurals, spacing, hyphens), plus
// every category in a group it names by an everyday word
export function resolveAskCategories(question: string, categories: readonly string[]): { topic?: AskTopic; names: string[] } {
  const q = question.toLowerCase();
  const flat = squash(question);
  const named = categories.filter((name) => {
    const n = squash(name);
    if (n.length < 3) return false;
    const singular = n.endsWith("s") ? n.slice(0, -1) : n;
    return flat.includes(n) || (singular.length >= 3 && flat.includes(singular));
  });
  const topic = (Object.keys(ASK_TOPICS) as AskTopic[]).find((k) => ASK_TOPICS[k].asked.test(q));
  if (!topic) return { names: named };
  const inTopic = categories.filter((name) => ASK_TOPICS[topic].matches.test(name.toLowerCase()));
  // a specific word that is also one of the user's categories ("coffee", "groceries") means just that category;
  // a broad word ("food", "eating out" aside) means the whole group
  const word = ASK_TOPICS[topic].asked.exec(q)?.[0] ?? "";
  if (named.length > 0 && !BROAD.test(word)) return { names: named };
  return inTopic.length > 0 ? { topic, names: [...new Set([...inTopic, ...named])] } : { names: named };
}

// topic words that mean the whole group, never one category that happens to share the name
const BROAD = /^(food|eat|eating|meals?|nourriture|bouffe|manger|repas|transport(ation)?|getting around|déplacements?|fun|entertainment|divertissement|loisirs?|shopping|magasinage|housing|logement)$/;

// whole-word-ish match that also works for accented French words
function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

const AMOUNT = /\$?\s?(\d{1,6}(?:[.,]\d{1,2})?)\s?\$?/;

// the range a question names, this budget period if it names none
function rangeOf(q: string): AskRange {
  if (has(q, /last week|past week|semaine (passée|dernière)|dernière semaine/)) return "last_week";
  if (has(q, /this week|cette semaine/)) return "this_week";
  if (has(q, /last month|past month|mois (passé|dernier)|dernier mois/)) return "last_month";
  if (has(q, /this month|ce mois/)) return "this_month";
  if (has(q, /30 days|30 jours|thirty days|past month/)) return "last_30_days";
  return "this_period";
}

// the longest name from a list that the question mentions
function mentioned(q: string, names: readonly string[]): string | undefined {
  return [...names].sort((a, b) => b.length - a.length).find((n) => n.trim().length > 1 && q.includes(n.trim().toLowerCase()));
}

// 2.13 without a model: pick the tool from keywords, in English and French, so Ask Current still answers on
// iPhones without Apple Intelligence. Returns null when the question doesn't clearly match a tool.
export function routeAskQuestion(question: string, categories: readonly string[], goals: readonly string[]): AskToolCall | null {
  const q = question.toLowerCase();
  if (isOutOfScope(q)) return { tool: "decline" };

  if (has(q, /afford|can i (buy|get)|should i (buy|get)|me payer|m'acheter|acheter/)) {
    const amount = AMOUNT.exec(q)?.[1]?.replace(",", ".");
    return { tool: "afford", amount };
  }
  if (has(q, /\bbills?\b|\bdue\b|\brent\b|subscriptions?|factures?|loyer|abonnements?|à payer/)) return { tool: "upcoming_bills" };
  if (has(q, /semester|\bterm\b|osap|student loan|grant|bursary|session|bourse|prêt étudiant/)) return { tool: "term_money" };
  const goal = mentioned(q, goals);
  if (goal || has(q, /goals?|saving for|saved up|objectifs?|économis/)) return { tool: "goal_progress", goal };

  const resolved = resolveAskCategories(q, categories);
  const category = resolved.names.length > 0 ? resolved.names[0] : undefined;
  const safe = /safe|\bleft\b|per day|a day|daily|can i spend|how much (can|do) i (have|spend)|reste|par jour|je peux dépenser|puis-je dépenser/;
  if (!category && has(q, safe)) return { tool: "safe_to_spend" };
  if (category || has(q, /spen[dt]|spending|cost|paid|dépens|payé|coûté|how much (on|for)|combien (en|pour)/))
    return { tool: "spending", range: rangeOf(q), category, categories: resolved.names, topic: resolved.topic };
  if (has(q, /budget|money|argent/)) return { tool: "safe_to_spend" };
  return null;
}
