//endpoints to delete users and user data from Current
import express from "express";
import { plaidClient } from "../lib/plaid";
import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

router.delete("/api/delete-user", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    //delete user from Current and cascade delete all related data (PlaidUser, BankAccount, Transaction)
    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: UserStatus.pending_deletion,
        deletion_requested_at: new Date(),
        deletion_scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Schedule deletion for 30 days from now
      },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error requesting user deletion",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

//delete a bank account and its transactions
router.delete("/api/delete-bank-account", async (req, res) => {
  try {
    const bankAccountId = req.body.bankAccountId;
    if (!bankAccountId) {
      return res.status(400).json({ error: "Bank Account ID is required" });
    }

    await prisma.bankAccounts.delete({
      where: { plaidAccountId: bankAccountId },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error deleting bank account",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.delete("/api/delete-transaction", async (req, res) => {
  try {
    const transactionId = req.body.transactionId;
    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error deleting transaction",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.delete("/api/delete-bill", async (req, res) => {
  try {
    const billId = req.body.billId;
    if (!billId) {
      return res.status(400).json({ error: "Bill ID is required" });
    }

    await prisma.bills.delete({
      where: { id: billId },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error deleting bill",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.delete("/api/delete-budget-item", async (req, res) => {
  try {
    const budgetItemId = req.body.budgetItemId;
    if (!budgetItemId) {
      return res.status(400).json({ error: "Budget Item ID is required" });
    }

    await prisma.budgetItem.delete({
      where: { id: budgetItemId },
    });

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error deleting budget item",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

//delete transactions
export default router;
