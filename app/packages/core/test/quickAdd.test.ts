import { describe, expect, it } from "vitest";
import { applyModelParse, parseQuickAdd, quickAdd, QUICK_ADD_MIN_CONFIDENCE } from "../src";
import { d, txn, ymd } from "./helpers";

// Wednesday, Jan 13 2027
const now = d(2027, 1, 13);

describe("2.1 quick add: amounts", () => {
  it.each([
    ["coffee 4.50", 450],
    ["uber home last night 18", 1_800],
    ["$12 lunch", 1_200],
    ["groceries $1,234.56", 123_456],
    ["rent 950", 95_000],
    ["pizza 12,50", 1_250],
    ["5 bucks parking", 500],
  ])("%s -> %i cents", (text, cents) => {
    expect(parseQuickAdd(text, now).amount).toBe(cents);
  });

  it("prefers the number with a currency sign", () => {
    expect(parseQuickAdd("2 coffees $9", now).amount).toBe(900);
  });

  it("ignores times and dates when finding the amount", () => {
    expect(parseQuickAdd("movie at 7pm 15", now).amount).toBe(1_500);
    expect(parseQuickAdd("textbook 1/12 80", now).amount).toBe(8_000);
  });

  it("has no amount when there is no number", () => {
    expect(parseQuickAdd("coffee with sam", now).amount).toBeNull();
  });
});

describe("2.1 quick add: dates", () => {
  it.each([
    ["coffee 4", "2027-01-13"],
    ["coffee today 4", "2027-01-13"],
    ["drinks tonight 30", "2027-01-13"],
    ["coffee yesterday 4", "2027-01-12"],
    ["uber home last night 18", "2027-01-12"],
    ["lunch monday 12", "2027-01-11"],
    ["lunch on mon 12", "2027-01-11"],
    ["lunch wednesday 12", "2027-01-13"],
    ["lunch last wednesday 12", "2027-01-06"],
    ["lunch friday 12", "2027-01-08"],
    ["gas 3 days ago 40", "2027-01-10"],
  ])("%s -> %s", (text, date) => {
    expect(ymd(parseQuickAdd(text, now).date)).toBe(date);
  });
});

describe("2.1 quick add: merchant", () => {
  it.each([
    ["coffee 4.50", "Coffee"],
    ["uber home last night 18", "Uber home"],
    ["$12 lunch at subway yesterday", "Lunch at subway"],
    ["18", null],
  ])("%s -> %s", (text, merchant) => {
    expect(parseQuickAdd(text, now).merchantName).toBe(merchant);
  });
});

describe("2.1 quick add: history first, model second", () => {
  const history = [
    txn({ id: "1", merchantName: "Coffee", categoryId: "coffee", date: d(2027, 1, 2) }),
    txn({ id: "2", merchantName: "coffee", categoryId: "coffee", date: d(2027, 1, 5) }),
    txn({ id: "3", merchantName: "Coffee", categoryId: "coffee", date: d(2027, 1, 9) }),
  ];

  it("uses history with no model call when it finds an amount and is confident", () => {
    const r = quickAdd("coffee 4.50", now, history);
    expect(r).toMatchObject({ amount: 450, categoryId: "coffee", needsModel: false });
    expect(r.confidence).toBeGreaterThanOrEqual(QUICK_ADD_MIN_CONFIDENCE);
  });

  it("asks the model when there is no amount", () => {
    expect(quickAdd("coffee", now, history).needsModel).toBe(true);
  });

  it("asks the model when history isn't confident enough", () => {
    const mixed = [...history, txn({ id: "4", merchantName: "coffee", categoryId: "fun" }), txn({ id: "5", merchantName: "coffee", categoryId: "fun" })];
    expect(quickAdd("coffee 4", now, mixed).needsModel).toBe(true);
  });

  it("asks the model when only the built-in list knows the merchant", () => {
    const r = quickAdd("tim hortons 2.10", now, [], { seeds: { "tim hortons": "coffee" } });
    expect(r).toMatchObject({ categoryId: "coffee", needsModel: true });
  });
});

describe("2.1 quick add: merging the model's answer", () => {
  const categories = [
    { id: "coffee", name: "Coffee", kind: "wants" as const },
    { id: "transit", name: "Transit", kind: "needs" as const },
  ];

  it("fills what code couldn't find, mapping the category name to its id", () => {
    const local = quickAdd("uber home", now, []);
    const r = applyModelParse(local, { amount: "18", merchant: "Uber", category: "transit" }, categories);
    expect(r).toMatchObject({ amount: 1_800, merchantName: "Uber", categoryId: "transit" });
  });

  it("keeps code's amount and date over the model's", () => {
    const local = quickAdd("uber 18 yesterday", now, []);
    const r = applyModelParse(local, { amount: "81", merchant: "Uber", category: "Transit" }, categories);
    expect(r.amount).toBe(1_800);
    expect(ymd(r.date)).toBe("2027-01-12");
  });

  it("ignores a category the user doesn't have and an amount that isn't a number", () => {
    const local = quickAdd("thing", now, []);
    const r = applyModelParse(local, { amount: "lots", merchant: "", category: "Crypto" }, categories);
    expect(r).toMatchObject({ amount: null, categoryId: null, merchantName: "Thing" });
  });
});
