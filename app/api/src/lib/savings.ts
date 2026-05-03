import { prisma } from "./prisma";

// compares what's actually in savings accounts against what goals collectively claim is saved
export const calculateSavingsReconciliation = async (userId: string) => {
  // sum available balances across every account the user has flagged as a savings account
  const savingsAggregate = await prisma.bankAccounts.aggregate({
    _sum: { availableBalance: true },
    where: { userId, isSavingsAccount: true },
  });
  const savingsAccountTotal =
    savingsAggregate._sum.availableBalance?.toNumber() ?? 0;

  // fetch every non-deleted goal — completed goals stay in the total until the user marks them spent
  const goals = await prisma.budgetItem.findMany({
    where: { userId, isDeleted: false },
    select: {
      id: true,
      name: true,
      amount: true,
      amountSaved: true,
      dueDate: true,
      priority: true,
      isReccuring: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  // total of what all goals collectively claim is already saved — drives the gap calculation
  const goalsTotal = goals.reduce(
    (sum, g) => sum + g.amountSaved.toNumber(),
    0,
  );

  // positive = unallocated surplus in savings, negative = goals claim more than savings holds
  const gap = savingsAccountTotal - goalsTotal;

  // walk goals highest-priority-first, drawing down the savings pool until it runs out
  let remaining = savingsAccountTotal;
  const fundedGoals: typeof goals = [];
  const underfundedGoals: (typeof goals[number] & {
    amountCovered: number;
    shortfall: number;
  })[] = [];

  // allocate savings to each goal in priority order to identify which are under-backed
  for (const goal of goals) {
    const saved = goal.amountSaved.toNumber();
    // savings pool can fully cover this goal — deduct and keep going
    if (remaining >= saved) {
      remaining -= saved;
      fundedGoals.push(goal);
    } else {
      // pool is exhausted before this goal is fully covered — record the shortfall
      underfundedGoals.push({
        ...goal,
        amountCovered: remaining,
        shortfall: saved - remaining,
      });
      remaining = 0;
    }
  }

  return {
    savingsAccountTotal,
    goalsTotal,
    gap,
    fundedGoals,
    underfundedGoals,
  };
};
