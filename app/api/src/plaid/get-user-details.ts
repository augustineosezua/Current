import express, { response } from "express";
import { plaidClient } from "../lib/plaid";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

//checks if plaidUser already exists
router.post("/api/check-plaid-user", async (req, res) => {
  const userId = req.body.userId;
  const plaidUser = await prisma.plaidUser.findUnique({
    where: {
      userId: userId,
    },
  });
  res.json({ exists: !!plaidUser });
});

// fetches all accounts for a given user
router.get("/api/accounts", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "User Must Be Signed In" });
  }

  const bankAccounts = await prisma.bankAccounts.findMany({
    where: {
      userId: userId,
    },
  });
  
  res.json(bankAccounts);
});

// fetches all transactions for a given user
router.get("/api/transactions", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "User Must Be Signed In" });
  };

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: userId,
    },
  });

  res.json(transactions);
})

export default router;