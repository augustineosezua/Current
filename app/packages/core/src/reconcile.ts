import { sortGoalsByPriority, type Goal } from "./goals";
import type { Cents } from "./money";
import type { Account } from "./types";

export interface UnderfundedGoal {
  goal: Goal;
  amountCovered: Cents;
  shortfall: Cents;
}

export interface SavingsReconciliation {
  savingsAccountTotal: Cents;
  goalsTotal: Cents;
  // positive = unallocated surplus, negative = goals claim more than savings holds
  gap: Cents;
  fundedGoals: Goal[];
  underfundedGoals: UnderfundedGoal[];
}

// compare savings balances against what goals claim is saved, by priority
export function reconcileSavings(accounts: readonly Account[], goals: readonly Goal[]): SavingsReconciliation {
  const savingsAccountTotal = accounts.filter((a) => a.type === "savings").reduce((s, a) => s + a.balance, 0);
  const goalsTotal = goals.reduce((s, g) => s + g.amountSaved, 0);
  const fundedGoals: Goal[] = [];
  const underfundedGoals: UnderfundedGoal[] = [];
  let remaining = savingsAccountTotal;

  // draw down the savings pool highest priority first
  for (const goal of sortGoalsByPriority(goals)) {
    if (remaining >= goal.amountSaved) {
      remaining -= goal.amountSaved;
      fundedGoals.push(goal);
    } else {
      const covered = Math.max(remaining, 0);
      underfundedGoals.push({ goal, amountCovered: covered, shortfall: goal.amountSaved - covered });
      remaining = 0;
    }
  }

  return { savingsAccountTotal, goalsTotal, gap: savingsAccountTotal - goalsTotal, fundedGoals, underfundedGoals };
}
