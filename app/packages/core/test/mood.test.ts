import { describe, expect, it } from "vitest";

import { calculateSafeToSpend, getStsMood, TIGHT_BELOW_PER_DAY } from "../src";
import { chequing, d, stsInput } from "./helpers";

// STS for a monthly period on Jan 22, 2027 (10 days left including today)
const resultFor = (balance: number) =>
  calculateSafeToSpend(stsInput({ accounts: [chequing(balance)] }), d(2027, 1, 22));

describe("getStsMood", () => {
  it("is zero when nothing is safe to spend", () => {
    expect(getStsMood(resultFor(0))).toBe("zero");
  });

  it("is zero when the balance is negative", () => {
    expect(getStsMood(resultFor(-5_000))).toBe("zero");
  });

  it("is tight when the daily number is under the threshold", () => {
    // $100 over 10 days = $10/day
    expect(getStsMood(resultFor(10_000))).toBe("tight");
  });

  it("is comfortable at or above the threshold", () => {
    expect(getStsMood(resultFor(TIGHT_BELOW_PER_DAY * 10))).toBe("comfortable");
  });

  it("takes a custom threshold", () => {
    expect(getStsMood(resultFor(10_000), 500)).toBe("comfortable");
  });
});
