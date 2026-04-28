import express from "express";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { userMatchBills } from "../lib/bills";
import { auth } from "../lib/auth";
import { fromNodeHeaders } from "better-auth/node";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

// returns the authenticated userId or sends 401 and returns null
async function requireAuth(
  req: express.Request,
  res: express.Response,
): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  const userId = session?.user.id;
  if (!userId) {
    res.status(401).json({ error: "User Must Be Signed In" });
    return null;
  }
  return userId;
}

// toggles whether a bank account is treated as a savings account
router.post("/api/accounts/savings-toggle", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { accountId, isSavings } = req.body;

    // validate both fields before touching the DB
    if (!accountId || typeof accountId !== "string") {
      return res.status(400).json({ error: "accountId must be a non-empty string" });
    }
    if (typeof isSavings !== "boolean") {
      return res.status(400).json({ error: "isSavings must be a boolean" });
    }

    // userId in where clause prevents modifying another user's account (IDOR)
    const updatedData = await prisma.bankAccounts.update({
      where: {
        id: accountId,
        userId: userId,
      },
      data: {
        isSavingsAccount: isSavings,
      },
    });

    res.json({
      message: "Savings account status updated successfully",
      data: updatedData,
    });
  } catch (error) {
    console.error("Error updating savings account status:", error);
    res.status(500).json({ error: "Error updating account" });
  }
});

const VALID_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly", "yearly", "daily"];

// updates paycheck amount, frequency, and next payment date for the current user
router.post("/api/settings/income", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { paychequeAmount, paychequeFrequency, nextPaychequeDate } = req.body;

    // all three fields are required — frequency cannot be omitted because the income
    // table would default to one_time, breaking safe-to-spend paycheck calculations
    if (paychequeAmount === undefined || typeof paychequeAmount !== "number" || paychequeAmount <= 0) {
      return res.status(400).json({ error: "paychequeAmount must be a positive number" });
    }
    if (!paychequeFrequency || !VALID_FREQUENCIES.includes(paychequeFrequency)) {
      return res.status(400).json({
        error: `paychequeFrequency is required and must be one of: ${VALID_FREQUENCIES.join(", ")}`,
      });
    }
    const parsedDate = new Date(nextPaychequeDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "nextPaychequeDate must be a valid date" });
    }

    // upsert instead of update — new users may not have a settings row yet
    const updatedUser = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        paychequeAmount,
        paychequeFrequency,
        nextPaychequeDate: parsedDate,
      },
      create: {
        id: crypto.randomUUID(),
        userId,
        notificationsEnabled: false,
        paychequeAmount,
        paychequeFrequency,
        nextPaychequeDate: parsedDate,
      },
    });

    // keep income table in sync so safe-to-spend can read paycheck data
    const existingIncome = await prisma.income.findFirst({
      where: { userId, source: "paycheque" },
    });
    const incomeData = {
      amount: paychequeAmount,
      frequency: paychequeFrequency,
      nextPaymentDate: parsedDate,
    };
    if (existingIncome) {
      await prisma.income.update({ where: { id: existingIncome.id }, data: incomeData });
    } else {
      await prisma.income.create({
        data: { id: crypto.randomUUID(), userId, source: "paycheque", ...incomeData },
      });
    }

    res.json({
      message: "Income settings updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Error updating income settings:", error);
    res.status(500).json({ error: "Error updating income settings" });
  }
});

// manually associates a transaction with a bill on the user's behalf
router.post("/api/bills/match", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const billId = req.body.billId as string;
    const transactionId = req.body.transactionId as string;

    // both IDs required before any DB query
    if (!billId?.trim() || !transactionId?.trim()) {
      return res.status(400).json({ error: "billId and transactionId are required" });
    }

    // scope both lookups to the authenticated user to prevent IDOR
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

    if (!transaction || !bill) {
      return res.status(404).json({ error: "Bill or transaction not found" });
    }

    const data = await userMatchBills(userId, billId, transactionId);
    return res.json({
      message: "Bill matched successfully",
      data: data,
    });
  } catch (error) {
    console.error("Error matching bill:", error);
    res.status(500).json({ error: "Error matching bill" });
  }
});

export default router;
