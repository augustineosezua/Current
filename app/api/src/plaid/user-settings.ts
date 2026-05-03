import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const router = express.Router();

// returns the authenticated userId or sends 401 and returns null
async function requireAuth(req: express.Request, res: express.Response): Promise<string | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  const userId = session?.user.id;
  if (!userId) {
    res.status(401).json({ error: "User Must Be Signed In" });
    return null;
  }
  return userId;
}

const VALID_FREQUENCIES = ["weekly", "biweekly", "semimonthly", "monthly", "yearly", "daily"];

// fetches user settings, creating a default row if one doesn't exist yet
router.get("/api/settings", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    let settings = null;
    settings = await prisma.userSettings.findUnique({
      where: {
        userId: userId,
      },
    });

    // first-time user — create a default settings row
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
    console.error("Error fetching user settings:", error);
    return res.status(500).json({ error: "Error fetching user settings" });
  }
});

// partially updates user settings — only provided fields are changed
router.patch("/api/settings", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const {
      paychequeAmount,
      paychequeFrequency,
      nextPaychequeDate,
      notificationsEnabled,
      desiredMinimumMonthlySpend,
    } = req.body;

    // negative values would corrupt safe-to-spend calculations
    if (paychequeAmount !== undefined) {
      if (typeof paychequeAmount !== "number" || paychequeAmount < 0) {
        return res.status(400).json({ error: "paychequeAmount must be a non-negative number" });
      }
    }
    if (desiredMinimumMonthlySpend !== undefined) {
      if (typeof desiredMinimumMonthlySpend !== "number" || desiredMinimumMonthlySpend < 0) {
        return res.status(400).json({ error: "desiredMinimumMonthlySpend must be a non-negative number" });
      }
    }

    // frequency must come from the allowed set
    if (paychequeFrequency !== undefined && !VALID_FREQUENCIES.includes(paychequeFrequency)) {
      return res.status(400).json({
        error: `paychequeFrequency must be one of: ${VALID_FREQUENCIES.join(", ")}`,
      });
    }

    if (notificationsEnabled !== undefined && typeof notificationsEnabled !== "boolean") {
      return res.status(400).json({ error: "notificationsEnabled must be a boolean" });
    }

    // reject non-date strings before they reach the DB
    let parsedDate: Date | undefined;
    if (nextPaychequeDate !== undefined) {
      parsedDate = new Date(nextPaychequeDate);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "nextPaychequeDate must be a valid date" });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (paychequeAmount !== undefined) updateData.paychequeAmount = paychequeAmount;
    if (paychequeFrequency !== undefined) updateData.paychequeFrequency = paychequeFrequency;
    if (parsedDate !== undefined) updateData.nextPaychequeDate = parsedDate;
    if (desiredMinimumMonthlySpend !== undefined) updateData.desiredMinimumMonthlySpend = desiredMinimumMonthlySpend;
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

    // sync paycheque fields to income table so safe-to-spend can read them
    const paychequeChanged = paychequeAmount !== undefined || paychequeFrequency !== undefined || nextPaychequeDate !== undefined;
    if (paychequeChanged && settings.nextPaychequeDate) {
      const existingIncome = await prisma.income.findFirst({
        where: { userId, source: "paycheque" },
      });
      const incomeData = {
        amount: settings.paychequeAmount,
        frequency: settings.paychequeFrequency as any,
        nextPaymentDate: settings.nextPaychequeDate,
      };
      if (existingIncome) {
        await prisma.income.update({ where: { id: existingIncome.id }, data: incomeData });
      } else {
        await prisma.income.create({
          data: { id: crypto.randomUUID(), userId, source: "paycheque", ...incomeData },
        });
      }
    }

    return res.json({ settings });
  } catch (error) {
    console.error("Error updating user settings:", error);
    return res.status(500).json({ error: "Error updating user settings" });
  }
});

export default router;
