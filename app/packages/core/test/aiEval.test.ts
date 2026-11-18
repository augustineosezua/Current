import { describe, expect, it } from "vitest";
import { AI_EVAL_SET, EVAL_CATEGORIES, gradeAiEval } from "../src";

describe("2.9 AI test set", () => {
  it("has about 50 cases covering parsing and routing", () => {
    expect(AI_EVAL_SET.length).toBe(50);
    expect(AI_EVAL_SET.filter((c) => c.task === "route").length).toBeGreaterThanOrEqual(10);
  });

  it("only expects categories from the eval's list", () => {
    for (const c of AI_EVAL_SET) if (c.task === "parse" && c.category) expect(EVAL_CATEGORIES).toContain(c.category);
  });

  it("grades amounts in cents and categories by name", () => {
    const coffee = AI_EVAL_SET[0]!;
    expect(gradeAiEval(coffee, { amount: "4.50", merchant: "Coffee", category: "Coffee" })).toBe(true);
    expect(gradeAiEval(coffee, { amount: "4.5", merchant: "x", category: "Coffee" })).toBe(true);
    expect(gradeAiEval(coffee, { amount: "4.50", merchant: "x", category: "Fun" })).toBe(false);
    expect(gradeAiEval(coffee, { amount: "", merchant: "x", category: "Coffee" })).toBe(false);
  });
});
