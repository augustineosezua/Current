//endpoints to delete users and user data from Current
import express from "express";
import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
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

// marks the user as pending deletion — hard delete is scheduled 30 days out
router.delete("/api/delete-user", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        status: UserStatus.pending_deletion,
        deletion_requested_at: new Date(),
        deletion_scheduled_for: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error requesting user deletion:", error);
    return res.status(500).json({ error: "Error requesting user deletion" });
  }
});

// deletes a bank account and all of its transactions
router.delete("/api/delete-bank-account", async (req, res) => {
  try {
    console.log("Received request to delete bank account with body:", req.body);
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const bankAccountId = req.body.accountId as string;

    if (!bankAccountId) {
      return res.status(400).json({ error: "Bank Account ID is required" });
    }

    const bankAccount = await prisma.bankAccounts.findUnique({
      where: { id: bankAccountId },
    });

    console.log("Bank account to delete:", bankAccount);

    // ownership check prevents deleting another user's account
    if (!bankAccount || bankAccount.userId !== userId) {
      return res.status(404).json({ error: "Bank Account not found" });
    }

    // Transaction.accountId references bankAccounts.plaidAccountId with onDelete: SetNull,
    // so Prisma will not cascade-delete transactions — we must do it explicitly first
    await prisma.transaction.deleteMany({
      where: { accountId: bankAccount.plaidAccountId, userId },
    });

    await prisma.bankAccounts.delete({
      where: { id: bankAccountId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bank account:", error);
    return res.status(500).json({ error: "Error deleting bank account" });
  }
});

// deletes a single transaction
router.delete("/api/delete-transaction", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const transactionId = req.body.transactionId;
    if (!transactionId) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    // ownership check prevents deleting another user's transaction
    if (!transaction || transaction.userId !== userId) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    await prisma.transaction.delete({
      where: { id: transactionId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return res.status(500).json({ error: "Error deleting transaction" });
  }
});

// deletes a bill
router.delete("/api/delete-bill", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const billId = req.body.billId;
    if (!billId) {
      return res.status(400).json({ error: "Bill ID is required" });
    }

    const bill = await prisma.bills.findUnique({
      where: { id: billId },
    });

    // ownership check prevents deleting another user's bill
    if (!bill || bill.userId !== userId) {
      return res.status(404).json({ error: "Bill not found" });
    }

    await prisma.bills.delete({
      where: { id: billId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting bill:", error);
    return res.status(500).json({ error: "Error deleting bill" });
  }
});

// deletes a budget goal
router.delete("/api/delete-budget-item", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const budgetItemId = req.body.budgetItemId;
    if (!budgetItemId) {
      return res.status(400).json({ error: "Budget Item ID is required" });
    }

    const budgetItem = await prisma.budgetItem.findUnique({
      where: { id: budgetItemId },
    });

    // ownership check prevents deleting another user's budget item
    if (!budgetItem || budgetItem.userId !== userId) {
      return res.status(404).json({ error: "Budget Item not found" });
    }

    await prisma.budgetItem.delete({
      where: { id: budgetItemId },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting budget item:", error);
    return res.status(500).json({ error: "Error deleting budget item" });
  }
});

//delete transactions
export default router;
