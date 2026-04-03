//endpoints to create Current-speific user data

import express from "express";
import { plaidClient } from "../lib/plaid";
import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

router.post("/api/create-budget-period", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const newBudgetPeriod = await prisma.budgetPeriod.create({
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

router.post("/api/update-budget-period", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const updatedBudgetPeriod = await prisma.budgetPeriod.updateManyAndReturn({
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
        budgetPeriodId: req.body.budgetPeriodId,
        name: req.body.name,
        amount: req.body.amount,
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

//create transactions

//update transactions

//sync-transactions 
export default router;
