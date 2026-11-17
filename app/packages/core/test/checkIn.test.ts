import { describe, expect, it } from "vitest";
import { getBalanceDrift, getCheckInStaleness, getDriftTransactionAmount } from "../src";
import { chequing, d, savings } from "./helpers";

describe("balance check-in drift", () => {
  it("is entered minus calculated", () => {
    expect(getBalanceDrift(50_000, 48_250)).toBe(-1_750);
    expect(getBalanceDrift(50_000, 51_000)).toBe(1_000);
    expect(getBalanceDrift(50_000, 50_000)).toBe(0);
  });

  it("logs missing money as money out and extra money as money in", () => {
    expect(getDriftTransactionAmount(-1_750)).toBe(1_750);
    expect(getDriftTransactionAmount(1_000)).toBe(-1_000);
  });

  it("refuses floats", () => {
    expect(() => getBalanceDrift(100.5, 100)).toThrow(/integer cents/);
  });
});

describe("check-in staleness", () => {
  const now = d(2027, 1, 20);

  it("is null while every spendable account was checked within 7 days", () => {
    expect(getCheckInStaleness([{ ...chequing(100), lastCheckInAt: d(2027, 1, 13) }], now)).toBeNull();
  });

  it("reports the oldest spendable check-in once it is over 7 days old", () => {
    const stale = getCheckInStaleness(
      [
        { ...chequing(100, "new"), lastCheckInAt: d(2027, 1, 19) },
        { ...chequing(100, "old"), lastCheckInAt: d(2027, 1, 11) },
      ],
      now,
    );
    expect(stale).toEqual({ days: 9, accountId: "old" });
  });

  it("ignores savings accounts and accounts never checked", () => {
    expect(getCheckInStaleness([{ ...savings(100), lastCheckInAt: d(2026, 6, 1) }, chequing(100)], now)).toBeNull();
  });
});
