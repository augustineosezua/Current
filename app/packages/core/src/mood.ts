import type { Cents } from "./money";
import type { StsResult } from "./sts";

// how the daily number feels; drives its colour and one line of copy
export type StsMood = "comfortable" | "tight" | "zero";

// default: under $15 a day reads as tight
export const TIGHT_BELOW_PER_DAY: Cents = 1_500;

// mood of a Safe-to-Spend result
export function getStsMood(result: StsResult, tightBelowPerDay: Cents = TIGHT_BELOW_PER_DAY): StsMood {
  if (result.safeToSpend <= 0 || result.daily.perDay <= 0) return "zero";
  if (result.daily.perDay < tightBelowPerDay) return "tight";
  return "comfortable";
}
