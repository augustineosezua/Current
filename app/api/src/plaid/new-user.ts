import express from "express";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { plaidClient } from "../lib/plaid";
import { CountryCode, Products } from "plaid";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth";
import { encrypt, decrypt } from "../lib/crypto";
import { prisma } from "../lib/prisma";

const router = express.Router();

// 10 link-token requests per user per hour
const linkTokenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as any).userId ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: true,
  legacyHeaders: false,
});

// 5 token exchanges per user per hour
const exchangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).userId ?? ipKeyGenerator(req.ip ?? ""),
  standardHeaders: true,
  legacyHeaders: false,
});

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

// creates a Plaid Link token for the frontend to open the Link flow
router.post("/api/create-link-token", linkTokenLimiter, async (req, res) => {
  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: "Current",
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL,
    });

    return res.json(response.data);
  } catch (error) {
    console.error("Error creating link token:", error);
    return res.status(500).json({ error: "Error creating link token" });
  }
});

// exchanges a one-time Plaid public token for a persistent access token, then syncs accounts and transactions
router.post("/api/exchange-public-token", exchangeLimiter, async (req, res) => {
  try {
    const publicToken = req.body.publicToken;
    const userId = await requireAuth(req, res);
    if (!userId) return;

    if (!publicToken) {
      return res.status(400).json({ error: "Public token is required" });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const { access_token, item_id } = response.data;

    // encrypt before persisting — a DB breach must not expose raw Plaid tokens
    const encryptedToken = encrypt(access_token);

    // reset cursor on relink so the full transaction history is fetched again
    await prisma.plaidUser.upsert({
      where: { plaidItemId: item_id },
      create: {
        id: crypto.randomUUID(),
        plaidAccessToken: encryptedToken,
        plaidItemId: item_id,
        plaidUserId: userId,
        user: { connect: { id: userId } },
      },
      update: { plaidAccessToken: encryptedToken, cursor: null },
    });

    const bankAccountData = await getBankAccounts(access_token);
    await setBankAccounts(userId, item_id, bankAccountData);
    await setPlaidTransactions(access_token, userId, item_id);

    return res.json({ success: true });
  } catch (error) {
    console.error("Error exchanging public token:", error);
    return res.status(500).json({ error: "Error exchanging public token" });
  }
});

// fetches account data from Plaid using a raw access token
async function getBankAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });

  return response.data;
}

// upserts bank accounts from Plaid into the DB
async function setBankAccounts(userId: string, itemId: string, data: any) {
  const plaidUser = await prisma.plaidUser.findUnique({
    where: { plaidItemId: itemId },
  });

  // plaidUser must exist before accounts can be written
  if (!plaidUser) {
    throw new Error("No Plaid User Found");
  }

  const item = data.item;
  const accounts = data.accounts;

  // upsert each account returned by Plaid
  for (const account of accounts) {
    await prisma.bankAccounts.upsert({
      where: { plaidAccountId: account.account_id },
      update: {
        accountName: account.name || "",
        currentBalance: account.balances.current || 0,
        availableBalance: account.balances.available || account.balances.current || 0,
      },
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
        availableBalance: account.balances.available || account.balances.current || 0,
        currency: account.balances.iso_currency_code || "",
      },
    });
  }

  return data;
}

// maps a raw Plaid transaction object to the fields we store in the DB
function buildTransactionData(transaction: any) {
  // prefer datetime (has time-of-day), fall back to authorized_datetime, then date-only
  const transactionTime = transaction.datetime
    ? new Date(transaction.datetime)
    : transaction.authorized_datetime
      ? new Date(transaction.authorized_datetime)
      : new Date(transaction.date);

  // collapse the Plaid location object into a single readable address string
  const loc = transaction.location;
  const transactionLocation = loc
    ? [loc.address, loc.city, loc.region, loc.postal_code, loc.country]
        .filter(Boolean)
        .join(", ") || null
    : null;

  return {
    accountId: transaction.account_id,
    amount: transaction.amount,
    date: new Date(transaction.date),
    merchantName: transaction.merchant_name ?? null,
    logoUrl: transaction.logo_url ?? null,
    category: transaction.personal_finance_category?.primary
      ? [transaction.personal_finance_category.primary]
      : [],
    transactionType: transaction.payment_channel,
    // pending=true means the transaction hasn't settled yet
    transactionStatus: transaction.pending ? "pending" : "posted",
    // detailed is a subcategory of primary, e.g. FOOD_AND_DRINK_FAST_FOOD
    transactionCategory:
      transaction.personal_finance_category?.detailed ?? null,
    transactionTime,
    transactionLocation,
  };
}

// pages through Plaid's transaction sync cursor and writes added, modified, and removed transactions to the DB
export async function setPlaidTransactions(
  accessToken: string,
  userId: string,
  itemId: string,
) {
  const plaidUser = await prisma.plaidUser.findUnique({
    where: { plaidItemId: itemId },
  });

  // decrypt if the token came from the DB; use raw if it came from the exchange flow
  const resolvedToken = (() => {
    try {
      return decrypt(accessToken);
    } catch {
      return accessToken;
    }
  })();

  let cursor: string | undefined = plaidUser?.cursor ?? undefined;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: resolvedToken,
        cursor,
      });

      const data = response.data;

      // upsert new transactions from Plaid
      for (const transaction of data.added) {
        const fields = buildTransactionData(transaction);
        await prisma.transaction.upsert({
          where: { plaidTransactionId: transaction.transaction_id },
          update: fields,
          create: {
            id: crypto.randomUUID(),
            userId,
            plaidTransactionId: transaction.transaction_id,
            ...fields,
          },
        });
      }

      // update transactions Plaid has changed
      for (const transaction of data.modified) {
        const fields = buildTransactionData(transaction);
        await prisma.transaction.upsert({
          where: { plaidTransactionId: transaction.transaction_id },
          update: fields,
          create: {
            id: crypto.randomUUID(),
            userId,
            plaidTransactionId: transaction.transaction_id,
            ...fields,
          },
        });
      }

      // delete transactions Plaid has removed
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
  } catch (error) {
    // cursor is not saved so the next sync retries from the last successful page
    console.error("Transaction sync failed mid-page:", error);
    throw error;
  }

  // only persist cursor after a complete successful sync
  if (plaidUser && cursor) {
    await prisma.plaidUser.update({
      where: { id: plaidUser.id },
      data: { cursor },
    });
  }
}

export default router;
