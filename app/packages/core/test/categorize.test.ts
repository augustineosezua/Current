import { describe, expect, it } from "vitest";
import {
  CATEGORY_COLORS,
  DEFAULT_CATEGORIES,
  getMerchantSeeds,
  normalizeMerchantText,
  SEED_CONFIDENCE,
  storefrontFromLocale,
  suggestCategory,
} from "../src";
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
    expect(suggestCategory(history, "tim hortons 2.10", now)).toEqual({
      categoryId: "food",
      confidence: 0.75,
      matches: 4,
      source: "history",
    });
  });

  it("only looks at the last 6 months", () => {
    const r = suggestCategory(history, "Tim Hortons", now);
    expect(r?.matches).toBe(4);
  });

  it("returns nothing with fewer than 3 matches", () => {
    expect(suggestCategory(history, "presto 3.35", now)).toBeNull();
    expect(suggestCategory(history, "", now)).toBeNull();
  });

  it("never suggests a category that no longer exists", () => {
    expect(suggestCategory(history, "tim hortons", now, { categoryIds: ["treats", "transit"] })).toBeNull();
    const r = suggestCategory(history, "tim hortons", now, { categoryIds: ["food"] });
    expect(r).toMatchObject({ categoryId: "food", confidence: 1, matches: 3 });
  });
});

describe("default categories", () => {
  it("has about 12, with unique ids and one sticker colour each", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(12);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.id)).size).toBe(12);
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.color))).toEqual(new Set(CATEGORY_COLORS));
    expect(DEFAULT_CATEGORIES.map((c) => c.sortOrder)).toEqual([...Array(12).keys()]);
  });

  it("covers every kind", () => {
    expect(new Set(DEFAULT_CATEGORIES.map((c) => c.kind))).toEqual(new Set(["needs", "wants", "savings", "income"]));
  });
});

describe("storefrontFromLocale", () => {
  it("reads the region of a locale tag", () => {
    expect(storefrontFromLocale("en-CA")).toBe("CA");
    expect(storefrontFromLocale("fr_CA")).toBe("CA");
    expect(storefrontFromLocale("en-US")).toBe("US");
    expect(storefrontFromLocale("en-Latn-GB")).toBe("GB");
    expect(storefrontFromLocale("en-AU")).toBe("OTHER");
    expect(storefrontFromLocale("en")).toBe("OTHER");
    expect(storefrontFromLocale(null)).toBe("OTHER");
  });
});

describe("merchant seeds", () => {
  const now = d(2027, 1, 10);
  const ca = getMerchantSeeds("CA");

  it("only points at default categories", () => {
    const ids = new Set(DEFAULT_CATEGORIES.map((c) => c.id));
    for (const sf of ["CA", "US", "GB", "OTHER"] as const) {
      for (const id of Object.values(getMerchantSeeds(sf))) expect(ids.has(id)).toBe(true);
    }
  });

  it("suggests for a new user from the storefront's list", () => {
    expect(suggestCategory([], "Tim Hortons 2.10", now, { seeds: ca })).toEqual({
      categoryId: "default-coffee",
      confidence: SEED_CONFIDENCE,
      matches: 0,
      source: "seed",
    });
    expect(suggestCategory([], "PRESTO reload", now, { seeds: ca })?.categoryId).toBe("default-transit");
    expect(suggestCategory([], "Loblaws", now, { seeds: ca })?.categoryId).toBe("default-groceries");
    expect(suggestCategory([], "Tesco", now, { seeds: getMerchantSeeds("GB") })?.categoryId).toBe("default-groceries");
    expect(suggestCategory([], "Trader Joe's", now, { seeds: getMerchantSeeds("US") })?.categoryId).toBe(
      "default-groceries",
    );
    expect(suggestCategory([], "Tesco", now, { seeds: ca })).toBeNull();
  });

  it("prefers the most specific seed and matches while typing", () => {
    expect(suggestCategory([], "uber eats", now, { seeds: ca })?.categoryId).toBe("default-eating-out");
    expect(suggestCategory([], "uber home", now, { seeds: ca })?.categoryId).toBe("default-transit");
    expect(suggestCategory([], "tim", now, { seeds: ca })?.categoryId).toBe("default-coffee");
    expect(suggestCategory([], "ti", now, { seeds: ca })).toBeNull();
    expect(suggestCategory([], "busy", now, { seeds: ca })).toBeNull();
  });

  it("lets the user's own history win once there are 3 matches", () => {
    const history = [1, 2, 3].map((n) =>
      txn({ id: String(n), merchantName: "Tim Hortons", categoryId: "food", date: d(2027, 1, n) }),
    );
    expect(suggestCategory(history, "tim hortons", now, { seeds: ca })).toMatchObject({
      categoryId: "food",
      source: "history",
    });
    expect(suggestCategory(history.slice(0, 2), "tim hortons", now, { seeds: ca })).toMatchObject({
      categoryId: "default-coffee",
      source: "seed",
    });
  });

  it("skips a seed whose category was deleted", () => {
    expect(suggestCategory([], "tim hortons", now, { seeds: ca, categoryIds: ["default-transit"] })).toBeNull();
  });
});
