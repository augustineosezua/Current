//endpoints to create Current-speific user data

import express from "express";
import { plaidClient } from "../lib/plaid";
import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

//DEPRECATED FOR NOW
router.post("/api/create-budget-period", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const newBudgetPeriod = await prisma.budgetMonth.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Set end date to 30 days from now
        totalIncome: req.body.totalIncome,
        totalSaved: req.body.totalSaved,
        totalSpent: req.body.totalSpent,
        safeToSpendSnapshot: req.body.safeToSpendSnapshot,
      },
    });
    return res.json({
      message: "Budget period created successfully",
      data: newBudgetPeriod,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error creating budget period",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

// DEPRECATED FOR NOW
router.post("/api/update-budget-period", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const updatedBudgetPeriod = await prisma.budgetMonth.updateManyAndReturn({
      where: {
        userId: userId,
        id: req.body.budgetPeriodId,
      },
      data: {
        totalIncome: req.body.totalIncome,
        totalSaved: req.body.totalSaved,
        totalSpent: req.body.totalSpent,
        safeToSpendSnapshot: req.body.safeToSpendSnapshot,
      },
    });
    return res.json({
      message: "Budget period updated successfully",
      data: updatedBudgetPeriod,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error updating budget period",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.post("/api/create-budget-item", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }
    const newBudgetItem = await prisma.budgetItem.create({
      data: {
        id: crypto.randomUUID(),
        name: req.body.name,
        amount: req.body.amount,
        dueDate: new Date(req.body.dueDate),
        userId: userId,

      },
    });
    return res.json({
      message: "Budget item created successfully",
      data: newBudgetItem,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error creating budget item",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.post("/api/update-budget-item", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const updatedBudgetItem = await prisma.budgetItem.update({
      where: {
        id: req.body.budgetItemId,
      },
      data: {
        name: req.body.name,
        amount: req.body.amount,
        dueDate: new Date(req.body.dueDate),
        userId: userId,
        amountSaved: req.body.amountSaved,
        isCompleted: req.body.isCompleted,
        isDeleted: req.body.isDeleted,
        priority: req.body.priority,
        isReccuring: req.body.isReccuring,
        frequency: req.body.frequency,
        updatedAt: new Date(),
      },
    });

    return res.json({
      message: "Budget item updated successfully",
      data: updatedBudgetItem,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error updating budget item",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.post("/api/bills", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }
    const newBill = await prisma.bills.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        billName: req.body.name,
        amount: req.body.amount,
        dueDate: new Date(req.body.dueDate),
        isPaid: false,
        isReccuring: req.body.isReccuring,
      },
    });
    return res.json({
      message: "Bill created successfully",
      data: newBill,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error creating bill",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.patch("/api/bills/:billId", async (req, res) => {
  try {
    const { billId } = req.params;
    const {
      userId,
      billName,
      amount,
      dueDate,
      isPaid,
      isRecurring,
      frequency,
    } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const existingBill = await prisma.bills.findUnique({
      where: { id: billId },
    });

    if (!existingBill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    if (existingBill.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const updateData: Record<string, unknown> = {};
    if (billName !== undefined) updateData.billName = billName;
    if (amount !== undefined) updateData.amount = amount;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);
    if (isPaid !== undefined) updateData.isPaid = isPaid;
    if (isRecurring !== undefined) updateData.isReccuring = isRecurring;
    if (frequency !== undefined) updateData.frequency = frequency;

    const bill = await prisma.bills.update({
      where: { id: billId },
      data: updateData,
    });

    // Auto-generate next occurrence when the bill is paid and recurring
    const effectiveIsPaid = isPaid !== undefined ? isPaid : existingBill.isPaid;
    const effectiveIsRecurring =
      isRecurring !== undefined ? isRecurring : existingBill.isReccuring;
    const effectiveFrequency =
      frequency !== undefined ? frequency : existingBill.frequency;

    if (effectiveIsPaid && effectiveIsRecurring && effectiveFrequency) {
      const nextDueDate = new Date(bill.dueDate);
      if (effectiveFrequency === "weekly") {
        nextDueDate.setDate(nextDueDate.getDate() + 7);
      } else if (effectiveFrequency === "biweekly") {
        nextDueDate.setDate(nextDueDate.getDate() + 14);
      } else if (effectiveFrequency === "monthly") {
        nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      }

      await prisma.bills.create({
        data: {
          id: crypto.randomUUID(),
          userId: bill.userId,
          billName: bill.billName,
          amount: bill.amount,
          dueDate: nextDueDate,
          isPaid: false,
          isReccuring: true,
          frequency: effectiveFrequency,
        },
      });
    }

    return res.json({ bill });
  } catch (error) {
    return res.status(500).json({
      error: "Error updating bill",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

//create transactions

//update transactions

export default router;
