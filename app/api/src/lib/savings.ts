import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

export const calculateSavingsReconciliation = async (userId: string) => {
  const savingsAggregate = await prisma.bankAccounts.aggregate({
    _sum: { availableBalance: true },
    where: { userId, isSavingsAccount: true },
  });
  const savingsAccountTotal =
    savingsAggregate._sum.availableBalance?.toNumber() ?? 0;

  const goals = await prisma.budgetItem.findMany({
    where: { userId, isCompleted: false, isDeleted: false },
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

  const goalsTotal = goals.reduce(
    (sum, g) => sum + g.amountSaved.toNumber(),
    0,
  );

  const gap = savingsAccountTotal - goalsTotal;

  // allocate savings to goals in priority order to find which are underfunded
  let remaining = savingsAccountTotal;
  const fundedGoals: typeof goals = [];
  const underfundedGoals: (typeof goals[number] & {
    amountCovered: number;
    shortfall: number;
  })[] = [];

  for (const goal of goals) {
    const saved = goal.amountSaved.toNumber();
    if (remaining >= saved) {
      remaining -= saved;
      fundedGoals.push(goal);
    } else {
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
