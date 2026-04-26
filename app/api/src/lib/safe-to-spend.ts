import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

export const calculateSafeToSpend = async (userId: any) => {
  let returnValues = {
    safeToSpend: 0,
    availableAfterAmount: null,
    availableAfterDate: null,
    ignoredBudgetItems: [] as any[],
    acceptedBudgetItems: [] as any[],
    error: null as string | null,
  };

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

  const userSettings = await prisma.userSettings.findUnique({
    where: {
      userId: userId,
    },
  });

  let billsTotal = 0;
  const billsFetcher = await prisma.bills.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      isPaid: false,
      userId: userId,
      //due in current month
      dueDate: {
        lte: endOfMonth,
      },
    },
  });

  if (!billsFetcher._sum.amount) {
    billsTotal = 0;
  } else {
    billsTotal = billsFetcher._sum.amount.toNumber();
  }

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
      lastPaymentDate: true,
      isReccuring: true,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
  });

  const alreadySpent = await prisma.transaction.aggregate({
    _sum: {
      amount: true,
    },
    where: {
      userId: userId,
      date: {
        gte: startOfMonth,
        lte: now,
      },
      category: {
        has: "spending",
      },
    },
  });

  let remainingDesiredMonthlySpend = 0;
  if (userSettings) {
    remainingDesiredMonthlySpend = Math.max(
      userSettings.desiredMinimumMonthlySpend.toNumber() -
        (alreadySpent._sum.amount?.toNumber() ?? 0),
      0,
    );
  }

  //sum of all budget items
  let budgetItemsTotal = 0;
  let budgetItemsToUpdate = [];
  for (let i = 0; i < budgetItems.length; i++) {
    // avoid already completed items
    if (
      !budgetItems[i].isReccuring &&
      budgetItems[i].amountSaved.toNumber() >= budgetItems[i].amount.toNumber()
    ) {
      continue;
    }
    const item = budgetItems[i];
    // avoid double payments
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
      : (item.amount.toNumber() - item.amountSaved.toNumber()) /
        monthsRemaining;
    budgetItemsTotal += amountPerMonth;
    budgetItemsToUpdate.push({
      id: item.id,
      newAmountSaved: item.isReccuring
        ? item.amountSaved
        : item.amountSaved.add(amountPerMonth),
      amountSaved: item.amountSaved,
      dueDate: item.dueDate,
      amount: item.amount,
      isReccuring: item.isReccuring,
    });
  }

  // helper to update amount saved in prisma
  const updateBudgetItems = async (items: any[]) => {
    for (let i = 0; i < items.length; i++) {
      let isCompleted = false;
      if (
        !items[i].isReccuring &&
        items[i].amount.toNumber() <= items[i].newAmountSaved.toNumber()
      ) {
        isCompleted = true;
        items[i].newAmountSaved = items[i].amount;
      }
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

  // check if all data exists before doing calculations

  if (
    availableBalance._sum.availableBalance === null ||
    availableBalance._sum.availableBalance === undefined
  ) {
    returnValues.error =
      "Error calculating safe to spend. Please try again later.";
    return returnValues;
  }

  // check if all expenses can be covered by available balance

  if (
    availableBalance._sum.availableBalance.toNumber() >=
    billsTotal + budgetItemsTotal + remainingDesiredMonthlySpend
  ) {
    await updateBudgetItems(budgetItemsToUpdate);
    // update return values
    returnValues.safeToSpend =
      availableBalance._sum.availableBalance.toNumber() -
      billsTotal -
      budgetItemsTotal;
    returnValues.ignoredBudgetItems = [];
    returnValues.acceptedBudgetItems = budgetItemsToUpdate;
    return returnValues;
  }

  /**helper function to allocate remaining balace to
   * budget items based on priority and due date */
  const allocateForBudgetItems = (
    remainingBalance: number,
    budgetItems: any[],
    minimumMonthlySpend: number,
  ) => {
    let updatedBudgetItems: any[] = [];
    let ignoredBudgetItems: any[] = [];

    if (remainingBalance >= minimumMonthlySpend) {
      // allocate funds while remaining balance is not 0 and we have more budget items to update
      remainingBalance = Math.max(remainingBalance - minimumMonthlySpend, 0);
      let ranOut = false;
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
        // push all unpdated to ignored if we run out of money
        if (remainingBalance <= 0) {
          for (let j = i + 1; j < budgetItems.length; j++) {
            ignoredBudgetItems.push(budgetItems[j]);
          }
          returnValues.safeToSpend = Math.max(
            remainingBalance + amountPerMonth,
            0,
          );
          ranOut = true;
          break;
        }
        //else push to update list
        updatedBudgetItems.push({
          id: item.id,
          newAmountSaved: item.isReccuring
            ? item.amountSaved
            : item.amountSaved.add(amountPerMonth),
        });
      }
      if (!ranOut) {
        returnValues.safeToSpend = remainingBalance + minimumMonthlySpend;
      }
    } else {
      // if its not enough, just return the available balance as safe to spend and ignore all budget items
      returnValues.safeToSpend = remainingBalance + minimumMonthlySpend;
    }

    return [updatedBudgetItems, ignoredBudgetItems];
  };

  // we should only be here if the bills + budget items exceed available balance

  // check if we can at least pay the bills

  if (availableBalance._sum.availableBalance.toNumber() >= billsTotal) {
    let remainingBalance =
      availableBalance._sum.availableBalance.toNumber() - billsTotal;
    const [updatedBudgetItems, ignoredBudgetItems] = allocateForBudgetItems(
      remainingBalance,
      budgetItemsToUpdate,
      remainingDesiredMonthlySpend,
    );
    await updateBudgetItems(updatedBudgetItems);
    returnValues.ignoredBudgetItems = ignoredBudgetItems;
    returnValues.acceptedBudgetItems = updatedBudgetItems;
    return returnValues;
  }

  // we go here if we cant afford the bills
  // available after calculations here

  returnValues.safeToSpend = 0;
  returnValues.ignoredBudgetItems = budgetItems;
  returnValues.acceptedBudgetItems = [];

  return returnValues;
};
/**
 * safe to spend = available - expenses
 * available = current balance
 * expenses = bills + budget items in current period + already spent in current period
 * bills = sum of all transactions with category "bills" in current period
 * budget items in current period = sum of all budget items with dueDate in current period
 * already spent in current period = sum of all transactions with category "spending" in current period
 */
