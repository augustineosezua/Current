import { describe, expect, it } from "vitest";
import {
  answerAskTool,
  buildPrompt,
  isOutOfScope,
  resolveAskCategories,
  routeAskQuestion,
  resolveAskRange,
  validateAiRequest,
  validateAiResult,
  type AiRequest,
} from "../src";
import { bill, chequing, d, goal, stsInput, termPlan, txn, ymd } from "./helpers";

const now = d(2027, 1, 13);
const categories = [
  { id: "food", name: "Food", kind: "needs" as const },
  { id: "fun", name: "Fun", kind: "wants" as const },
];
const input = stsInput({
  accounts: [chequing(100_000)],
  categories,
  transactions: [
    txn({ id: "1", amount: 2_000, categoryId: "food", date: d(2027, 1, 12) }),
    txn({ id: "2", amount: 500, categoryId: "fun", date: d(2027, 1, 11) }),
    txn({ id: "3", amount: 4_000, categoryId: "food", date: d(2027, 1, 4) }),
  ],
  bills: [bill({ name: "Rent", amount: 50_000, dueDate: d(2027, 1, 20) }), bill({ id: "b2", name: "Gym", dueDate: d(2027, 3, 1) })],
  goals: [goal({ name: "Laptop" }), goal({ id: "g2", name: "Trip", isCompleted: true })],
  termPlans: [termPlan()],
});

describe("2.13 Ask Current: scope", () => {
  it.each(["Should I invest in an ETF?", "how do I lower my taxes", "what's my credit score", "which loan is best", "should I get a credit card"])(
    "declines %s",
    (q) => expect(isOutOfScope(q)).toBe(true),
  );
  it.each(["How much did I spend on food this week?", "how long will my maintenance loan last", "can I afford a $40 concert?"])(
    "answers %s",
    (q) => expect(isOutOfScope(q)).toBe(false),
  );
});

describe("2.13 Ask Current: ranges", () => {
  it.each([
    ["this_week", "2027-01-11", "2027-01-13"],
    ["last_week", "2027-01-04", "2027-01-10"],
    ["this_month", "2027-01-01", "2027-01-13"],
    ["last_month", "2026-12-01", "2026-12-31"],
    ["last_30_days", "2026-12-15", "2027-01-13"],
    ["this_period", "2027-01-01", "2027-01-13"],
  ] as const)("%s", (range, start, end) => {
    const r = resolveAskRange(range, d(2027, 1, 1), now);
    expect([ymd(r.start), ymd(r.end)]).toEqual([start, end]);
  });
});

describe("2.13 Ask Current: tools answered by core", () => {
  it("spending in one category over a range, with the range before it", () => {
    const a = answerAskTool({ tool: "spending", category: "food", range: "this_week" }, input, now);
    expect(a.facts).toContainEqual({ kind: "spent", amount: 2_000, categoryId: "food" });
    expect(a.facts).toContainEqual({ kind: "previousSpent", amount: 0, categoryId: "food" });
    expect(a.facts.some((f) => f.kind === "topCategory")).toBe(false);
  });

  it("spending overall lists the top categories", () => {
    const a = answerAskTool({ tool: "spending", range: "this_month" }, input, now);
    expect(a.facts).toContainEqual({ kind: "spent", amount: 6_500, categoryId: null });
    expect(a.facts.filter((f) => f.kind === "topCategory")).toHaveLength(2);
  });

  it("safe to spend and the daily number", () => {
    const a = answerAskTool({ tool: "safe_to_spend" }, input, now);
    expect(a.facts.map((f) => f.kind)).toEqual(["safeToSpend", "perDay"]);
  });

  it("upcoming bills in the next two weeks, with a total", () => {
    const a = answerAskTool({ tool: "upcoming_bills" }, input, now);
    expect(a.facts.filter((f) => f.kind === "bill").map((f) => (f.kind === "bill" ? f.name : ""))).toEqual(["Rent"]);
    expect(a.facts).toContainEqual(expect.objectContaining({ kind: "billsTotal", amount: 50_000 }));
  });

  it("goal progress skips finished goals unless one is named", () => {
    expect(answerAskTool({ tool: "goal_progress" }, input, now).facts).toHaveLength(1);
    const trip = answerAskTool({ tool: "goal_progress", goal: "trip" }, input, now);
    expect(trip.facts[0]).toMatchObject({ kind: "goal", name: "Trip" });
  });

  it("term money", () => {
    expect(answerAskTool({ tool: "term_money" }, input, now).facts[0]).toMatchObject({ kind: "termPlan", name: "Winter OSAP" });
  });

  it("afford runs the 2.2 check", () => {
    const a = answerAskTool({ tool: "afford", amount: "$40" }, input, now);
    expect(a.facts[0]).toMatchObject({ kind: "afford", result: { amount: 4_000 } });
    expect(answerAskTool({ tool: "afford", amount: "" }, input, now).facts[0]).toEqual({ kind: "nothing", about: "afford" });
  });

  it("decline has no facts", () => {
    expect(answerAskTool({ tool: "decline" }, input, now)).toEqual({ tool: "decline", facts: [], declined: true });
  });
});

describe("2.9 prompts and validation", () => {
  const parse: AiRequest = { task: "parse", language: "en", text: "uber 18", categories: ["Transit", "Food"] };

  it("constrains the category to the user's list", () => {
    expect(buildPrompt(parse).schema.properties.category!.enum).toEqual(["Transit", "Food", "none"]);
  });

  it("tells every writing task never to calculate", () => {
    for (const task of ["explain", "answer", "recap"] as const) {
      const req = { task, language: "en", question: "q", figures: [{ label: "a", value: "b" }] } as AiRequest;
      expect(buildPrompt(req).system).toMatch(/Never calculate/);
    }
  });

  it("asks for French when the app is in French", () => {
    expect(buildPrompt({ task: "recap", language: "fr", figures: [{ label: "a", value: "b" }] }).system).toMatch(/Canadian French/);
  });

  it("accepts a well-formed request and rejects oversized or malformed ones", () => {
    expect(validateAiRequest(parse)).toEqual(parse);
    expect(validateAiRequest({ ...parse, text: "x".repeat(201) })).toBeNull();
    expect(validateAiRequest({ ...parse, language: "de" })).toBeNull();
    expect(validateAiRequest({ ...parse, task: "chat" })).toBeNull();
    expect(validateAiRequest({ task: "recap", language: "en", figures: [] })).toBeNull();
    expect(validateAiRequest({ task: "recap", language: "en", figures: [{ label: "a" }] })).toBeNull();
  });

  it("checks a model reply against the schema", () => {
    expect(validateAiResult("parse", { amount: "18", merchant: "Uber", category: "Transit", extra: 1 }, parse)).toEqual({
      amount: "18",
      merchant: "Uber",
      category: "Transit",
    });
    expect(validateAiResult("parse", { amount: "18", merchant: "Uber", category: "Crypto" }, parse)).toBeNull();
    expect(validateAiResult("parse", { amount: 18, merchant: "Uber", category: "Transit" }, parse)).toBeNull();
  });
});

describe("2.13 routing without a model", () => {
  const cats = ["Food", "Transit", "Fun"];
  const goals = ["Laptop", "Trip"];
  const cases: [string, Partial<ReturnType<typeof routeAskQuestion>> | null][] = [
    ["How much did I spend on food this week?", { tool: "spending", range: "this_week", category: "Food" }],
    ["What did I spend last month?", { tool: "spending", range: "last_month", category: undefined }],
    ["What's safe to spend today?", { tool: "safe_to_spend" }],
    ["How much can I spend per day?", { tool: "safe_to_spend" }],
    ["How much do I have left today?", { tool: "safe_to_spend" }],
    ["What bills are coming up?", { tool: "upcoming_bills" }],
    ["How long will my semester money last?", { tool: "term_money" }],
    ["How's my laptop goal?", { tool: "goal_progress", goal: "Laptop" }],
    ["Can I afford a $45.50 jacket?", { tool: "afford", amount: "45.50" }],
    ["Est-ce que je peux me payer un truc à 30 $?", { tool: "afford", amount: "30" }],
    ["Combien j'ai dépensé cette semaine?", { tool: "spending", range: "this_week" }],
    ["Should I buy crypto?", { tool: "decline" }],
    ["Tell me a joke", null],
  ];
  for (const [question, expected] of cases) {
    it(question, () => {
      const routed = routeAskQuestion(question, cats, goals);
      if (expected === null) expect(routed).toBeNull();
      else expect(routed).toMatchObject(expected);
    });
  }
});

describe("2.13 topics: everyday words cover groups of categories", () => {
  const names = ["Groceries", "Eating out", "Coffee", "Take-out", "Transit", "Fun", "Rent & bills"];
  it("food covers every food category, takeout included", () => {
    const r = resolveAskCategories("How much did I spend on food this week?", names);
    expect(r.topic).toBe("food");
    expect(r.names.sort()).toEqual(["Coffee", "Eating out", "Groceries", "Take-out"]);
  });
  it("a specific category stays specific", () => {
    expect(resolveAskCategories("how much on coffee last month", names)).toEqual({ names: ["Coffee"] });
    expect(resolveAskCategories("what did takeout cost me", names)).toEqual({ names: ["Take-out"] });
  });
  it("a category literally called Food still pulls in the rest of the group", () => {
    const r = resolveAskCategories("food this month?", ["Food", "Takeout", "Transit"]);
    expect(r.names.sort()).toEqual(["Food", "Takeout"]);
  });
  it("works in French", () => {
    expect(resolveAskCategories("Combien j'ai dépensé en bouffe cette semaine?", ["Épicerie", "Restos", "Transport"]).names.sort()).toEqual(["Restos", "Épicerie"]);
  });
  it("routes a food question to spending with the whole group", () => {
    expect(routeAskQuestion("How much did I spend on food this week?", names, [])).toMatchObject({
      tool: "spending",
      range: "this_week",
      topic: "food",
    });
    expect(routeAskQuestion("how much on transport last week", names, [])).toMatchObject({ tool: "spending", categories: ["Transit"] });
  });
  it("adds the group up and splits it by category", () => {
    const input = stsInput({
      categories: [
        { id: "g", name: "Groceries", kind: "needs" },
        { id: "t", name: "Take-out", kind: "wants" },
        { id: "x", name: "Transit", kind: "needs" },
      ],
      transactions: [
        txn({ id: "1", amount: 3_000, categoryId: "g", date: d(2027, 1, 5) }),
        txn({ id: "2", amount: 1_500, categoryId: "t", date: d(2027, 1, 6) }),
        txn({ id: "3", amount: 900, categoryId: "x", date: d(2027, 1, 6) }),
      ],
    });
    const answer = answerAskTool({ tool: "spending", range: "this_week", categories: ["Groceries", "Take-out"], topic: "food" }, input, d(2027, 1, 7));
    const spent = answer.facts.find((f) => f.kind === "spent");
    expect(spent).toMatchObject({ amount: 4_500, topic: "food", parts: [{ categoryId: "g", amount: 3_000 }, { categoryId: "t", amount: 1_500 }] });
  });
});
