import express from "express";
import { plaidClient } from "../lib/plaid";
import { PrismaClient, UserStatus } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

router.post("/api/accounts/savings-toogle", async (req, res) => {
  try {
    const userId = req.body.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const updatedData = prisma.bankAccounts.update({
      where: {
        id: req.body.accountId,
        userId: userId,
      },
      data: {
        isSavingsAccount: req.body.isSavings,
      },
    });

    res.json({
      message: "Savings account status updated successfully",
      data: updatedData,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error updating account",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.post("api/settings/income", async (req, res) => {
  try {
    const userId = req.body.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const updatedUser = await prisma.userSettings.update({
      where: {
        userId: userId,
      },
      data: {
        paychequeAmount: req.body.paychequeAmount,
        paychequeFrequency: req.body.paychequeFrequency,
        nextPaychequeDate: new Date(req.body.nextPaychequeDate),
      },
    });

    res.json({
      message: "Income settings updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      error: "Error updating income settings",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});
