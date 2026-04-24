import express from "express";
import { plaidClient } from "../lib/plaid";
import { CountryCode, Products } from "plaid";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

router.get("/api/settings", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    let settings = null;
    settings = await prisma.userSettings.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          id: crypto.randomUUID(),
          userId: userId,
          notificationsEnabled: false,
        },
      });
    }

    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({
      error: "Error fetching user settings",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.patch("/api/settings", async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const {
      paychequeAmount,
      paychequeFrequency,
      nextPaychequeDate,
      notificationsEnabled,
      desireMinimumSpend,
    } = req.body;

    const validFrequencies = ["weekly", "biweekly", "monthly"];
    if (paychequeFrequency !== undefined && !validFrequencies.includes(paychequeFrequency)) {
      return res.status(400).json({
        error: "paychequeFrequency must be one of: weekly, biweekly, monthly",
      });
    }

    const updateData: Record<string, unknown> = {};
    if (paychequeAmount !== undefined) updateData.paychequeAmount = paychequeAmount;
    if (paychequeFrequency !== undefined) updateData.paychequeFrequency = paychequeFrequency;
    if (nextPaychequeDate !== undefined) updateData.nextPaychequeDate = new Date(nextPaychequeDate);
    if (desireMinimumSpend ! == undefined) updateData.desireMinimumSpend = desireMinimumSpend;
    if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;

    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        id: crypto.randomUUID(),
        userId,
        notificationsEnabled: notificationsEnabled ?? false,
        ...updateData,
      },
    });

    return res.json({ settings });
  } catch (error) {
    return res.status(500).json({
      error: "Error updating user settings",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

export default router;