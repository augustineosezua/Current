import express from "express";
import { plaidClient } from "../lib/plaid";
import { CountryCode, Products } from "plaid";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const router = express.Router();
const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

router.post("/api/create-link-token", async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Current",
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca],
      language: "en",
    });

    return res.json(response.data);
  } catch (error) {
    return res.status(500).json({
      error: "Error creating link token",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

router.post("/api/exchange-public-token", async (req, res) => {
  try {
    const publicToken = req.body.publicToken;
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).json({ error: "User Must Be Signed In" });
    }

    if (!publicToken) {
      return res.status(400).json({ error: "Public token is required" });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const { access_token, item_id } = response.data;
    await prisma.plaidUser.create({
      data: {
        id: crypto.randomUUID(),
        plaidAccessToken: access_token,
        plaidItemId: item_id,
        plaidUserId: userId,
        user: {
          connect: { id: userId },
        },
      },
    });

    const bankAccountData = await getBankAccounts(access_token);
    await setBankAccounts(userId, bankAccountData);
    await setPlaidTransactions(access_token, userId);

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({
      error: "Error exchanging public token",
      errorDetails: error instanceof Error ? error.message : error,
    });
  }
});

async function getBankAccounts(acessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: acessToken,
  });

  return response.data;
}

async function setBankAccounts(userId: string, data: any) {
  const plaidUser = await prisma.plaidUser.findFirst({
    where: { plaidUserId: userId },
  });

  if (!plaidUser) {
    throw new Error("No Plaid User Found");
  }

  const item = data.item;
  const accounts = data.accounts;
  const requestId = data.request_id;

  for (const account of accounts) {
    await prisma.bankAccounts.upsert({
      where: { plaidAccountId: account.account_id },
      update: {},
      create: {
        userId: userId,
        plaidAccountId: account.account_id,
        plaidUserId: plaidUser.id,
        accountName: account.name || "",
        accountType: account.type || "",
        accountSubType: account.subtype || "",
        institutionName: item.institution_name || "",
        institutionId: item.institution_id || "",
        currentBalance: account.balances.current || 0,
        availableBalance: account.balances.available || 0,
        accountCategory: "Spending", //will be update with a different endpoint that allows for user to change
        currency: account.balances.iso_currency_code || "",
      },
    });
  }

  return data;
}

async function setPlaidTransactions(accessToken: string, userId: string) {
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const data = response.data;

    for (const transaction of data.added) {
      await prisma.transaction.upsert({
        where: { plaidTransactionId: transaction.transaction_id },
        update: {
          accountId: transaction.account_id,
          amount: transaction.amount,
          date: new Date(transaction.date),
          mechantName: transaction.merchant_name ?? null,
          category: transaction.personal_finance_category?.primary ? [transaction.personal_finance_category.primary] : [],
          transactionType: transaction.payment_channel,
        },
        create: {
          accountId: transaction.account_id,
          id: crypto.randomUUID(),
          userId,
          plaidTransactionId: transaction.transaction_id,
          amount: transaction.amount,
          date: new Date(transaction.date),
          mechantName: transaction.merchant_name ?? null,
          category: transaction.personal_finance_category?.primary ? [transaction.personal_finance_category.primary] : [],
          transactionType: transaction.payment_channel,
        },
      });
    }

    for (const transaction of data.modified) {
      await prisma.transaction.update({
        where: { plaidTransactionId: transaction.transaction_id },
        data: {
          amount: transaction.amount,
          date: new Date(transaction.date),
          mechantName: transaction.merchant_name ?? null,
          category: transaction.personal_finance_category?.primary ? [transaction.personal_finance_category.primary] : [],
          transactionType: transaction.payment_channel,
        },
      });
    }

    for (const transaction of data.removed) {
      if (transaction.transaction_id) {
        await prisma.transaction.deleteMany({
          where: { plaidTransactionId: transaction.transaction_id },
        });
      }
    }

    hasMore = data.has_more;
    cursor = data.next_cursor;
  }
}

export default router;
