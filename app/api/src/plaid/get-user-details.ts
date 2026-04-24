import express from "express";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
import { calculateSafeToSpend } from "../lib/safe-to-spend";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

//checks if plaidUser already exists
router.post("/api/check-plaid-user", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const plaidUser = await prisma.plaidUser.findUnique({
      where: {
        userId: userId,
      },
    });

    return res.json({ exists: !!plaidUser, status: 200 });
  } catch (error) {
    return res.status(500).json({
      error: "Error checking Plaid user",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

// fetches all accounts for a given user
router.get("/api/accounts", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }

    const bankAccounts = await prisma.bankAccounts.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ bankAccounts: bankAccounts, status: 200 });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching accounts",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

// fetches all transactions for a given user
router.get("/api/transactions", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ transactions: transactions, status: 200 });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching transactions",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

//bills
router.get("/api/bills-all", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }

    const bills = await prisma.bills.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({ bills: bills, status: 200 });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching bills",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.get("/api/bills-active", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }

    const bills = await prisma.bills.findMany({
      where: {
        userId: userId,
        isPaid: false,
      },
    });

    return res.json({ bills: bills, status: 200 });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching bills",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.get("/api/current-budget", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }

    const now = new Date();

    const currentBudget = await prisma.budgetMonth.findFirst({
      where: {
        userId,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: {
        startDate: "desc",
      },
    });

    const budgetItems = await prisma.budgetItem.findMany({
      where: {
        userId: userId,
      },
    });

    return res.json({
      currentBudget: currentBudget,
      budgetItems: budgetItems,
      status: 200,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching current budget",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.get("/api/bills/suggestions", async (req, res) => {
  try {
    res.json({
      suggestions: [
        "maybe cancel netflix",
        "call phone company about cheaper plan",
        "switch to cheaper electricity provider",
      ],
      status: 200,
    });
  } catch (err) {
    return res.status(500).json({
      error: "Error fetching bill suggestions",
      errorDetails: err instanceof Error ? err.message : err,
    });
  }
});

router.get("/api/safe-to-spend", async (req, res) => {
  try{
    const userId = req.query.userId as string;
    if (!userId) {
      return res
        .status(400)
        .json({ error: "User Must Be Signed In", status: 400 });
    }
    const safeToSpend = await calculateSafeToSpend({userId});
    return res.json({
      safeToSpend,
      status: 200,
    });
  }catch(err){
    return res.status(500).json({
      error: "Error calculating safe to spend",
      errorDetails: err instanceof Error ? err.message : err,
    });
  }
})

export default router;
