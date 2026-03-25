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

  res.json(response.data);
});

router.post("/api/exchange-public-token", async (req, res) => {
  const publicToken = req.body.publicToken;

  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const { access_token, item_id } = response.data;
  const newPlaidUser = await prisma.plaidUser.create({
    data: {
      id: crypto.randomUUID(),
      plaidAccessToken: access_token,
      plaidItemId: item_id,
      plaidUserId: req.body.userId, // Add the required plaidUserId
      user: {
        connect: { id: req.body.userId },
      },
    },
  });

  const bankAccountData = await getBankAccounts(access_token);
  await setBankAccounts(req.body.userId, bankAccountData);
  await setPlaidTransactions(access_token, req.body.userId);

  res.json({ success: true });
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
        id: crypto.randomUUID(),
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
          amount: transaction.amount,
          date: new Date(transaction.date),
          mechantName: transaction.merchant_name ?? null,
          category: transaction.personal_finance_category?.primary ? [transaction.personal_finance_category.primary] : [],
          transactionType: transaction.payment_channel,
        },
        create: {
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