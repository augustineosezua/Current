import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

// returns suggested bill-transaction pairs based on fuzzy name and amount match
export const billsMatcher = async (userId: string) => {
  let billsMatched = [];

  // only match against unpaid bills
  const bills = await prisma.bills.findMany({
    where: {
      userId: userId,
      isPaid: false,
    },
  });

  // find transactions within ±3 days of each bill's due date
  for (const bill of bills) {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId,
        date: {
          gte: new Date(bill.dueDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          lte: new Date(bill.dueDate.getTime() + 3 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // fuzzy match each transaction to the bill by name substring and amount within $1
    for (const transaction of transactions) {
      // skip entries missing the fields needed to compare
      if (
        !transaction.amount ||
        !bill.amount ||
        !transaction.merchantName ||
        !bill.billName
      )
        continue;

      const nameMatch = transaction.merchantName
        .toLowerCase()
        .includes(bill.billName.toLowerCase());

      const amountMatch =
        Math.abs(transaction.amount.toNumber() - bill.amount.toNumber()) < 1;

      // push the first match and move to the next bill
      if (nameMatch && amountMatch) {
        billsMatched.push({
          billId: bill.id,
          transactionId: transaction.id,
        });
        break;
      }
    }
  }
  return billsMatched;
};

// marks a bill as paid and creates the next occurrence if the bill is recurring
export const userMatchBills = async (
  userId: string,
  billId: string,
  transactionId: string,
) => {
  const bill = await prisma.bills.findUnique({
    where: {
      id: billId,
      userId: userId,
    },
  });

  const transaction = await prisma.transaction.findUnique({
    where: {
      id: transactionId,
      userId: userId,
    },
  });

  if (!transaction) {
    throw new Error("Transaction not found");
  }

  if (!bill) {
    throw new Error("Bill not found");
  }

  let nextDueDate = bill.dueDate;

  // advance the due date by the bill's frequency to create the next occurrence
  if (bill.isReccuring) {
    nextDueDate = new Date(bill.dueDate);

    switch (bill.frequency) {
      case "weekly":
        nextDueDate.setDate(nextDueDate.getDate() + 7);
        break;
      case "biweekly":
        nextDueDate.setDate(nextDueDate.getDate() + 14);
        break;
      case "monthly":
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        break;
      case "semimonthly":
        // alternates between the 1st and 15th of each month
        if (nextDueDate.getDate() < 15) {
          nextDueDate.setDate(15);
        } else {
          nextDueDate.setDate(1);
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
        }
        break;
      case "yearly":
        nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
        break;
      case "daily":
        nextDueDate.setDate(nextDueDate.getDate() + 1);
        break;
    }
  }

  let data;

  // recurring: create the next bill entry and mark the current one paid
  if (bill.isReccuring) {
    data = await prisma.bills.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        billName: bill.billName,
        amount: bill.amount,
        dueDate: nextDueDate,
        isReccuring: bill.isReccuring,
        frequency: bill.frequency,
        isPaid: false,
      },
    });

    await prisma.bills.update({
      where: {
        id: billId,
        userId: userId,
      },
      data: {
        isPaid: true,
        transactionId: transactionId,
      },
    });
  } else {
    // one-time: just mark it paid
    data = await prisma.bills.update({
      where: {
        id: billId,
        userId: userId,
      },
      data: {
        isPaid: true,
        transactionId: transactionId,
      },
    });
  }

  return data;
};
