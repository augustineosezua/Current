// 2.9 quality: a fixed set of inputs with expected results. Run it against both AI backends before each release
// and after every major iOS update (Apple changes the on-device model with the OS). The app's development-only
// "AI test set" screen runs it on the phone; app/api/scripts/ai-eval.ts runs it against the cloud model.
import type { AiResults } from "./aiPrompts";
import { toCents, type Cents } from "./money";

// the starting category names (English), which the eval uses as the user's list
export const EVAL_CATEGORIES = [
  "Groceries",
  "Eating out",
  "Coffee",
  "Transit",
  "Rent & bills",
  "School",
  "Health",
  "Fun",
  "Shopping",
  "Subscriptions",
];

export type AiEvalCase =
  | { task: "parse"; text: string; amount: Cents | null; category: string | null }
  | { task: "route"; question: string; tool: AiResults["route"]["tool"] };

const p = (text: string, amount: Cents | null, category: string | null): AiEvalCase => ({ task: "parse", text, amount, category });
const r = (question: string, tool: AiResults["route"]["tool"]): AiEvalCase => ({ task: "route", question, tool });

export const AI_EVAL_SET: readonly AiEvalCase[] = [
  p("coffee 4.50", 450, "Coffee"),
  p("uber home last night 18", 1_800, "Transit"),
  p("groceries at no frills 63.20", 6_320, "Groceries"),
  p("netflix 16.99", 1_699, "Subscriptions"),
  p("pizza with friends 22", 2_200, "Eating out"),
  p("textbook for econ 89.99", 8_999, "School"),
  p("bus pass 128", 12_800, "Transit"),
  p("movie tickets 31", 3_100, "Fun"),
  p("new jeans 55", 5_500, "Shopping"),
  p("pharmacy 12.40", 1_240, "Health"),
  p("rent 950", 95_000, "Rent & bills"),
  p("phone bill 45", 4_500, "Rent & bills"),
  p("starbucks latte 6.25", 625, "Coffee"),
  p("tims double double 2.10", 210, "Coffee"),
  p("loblaws 41.87", 4_187, "Groceries"),
  p("presto reload 50", 5_000, "Transit"),
  p("doordash thai 27.50", 2_750, "Eating out"),
  p("spotify 11.99", 1_199, "Subscriptions"),
  p("gym membership 30", 3_000, "Health"),
  p("concert tickets 75", 7_500, "Fun"),
  p("amazon charger 19.99", 1_999, "Shopping"),
  p("lunch at the caf 9", 900, "Eating out"),
  p("printing at the library 3", 300, "School"),
  p("drinks at the bar 34", 3_400, "Fun"),
  p("gas for the car 60", 6_000, "Transit"),
  p("haircut 28", 2_800, null),
  p("birthday present for mom 40", 4_000, "Shopping"),
  p("$7 bubble tea", 700, "Eating out"),
  p("hydro bill 38.50", 3_850, "Rent & bills"),
  p("icloud storage 1.29", 129, "Subscriptions"),
  p("costco run 112", 11_200, "Groceries"),
  p("parking downtown 14", 1_400, "Transit"),
  p("lab coat for chem 25", 2_500, "School"),
  p("dentist copay 40", 4_000, "Health"),
  p("bowling 18", 1_800, "Fun"),
  p("burrito", null, "Eating out"),
  p("paid back sam for dinner 20", 2_000, "Eating out"),
  p("train to toronto 42", 4_200, "Transit"),
  p("calculator for exams 24", 2_400, "School"),
  p("shampoo and stuff 15", 1_500, null),
  r("How much did I spend on food this week?", "spending"),
  r("what did i spend on coffee last month", "spending"),
  r("What's safe to spend today?", "safe_to_spend"),
  r("how much can i spend per day", "safe_to_spend"),
  r("What bills are coming up?", "upcoming_bills"),
  r("is rent due soon", "upcoming_bills"),
  r("How close am I to my laptop goal?", "goal_progress"),
  r("How long will my semester money last?", "term_money"),
  r("can I afford a $40 concert ticket?", "afford"),
  r("Should I buy bitcoin?", "decline"),
];

// whether a model's answer matches a case; amounts are compared in cents after core parses them
export function gradeAiEval(c: AiEvalCase, result: AiResults["parse"] | AiResults["route"]): boolean {
  if (c.task === "route") return (result as AiResults["route"]).tool === c.tool;
  const parsed = result as AiResults["parse"];
  const amount = parsed.amount ? toCents(parsed.amount) : null;
  const category = parsed.category === "none" ? null : parsed.category;
  // a case with no expected category accepts any answer there; it only checks the amount
  return amount === c.amount && (c.category === null || category === c.category);
}
