import { prisma } from "./prisma";

// All Plaid primary categories that count as spending.
// Excluded: INCOME, TRANSFER_IN, TRANSFER_OUT, LOAN_DISBURSEMENTS — not outflows.
// Excluded: RENT_AND_UTILITIES, LOAN_PAYMENTS — tracked separately in the bills table.
const SPENDING_CATEGORIES = [
  "BANK_FEES",
  "ENTERTAINMENT",
  "FOOD_AND_DRINK",
  "GENERAL_MERCHANDISE",
  "GENERAL_SERVICES",
  "GOVERNMENT_AND_NON_PROFIT",
  "HOME_IMPROVEMENT",
  "MEDICAL",
  "OTHER",
  "PERSONAL_CARE",
  "TRANSPORTATION",
  "TRAVEL",
];

// Goals with priority >= this sentinel are "above STS" — they reduce safe-to-spend directly.
// Goals below the sentinel are funded only from whatever STS remains after the above-STS goals.
const STS_ABOVE_SENTINEL = 1000;

// persist updated amountSaved for each budget item
const updateBudgetItems = async (items: any[]) => {
  for (let i = 0; i < items.length; i++) {
    let isCompleted = false;
    // cap saved amount and flag complete if non-recurring goal is fully funded
    if (
      !items[i].isReccuring &&
      items[i].amount.toNumber() <= items[i].newAmountSaved.toNumber()
    ) {
      isCompleted = true;
      items[i].newAmountSaved = items[i].amount;
    }
    // write the update to db
    await prisma.budgetItem.update({
      where: {
        id: items[i].id,
      },
      data: {
        amountSaved: items[i].newAmountSaved,
        lastPaymentDate: new Date(),
        isCompleted: isCompleted,
      },
    });
  }
};

export const commitSafeToSpendAllocations = async (
  pendingBudgetItemUpdates: any[],
) => {
  await updateBudgetItems(pendingBudgetItemUpdates);
};

export const calculateSafeToSpend = async (userId: any) => {
  // default return shape
  let returnValues = {
    safeToSpend: 0,
    availableAfterAmount: null as number | null,
    availableAfterDate: null as Date | null,
    ignoredBudgetItems: [] as any[],
    acceptedBudgetItems: [] as any[],
    pendingBudgetItemUpdates: [] as any[],
    error: null as Error | null,
    // breakdown for the "how it's calculated" popup
    checkingBalance: 0,
    billsTotal: 0,
    scheduledSavings: 0,
    spendingFloor: 0,
  };

  // sum of non-savings, non-credit checking balances
  const availableBalance = await prisma.bankAccounts.aggregate({
    _sum: {
      availableBalance: true,
    },
    where: {
      userId: userId,
      isSavingsAccount: false,
      accountType: {
        not: "credit",
      },
    },
  });

  returnValues.checkingBalance = availableBalance._sum.availableBalance?.toNumber() ?? 0;

  // no linked accounts found — can't calculate
  if (
    availableBalance._sum.availableBalance === null ||
    availableBalance._sum.availableBalance === undefined
  ) {
    returnValues.error = new Error(
      "Error Calculating Safe To Spend: No linked accounts found",
    );
    return returnValues;
  }

  // date range for the current month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  // fetch desired minimum monthly spend setting
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: userId },
  });

  // look 7 days ahead so a bill due just after month-end isn't invisible today
  const sevenDaysOut = new Date(now);
  sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  const billsCutoff = sevenDaysOut > endOfMonth ? sevenDaysOut : endOfMonth;

  // sum unpaid bills due this month (or within the next 7 days if near month-end)
  let billsTotal = 0;
  const billsFetcher = await prisma.bills.aggregate({
    _sum: { amount: true },
    where: {
      isPaid: false,
      userId: userId,
      dueDate: { lte: billsCutoff },
    },
  });

  // handle null aggregate (no unpaid bills)
  if (!billsFetcher._sum.amount) {
    billsTotal = 0;
  } else {
    billsTotal = billsFetcher._sum.amount.toNumber();
  }
  returnValues.billsTotal = billsTotal;

  // active budget goals, highest priority and soonest due first
  const budgetItems = await prisma.budgetItem.findMany({
    where: {
      userId: userId,
      isCompleted: false,
      isDeleted: false,
    },
    select: {
      amount: true,
      amountSaved: true,
      dueDate: true,
      createdAt: true,
      priority: true,
      id: true,
      name: true,
      lastPaymentDate: true,
      isReccuring: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  // spending transactions so far this month — matched against Plaid's primary category names
  const alreadySpent = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      userId: userId,
      date: { gte: startOfMonth, lte: now },
      category: { hasSome: SPENDING_CATEGORIES },
    },
  });

  // how much of the monthly spend budget is still left to use
  let remainingDesiredMonthlySpend = 0;
  if (userSettings) {
    remainingDesiredMonthlySpend = Math.max(
      userSettings.desiredMinimumMonthlySpend.toNumber() -
        (alreadySpent._sum.amount?.toNumber() ?? 0),
      0,
    );
  }
  returnValues.spendingFloor = remainingDesiredMonthlySpend;

  // build separate lists for above-STS and below-STS goals needing a contribution this month
  // above-STS goals (priority >= sentinel) reduce STS directly
  // below-STS goals are only funded from whatever STS remains afterward
  let aboveStsTotal = 0;
  let belowStsTotal = 0;
  let aboveStsToUpdate: any[] = [];
  let belowStsToUpdate: any[] = [];

  for (let i = 0; i < budgetItems.length; i++) {
    if (
      !budgetItems[i].isReccuring &&
      budgetItems[i].amountSaved.toNumber() >= budgetItems[i].amount.toNumber()
    ) {
      continue;
    }
    const item = budgetItems[i];
    if (
      item.lastPaymentDate &&
      item.lastPaymentDate.getMonth() === now.getMonth() &&
      item.lastPaymentDate.getFullYear() === now.getFullYear()
    ) {
      continue;
    }
    const monthsRemaining = Math.max(
      (item.dueDate.getFullYear() - now.getFullYear()) * 12 +
        (item.dueDate.getMonth() - now.getMonth()) +
        1,
      1,
    );
    const amountPerMonth = item.isReccuring
      ? item.amount.toNumber()
      : (item.amount.toNumber() - item.amountSaved.toNumber()) / monthsRemaining;

    const entry = {
      id: item.id,
      newAmountSaved: item.isReccuring
        ? item.amountSaved
        : item.amountSaved.add(amountPerMonth),
      amountSaved: item.amountSaved,
      dueDate: item.dueDate,
      amount: item.amount,
      name: item.name,
      isReccuring: item.isReccuring,
    };

    if (item.priority >= STS_ABOVE_SENTINEL) {
      aboveStsTotal += amountPerMonth;
      aboveStsToUpdate.push(entry);
    } else {
      belowStsTotal += amountPerMonth;
      belowStsToUpdate.push(entry);
    }
  }

  // STS is computed using only above-STS goals; below-STS goals are then funded from remaining STS
  const budgetItemsTotal = aboveStsTotal;
  const budgetItemsToUpdate = aboveStsToUpdate;

  // happy path — everything is fully funded
  if (
    availableBalance._sum.availableBalance.toNumber() >=
    billsTotal + budgetItemsTotal + remainingDesiredMonthlySpend
  ) {
    returnValues.safeToSpend = Math.max(
      availableBalance._sum.availableBalance.toNumber() -
        billsTotal -
        budgetItemsTotal,
      0,
    );
    returnValues.scheduledSavings = budgetItemsTotal;
    returnValues.spendingFloor = 0;
    returnValues.ignoredBudgetItems = [];
    returnValues.acceptedBudgetItems = budgetItemsToUpdate;
    returnValues.pendingBudgetItemUpdates = budgetItemsToUpdate;
    return returnValues;
  }

  // greedy allocator: fund goals in priority order until balance runs out
  const allocateForBudgetItems = (
    remainingBalance: number,
    budgetItems: any[],
    minimumMonthlySpend: number,
  ): [any[], any[], number] => {
    let updatedBudgetItems: any[] = [];
    let ignoredBudgetItems: any[] = [];
    let newSafeToSpend: number = 0;

    // only allocate to goals after reserving minimum monthly spend
    if (remainingBalance >= minimumMonthlySpend) {
      remainingBalance = Math.max(remainingBalance - minimumMonthlySpend, 0);
      for (let i = 0; i < budgetItems.length; i++) {
        const item = budgetItems[i];
        const monthsRemaining = Math.max(
          (item.dueDate.getFullYear() - now.getFullYear()) * 12 +
            (item.dueDate.getMonth() - now.getMonth()) +
            1,
          1,
        );
        const amountPerMonth = item.isReccuring
          ? item.amount.toNumber()
          : (item.amount.toNumber() - item.amountSaved.toNumber()) /
            monthsRemaining;

        remainingBalance -= amountPerMonth;

        // balance exhausted — remaining items are ignored, sts is whatever is left
        if (remainingBalance < 0) {
          for (let j = i; j < budgetItems.length; j++) {
            ignoredBudgetItems.push(budgetItems[j]);
          }
          newSafeToSpend = Math.max(
            remainingBalance + amountPerMonth + minimumMonthlySpend,
            0,
          );
          break;
        }

        updatedBudgetItems.push({
          id: item.id,
          dueDate: item.dueDate,
          amountSaved: item.amountSaved,
          amount: item.amount,
          isReccuring: item.isReccuring,
          name: item.name,
          newAmountSaved: item.isReccuring
            ? item.amountSaved
            : item.amountSaved.add(amountPerMonth),
        });
      }
    } else {
      // can't even cover minimum spend — skip all goals
      ignoredBudgetItems = budgetItems;
      newSafeToSpend = Math.max(remainingBalance, 0);
    }

    return [updatedBudgetItems, ignoredBudgetItems, newSafeToSpend];
  };

  const availableAfterCalculation = async () => {
    const incomeInfo = await prisma.income.findMany({
      where: {
        userId: userId,
      },
      orderBy: { nextPaymentDate: "asc" },
    });

    //advance nextpaycheck date on past paychecks based on frequency
    if (incomeInfo === null) {
      returnValues.error = new Error(
        "Error Calculating Safe To Spend: No income information found",
      );
      return returnValues;
    }

    // no income info found
    if (incomeInfo.length === 0) {
      returnValues.availableAfterAmount = 0;
      returnValues.availableAfterDate = null;
      return returnValues;
    }

    for (let i = 0; i < incomeInfo.length; i++) {
      const nextPaymentDate = incomeInfo[i].nextPaymentDate;
      if (nextPaymentDate && nextPaymentDate < now) {
        switch (incomeInfo[i].frequency) {
          case "weekly":
            while (nextPaymentDate < now) {
              nextPaymentDate.setDate(nextPaymentDate.getDate() + 7);
            }
            break;

          case "biweekly":
            while (nextPaymentDate < now) {
              nextPaymentDate.setDate(nextPaymentDate.getDate() + 14);
            }
            break;
          case "monthly":
            while (nextPaymentDate < now) {
              nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            }
            break;
          case "semimonthly":
            while (nextPaymentDate < now) {
              if (nextPaymentDate.getDate() < 15) {
                nextPaymentDate.setDate(15);
              } else {
                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
                nextPaymentDate.setDate(1);
              }
            }
            break;
          case "daily":
            while (nextPaymentDate < now) {
              nextPaymentDate.setDate(nextPaymentDate.getDate() + 1);
            }
            break;
          case "yearly":
            while (nextPaymentDate < now) {
              nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
            }
        }
      }
    }

    //update db with new next paycheck dates
    for (let i = 0; i < incomeInfo.length; i++) {
      await prisma.income.update({
        where: { id: incomeInfo[i].id },
        data: { nextPaymentDate: incomeInfo[i].nextPaymentDate },
      });
    }

    const nextPaycheck = await prisma.income.findFirst({
      where: {
        userId: userId,
        nextPaymentDate: { gte: now },
      },
      orderBy: { nextPaymentDate: "asc" },
    });

    //calculate available after date and amount if paycheck info is available
    if (nextPaycheck) {
      const afterNextPayBalance =
        availableBalance._sum.availableBalance!.toNumber() +
        nextPaycheck.amount.toNumber();
      if (afterNextPayBalance >= billsTotal) {
        let remainingBalance = afterNextPayBalance - billsTotal;
        if (remainingBalance >= 0) {
          const [updatedBudgetItems, ignoredBudgetItems, newSafeToSpend] =
            allocateForBudgetItems(
              remainingBalance,
              budgetItemsToUpdate,
              remainingDesiredMonthlySpend,
            );
          returnValues.availableAfterAmount = newSafeToSpend;
          returnValues.availableAfterDate = nextPaycheck.nextPaymentDate;
        }
      } else {
        returnValues.availableAfterAmount = 0;
        returnValues.availableAfterDate = nextPaycheck.nextPaymentDate;
      }
    }
  };

  // partial path — can cover bills but not all goals
  if (availableBalance._sum.availableBalance.toNumber() >= billsTotal) {
    let remainingBalance =
      availableBalance._sum.availableBalance.toNumber() - billsTotal;
    const [updatedBudgetItems, ignoredBudgetItems, newSafeToSpend] =
      allocateForBudgetItems(
        remainingBalance,
        budgetItemsToUpdate,
        remainingDesiredMonthlySpend,
      );
    returnValues.ignoredBudgetItems = ignoredBudgetItems;
    returnValues.acceptedBudgetItems = updatedBudgetItems;
    returnValues.pendingBudgetItemUpdates = updatedBudgetItems;
    returnValues.safeToSpend = newSafeToSpend;
    returnValues.scheduledSavings = updatedBudgetItems.reduce((sum: number, item: any) => {
      const contribution = item.isReccuring
        ? item.amount.toNumber()
        : item.newAmountSaved.toNumber() - item.amountSaved.toNumber();
      return sum + contribution;
    }, 0);
    if (newSafeToSpend === 0) {
      await availableAfterCalculation();
      return returnValues;
    } else {
      return returnValues;
    }
  }

  // can't afford bills
  returnValues.safeToSpend = 0;
  returnValues.ignoredBudgetItems = budgetItems;
  returnValues.acceptedBudgetItems = [];
  returnValues.pendingBudgetItemUpdates = [];

  // fetch income info for available after calculation

  await availableAfterCalculation();
  return returnValues;
};
