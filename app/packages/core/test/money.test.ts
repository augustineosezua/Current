import { describe, expect, it } from "vitest";
import { assertCents, formatMoney, isCents, sumCents, toCents } from "../src";

describe("money", () => {
  it("parses common user input into integer cents", () => {
    expect(toCents("4.50")).toBe(450);
    expect(toCents("$1,234.56")).toBe(123_456);
    expect(toCents("12,50")).toBe(1_250);
    expect(toCents("1 234,56 $")).toBe(123_456);
    expect(toCents("1,234")).toBe(123_400);
    expect(toCents("18")).toBe(1_800);
    expect(toCents("-5.25")).toBe(-525);
    expect(toCents("abc")).toBeNull();
  });

  it("rounds dollar numbers once at the boundary", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(19.99)).toBe(1_999);
  });

  it("rejects floats as cents", () => {
    expect(isCents(450)).toBe(true);
    expect(isCents(4.5)).toBe(false);
    expect(() => assertCents(4.5)).toThrow();
  });

  it("sums without float drift", () => {
    expect(sumCents([10, 20, 30])).toBe(60);
  });

  it("formats by locale and currency", () => {
    expect(formatMoney(123_456, "en-CA", "CAD")).toBe("$1,234.56");
    expect(formatMoney(2_300, "en-US", "USD")).toBe("$23.00");
    expect(formatMoney(2_300, "en-GB", "GBP")).toBe("£23.00");
    expect(formatMoney(123_456, "fr-CA", "CAD").replace(/\s/g, " ")).toBe("1 234,56 $");
  });
});
