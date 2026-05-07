// endpoints to create and mutate Current-specific user data (goals, bills, reorder, allocate)
import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

const router = express.Router();

// resolves the current session and returns the userId, or halts the request with 401
async function requireAuth(
  req: express.Request,
  res: express.Response,
): Promise<string | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  const userId = session?.user.id;
  // no valid session — reject before any DB work
  if (!userId) {
    res.status(401).json({ error: "User Must Be Signed In" });
    return null;
  }
  return userId;
}

// valid frequencies for recurring bills — one_time is intentionally excluded
const RECURRING_FREQUENCIES = ["daily", "weekly", "biweekly", "semimonthly", "monthly", "yearly"];

// coerces an unknown value to a Date, returning null for anything unparseable
function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  // NaN dates would silently corrupt any date arithmetic downstream
  return isNaN(d.getTime()) ? null : d;
}

//DEPRECATED FOR NOW
router.post("/api/create-budget-period", async (req, res) => {
  // creates a 30-day budget snapshot — superseded by rolling STS calculations
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const newBudgetPeriod = await prisma.budgetMonth.create({
      data: {
        id: crypto.randomUUID(),
        userId: userId,
        startDate: new Date(),
        endDate: new Date(new Date().setDate(new Date().getDate() + 30)),
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
    // log internally, never expose stack traces to the client
    console.error("Error creating budget period:", error);
    return res.status(500).json({ error: "Error creating budget period" });
  }
});

// DEPRECATED FOR NOW
router.post("/api/update-budget-period", async (req, res) => {
  // patches an existing budget snapshot — superseded by rolling STS calculations
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

// creates a new savings or budget goal for the authenticated user
router.post("/api/create-budget-item", async (req, res) => {
  // validate input before writing — bad data here breaks the STS allocator
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { name, amount, dueDate } = req.body;

    // reject blank names before touching the DB
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name must be a non-empty string" });
    }
    // negative or zero amounts corrupt the STS percentage math
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    // unparseable dates would silently produce NaN in STS date arithmetic
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

// applies a partial update to an existing goal — only fields present in the body are changed
router.post("/api/update-budget-item", async (req, res) => {
  // used for priority changes, marking isDeleted (spent), toggling isMonthlySavingGoal, etc.
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

    // only parse and validate dueDate when it was actually sent in this request
    let parsedDueDate: Date | undefined;
    if (dueDate !== undefined) {
      const d = parseDate(dueDate);
      if (!d) return res.status(400).json({ error: "dueDate must be a valid date" });
      parsedDueDate = d;
    }

    // scoping by userId in the where clause prevents one user from modifying another's goals (IDOR)
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

// creates a new bill and attaches it to the user's account
router.post("/api/bills", async (req, res) => {
  // bills feed directly into STS as deductions — amounts and dates must be clean
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
    // recurring bills without a frequency would break the next-occurrence spawner
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

// applies a partial update to a bill; when marked paid, auto-spawns the next recurring occurrence
router.patch("/api/bills/:billId", async (req, res) => {
  // the paid→next-occurrence spawn is the key side-effect that keeps recurring bills rolling
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    const { billId } = req.params;
    const { billName, amount, dueDate, isPaid, isRecurring, frequency } = req.body;

    if (amount !== undefined && (typeof amount !== "number" || amount <= 0)) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // one_time cannot be set as a frequency — recurring must use the approved set
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

    // ownership check — prevents modifying another user's bill (IDOR)
    if (existingBill.userId !== userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // resolve effective values by merging patch fields with the existing record
    const effectiveIsRecurring = isRecurring !== undefined ? isRecurring : existingBill.isReccuring;
    const effectiveFrequency = frequency !== undefined ? frequency : existingBill.frequency;
    // refuse to leave a recurring bill without a valid frequency
    if (effectiveIsRecurring && (!effectiveFrequency || !RECURRING_FREQUENCIES.includes(effectiveFrequency))) {
      return res.status(400).json({
        error: `A recurring bill must have a frequency of one of: ${RECURRING_FREQUENCIES.join(", ")}`,
      });
    }

    // only parse dueDate when it was sent — undefined means "don't change it"
    let parsedDueDate: Date | undefined;
    if (dueDate !== undefined) {
      const d = parseDate(dueDate);
      if (!d) return res.status(400).json({ error: "dueDate must be a valid date" });
      parsedDueDate = d;
    }

    // build the update payload from only the fields that were provided
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

    // only spawn the next occurrence on the unpaid → paid transition, not on re-patches
    const becomingPaid = isPaid === true && existingBill.isPaid === false;

    // advance the due date by one billing cycle and create the next unpaid instance
    if (becomingPaid && effectiveIsRecurring && effectiveFrequency) {
      const nextDueDate = new Date(bill.dueDate);
      // each case advances nextDueDate by exactly one period
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
          // alternates between the 1st and 15th — before the 15th lands on 15th, after lands on 1st next month
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

      // persist the auto-generated next occurrence so it appears on the bills page immediately
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

// Goals above the STS card get priority >= this sentinel so they always sort ahead of the STS line.
// Goals below the STS card get priorities 1..N (below the sentinel), giving them lower precedence.
const STS_ABOVE_SENTINEL = 1000;

// reassigns integer priority values so the drag-drop order survives page reloads
// orderedIds[0] = highest priority; stsPosition = how many goals sit above the STS separator
router.post("/api/budget-items/reorder", async (req, res) => {
  // priorities drive the order in STS calculations and the savings reconciliation waterfall
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { orderedIds, stsPosition } = req.body;

    // reject malformed payloads before any DB work
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return res.status(400).json({ error: "orderedIds must be a non-empty array" });
    }
    // every entry must be a non-empty string to be a valid Prisma id
    if (orderedIds.some((id) => typeof id !== "string" || !id.trim())) {
      return res.status(400).json({ error: "all entries in orderedIds must be non-empty strings" });
    }

    // confirm all submitted ids belong to this user — prevents partial-ownership reorders (IDOR)
    const existing = await prisma.budgetItem.findMany({
      where: { userId, id: { in: orderedIds } },
      select: { id: true },
    });
    if (existing.length !== orderedIds.length) {
      return res.status(403).json({ error: "One or more budget items not found or not owned by user" });
    }

    // stsPosition = number of goals above the STS separator; clamp to valid range
    const sts = typeof stsPosition === "number"
      ? Math.max(0, Math.min(stsPosition, orderedIds.length))
      : orderedIds.length;

    // single DB transaction so no goal is temporarily left with a stale priority mid-update
    await prisma.$transaction(
      orderedIds.map((id, index) => {
        // goals above STS get sentinel-offset priorities so they always outrank below-STS goals
        const priority =
          index < sts
            ? STS_ABOVE_SENTINEL + (sts - index)
            : orderedIds.length - index;
        return prisma.budgetItem.update({
          where: { id, userId },
          data: { priority },
        });
      }),
    );

    return res.json({ success: true });
  } catch (error) {
    console.error("Error reordering budget items:", error);
    return res.status(500).json({ error: "Error reordering budget items" });
  }
});

// records that funds have been moved toward a goal, capping at target and auto-completing when full
router.post("/api/budget-items/allocate", async (req, res) => {
  // amountSaved drives the reconciliation gap and the progress bar on the savings page
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const { budgetItemId, amount } = req.body;

    if (!budgetItemId || typeof budgetItemId !== "string") {
      return res.status(400).json({ error: "budgetItemId is required" });
    }
    // allocating zero or negative would silently corrupt progress tracking
    if (typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }

    // scoped by userId so a user can't allocate to someone else's goal
    const item = await prisma.budgetItem.findUnique({
      where: { id: budgetItemId, userId },
    });

    // goal not found or belongs to a different user
    if (!item) {
      return res.status(404).json({ error: "Budget item not found" });
    }

    const currentSaved = item.amountSaved.toNumber();
    const target = item.amount.toNumber();
    // cap at target so amountSaved never exceeds amount
    const newAmountSaved = Math.min(currentSaved + amount, target);
    // flip isCompleted automatically when the goal is fully funded
    const isNowComplete = newAmountSaved >= target;

    // persist the new saved total and completion state in one write
    const updated = await prisma.budgetItem.update({
      where: { id: budgetItemId, userId },
      data: {
        amountSaved: newAmountSaved,
        isCompleted: isNowComplete,
        updatedAt: new Date(),
      },
    });

    return res.json({ message: "Funds allocated successfully", data: updated });
  } catch (error) {
    console.error("Error allocating funds:", error);
    return res.status(500).json({ error: "Error allocating funds" });
  }
});

//create transactions

//update transactions

export default router;
