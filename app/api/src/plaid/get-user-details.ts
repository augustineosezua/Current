import express from "express";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { calculateSafeToSpend } from "../lib/safe-to-spend";
import { calculateSavingsReconciliation } from "../lib/savings";
import { billsMatcher } from "../lib/bills";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";

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

// checks if a Plaid account has been linked for the current user
router.post("/api/check-plaid-user", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) {
      return;
    }

    const plaidUser = await prisma.plaidUser.findFirst({
      where: {
        userId: userId,
      },
    });

    return res.json({ exists: !!plaidUser, status: 200 });
  } catch (error) {
    console.error("Error checking Plaid user:", error);
    return res.status(500).json({ error: "Error checking Plaid user" });
  }
});

// fetches all bank accounts for the current user
router.get("/api/accounts", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const bankAccounts = await prisma.bankAccounts.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ bankAccounts: bankAccounts, status: 200 });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return res.status(500).json({ error: "Error fetching accounts" });
  }
});

// fetches all transactions for the current user
router.get("/api/transactions", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    // requireAuth already sends 401 — return without a second response
    if (!userId) return;

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ transactions: transactions, status: 200 });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ error: "Error fetching transactions" });
  }
});

// fetches all bills for the current user, paid and unpaid
router.get("/api/bills-all", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const bills = await prisma.bills.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ bills: bills, status: 200 });
  } catch (error) {
    console.error("Error fetching bills:", error);
    return res.status(500).json({ error: "Error fetching bills" });
  }
});

// fetches only unpaid bills for the current user
router.get("/api/bills-active", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const bills = await prisma.bills.findMany({
      where: {
        userId: userId,
        isPaid: false,
      },
    });

    return res.json({ bills: bills, status: 200 });
  } catch (error) {
    console.error("Error fetching active bills:", error);
    return res.status(500).json({ error: "Error fetching bills" });
  }
});

// returns fuzzy-matched bill-transaction suggestions for the current user
/** pass in transactions from the last 30 days + current balances */
router.get("/api/bills/suggestions", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const suggestions = await billsMatcher(userId);
    return res.json({ suggestions, status: 200 });
  } catch (err) {
    console.error("Error fetching bill suggestions:", err);
    return res.status(500).json({ error: "Error fetching bill suggestions" });
  }
});

// calculates how much the user can safely spend given bills and budget goals
router.get("/api/safe-to-spend", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const safeToSpend = await calculateSafeToSpend(userId);

    // domain error (e.g. no linked accounts) rather than an uncaught exception
    if (safeToSpend.error) {
      console.error("Safe-to-spend calculation error:", safeToSpend.error);
      return res.status(500).json({ error: "Error calculating safe to spend" });
    }
    return res.json({
      safeToSpend,
      status: 200,
    });
  } catch (err) {
    console.error("Error calculating safe to spend:", err);
    return res.status(500).json({ error: "Error calculating safe to spend" });
  }
});

// compares savings account balances against budget goal allocations
router.get("/api/savings-reconciliation", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const reconciliation = await calculateSavingsReconciliation(userId);
    return res.json({ ...reconciliation, status: 200 });
  } catch (err) {
    console.error("Error calculating savings reconciliation:", err);
    return res.status(500).json({ error: "Error calculating savings reconciliation" });
  }
});

export default router;
