//endpoints to create Current-specific user data
import express from "express";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";
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

// one_time is only valid for non-recurring bills
const RECURRING_FREQUENCIES = ["daily", "weekly", "biweekly", "semimonthly", "monthly", "yearly"];

// returns a parsed Date or null if the value isn't a valid date string
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

//DEPRECATED FOR NOW
router.post("/api/create-budget-period", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

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
    console.error("Error creating budget period:", error);
    return res.status(500).json({ error: "Error creating budget period" });
  }
});

// DEPRECATED FOR NOW
router.post("/api/update-budget-period", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

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
    console.error("Error updating budget period:", error);
    return res.status(500).json({ error: "Error updating budget period" });
  }
});

// creates a new savings or budget goal
router.post("/api/create-budget-item", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { name, amount, dueDate } = req.body;

    // name must be a non-empty string
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }
    // negative amounts break the safe-to-spend allocator math
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    // NaN dates break safe-to-spend date arithmetic
    const parsedDueDate = parseDate(dueDate);
    if (!parsedDueDate) {
      return res.status(400).json({ error: "dueDate must be a valid date" });
    }

    const newBudgetItem = await prisma.budgetItem.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        amount: amount,
        dueDate: parsedDueDate,
        userId: userId,
      },
    });
    return res.json({
      message: "Budget item created successfully",
      data: newBudgetItem,
    });
  } catch (error) {
    console.error("Error creating budget item:", error);
    return res.status(500).json({ error: "Error creating budget item" });
  }
});

// updates an existing budget goal — all fields are optional
router.post("/api/update-budget-item", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { budgetItemId, name, amount, dueDate, amountSaved, isCompleted, isDeleted, priority, isReccuring, frequency, isMonthlySavingGoal } = req.body;

    if (!budgetItemId || typeof budgetItemId !== "string") {
      return res.status(400).json({ error: "budgetItemId is required" });
    }
    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // validate dueDate only if provided
    let parsedDueDate: Date | undefined;
    if (dueDate !== undefined) {
      const d = parseDate(dueDate);
      if (!d) return res.status(400).json({ error: "dueDate must be a valid date" });
      parsedDueDate = d;
    }

    // userId in where clause prevents modifying another user's item (IDOR)
    const updatedBudgetItem = await prisma.budgetItem.update({
      where: {
        id: budgetItemId,
        userId: userId,
      },
      data: {
        name,
        amount,
        dueDate: parsedDueDate,
        amountSaved,
        isCompleted,
        isDeleted,
        priority,
        isReccuring,
        frequency,
        isMonthlySavingGoal,
        updatedAt: new Date(),
      },
    });

    return res.json({
      message: "Budget item updated successfully",
      data: updatedBudgetItem,
    });
  } catch (error) {
    console.error("Error updating budget item:", error);
    return res.status(500).json({ error: "Error updating budget item" });
  }
});

// creates a new bill
router.post("/api/bills", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { name, amount, dueDate, isReccuring, frequency } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    const parsedDueDate = parseDate(dueDate);
    if (!parsedDueDate) {
      return res.status(400).json({ error: "dueDate must be a valid date" });
    }
    // frequency is required when the bill repeats — one_time is not a valid recurring frequency
    if (isReccuring && (!frequency || !RECURRING_FREQUENCIES.includes(frequency))) {
      return res.status(400).json({
        error: `frequency must be one of: ${RECURRING_FREQUENCIES.join(", ")} when isReccuring is true`,
      });
    }

    const newBill = await prisma.bills.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        billName: name.trim(),
        amount: amount,
        dueDate: parsedDueDate,
        isPaid: false,
        isReccuring: isReccuring ?? false,
        frequency: frequency,
      },
    });
    return res.json({
      message: "Bill created successfully",
      data: newBill,
    });
  } catch (error) {
    console.error("Error creating bill:", error);
    return res.status(500).json({ error: "Error creating bill" });
  }
});

// partially updates an existing bill — only provided fields are changed
router.patch("/api/bills/:billId", async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const { billId } = req.params;
    const { billName, amount, dueDate, isPaid, isRecurring, frequency } = req.body;

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // validate frequency against the recurring set — one_time cannot be set on any bill via PATCH
    if (frequency !== undefined && !RECURRING_FREQUENCIES.includes(frequency)) {
      return res.status(400).json({
        error: `frequency must be one of: ${RECURRING_FREQUENCIES.join(", ")}`,
      });
    }

    const existingBill = await prisma.bills.findUnique({
      where: { id: billId },
    });

    if (!existingBill) {
      return res.status(404).json({ error: "Bill not found" });
    }

    // ownership check — users may only modify their own bills
    if (existingBill.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // if the result of this patch would be a recurring bill with no valid frequency, reject it
    const effectiveIsRecurring = isRecurring !== undefined ? isRecurring : existingBill.isReccuring;
    const effectiveFrequency = frequency !== undefined ? frequency : existingBill.frequency;
    if (effectiveIsRecurring && (!effectiveFrequency || !RECURRING_FREQUENCIES.includes(effectiveFrequency))) {
      return res.status(400).json({
        error: `A recurring bill must have a frequency of one of: ${RECURRING_FREQUENCIES.join(", ")}`,
      });
    }

    // validate dueDate only if provided
    let parsedDueDate: Date | undefined;
    if (dueDate !== undefined) {
      const d = parseDate(dueDate);
      if (!d) return res.status(400).json({ error: "dueDate must be a valid date" });
      parsedDueDate = d;
    }

    const updateData: Record<string, unknown> = {};
    if (billName !== undefined) updateData.billName = billName;
    if (amount !== undefined) updateData.amount = amount;
    if (parsedDueDate !== undefined) updateData.dueDate = parsedDueDate;
    if (isPaid !== undefined) updateData.isPaid = isPaid;
    if (isRecurring !== undefined) updateData.isReccuring = isRecurring;
    if (frequency !== undefined) updateData.frequency = frequency;

    const bill = await prisma.bills.update({
      where: { id: billId },
      data: updateData,
    });

    // only spawn the next occurrence when transitioning from unpaid → paid
    const becomingPaid = isPaid === true && existingBill.isPaid === false;

    if (becomingPaid && effectiveIsRecurring && effectiveFrequency) {
      const nextDueDate = new Date(bill.dueDate);
      switch (effectiveFrequency) {
        case "daily":
          nextDueDate.setDate(nextDueDate.getDate() + 1);
          break;
        case "weekly":
          nextDueDate.setDate(nextDueDate.getDate() + 7);
          break;
        case "biweekly":
          nextDueDate.setDate(nextDueDate.getDate() + 14);
          break;
        case "semimonthly":
          // alternates between the 1st and 15th of each month
          if (nextDueDate.getDate() < 15) {
            nextDueDate.setDate(15);
          } else {
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            nextDueDate.setDate(1);
          }
          break;
        case "monthly":
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);
          break;
        case "yearly":
          nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
          break;
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
    console.error("Error updating bill:", error);
    return res.status(500).json({ error: "Error updating bill" });
  }
});

//create transactions

//update transactions

export default router;
