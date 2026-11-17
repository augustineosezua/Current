import { describe, expect, it } from "vitest";
import { normalizeMerchantText, suggestCategory } from "../src";
import { d, txn } from "./helpers";

describe("normalizeMerchantText", () => {
  it("lowercases and strips amounts, dates and punctuation", () => {
    expect(normalizeMerchantText("Tim Hortons $4.50!")).toBe("tim hortons");
    expect(normalizeMerchantText("coffee 4.50")).toBe("coffee");
    expect(normalizeMerchantText("uber home last night 18")).toBe("uber home");
    expect(normalizeMerchantText("PRESTO 2027-01-05")).toBe("presto");
    expect(normalizeMerchantText("Loblaws 01/05")).toBe("loblaws");
  });
});

describe("suggestCategory", () => {
  const now = d(2027, 1, 10);
  const history = [
    txn({ id: "1", merchantName: "Tim Hortons", categoryId: "food", date: d(2027, 1, 2) }),
    txn({ id: "2", merchantName: "TIM HORTONS #123", categoryId: "food", date: d(2026, 12, 20) }),
    txn({ id: "3", merchantName: "Tim Hortons", categoryId: "food", date: d(2026, 11, 1) }),
    txn({ id: "4", merchantName: "Tim Hortons", categoryId: "treats", date: d(2026, 10, 1) }),
    txn({ id: "old", merchantName: "Tim Hortons", categoryId: "treats", date: d(2026, 6, 1) }),
    txn({ id: "other", merchantName: "Presto", categoryId: "transit", date: d(2027, 1, 3) }),
  ];

  it("returns the most-used category with confidence equal to its share of matches", () => {
    expect(suggestCategory(history, "tim hortons 2.10", now)).toEqual({ categoryId: "food", confidence: 0.75, matches: 4 });
  });

  it("only looks at the last 6 months", () => {
    const r = suggestCategory(history, "Tim Hortons", now);
    expect(r?.matches).toBe(4);
  });

  it("returns nothing with fewer than 3 matches", () => {
    expect(suggestCategory(history, "presto 3.35", now)).toBeNull();
    expect(suggestCategory(history, "", now)).toBeNull();
  });
});
