import { describe, expect, it } from "vitest";
import { reconcileSavings } from "../src";
import { chequing, goal, savings } from "./helpers";

describe("STS-steps 6: savings reconciliation", () => {
  it("sums savings balances only and compares against what goals claim", () => {
    const r = reconcileSavings([savings(50_000, "s1"), savings(10_000, "s2"), chequing(999_999)], [goal({ amountSaved: 40_000 })]);
    expect(r.savingsAccountTotal).toBe(60_000);
    expect(r.goalsTotal).toBe(40_000);
    expect(r.gap).toBe(20_000);
    expect(r.underfundedGoals).toEqual([]);
  });

  it("ranks underfunded goals by priority after drawing down the pool", () => {
    const r = reconcileSavings(
      [savings(30_000)],
      [goal({ id: "low", priority: 1, amountSaved: 20_000 }), goal({ id: "high", priority: 9, amountSaved: 25_000 })],
    );
    expect(r.gap).toBe(-15_000);
    expect(r.fundedGoals.map((g) => g.id)).toEqual(["high"]);
    expect(r.underfundedGoals.map((u) => [u.goal.id, u.amountCovered, u.shortfall])).toEqual([["low", 5_000, 15_000]]);
  });
});
