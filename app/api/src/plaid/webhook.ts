import express from "express";
import crypto from "crypto";
import { plaidClient } from "../lib/plaid";
import { prisma } from "../lib/prisma";
import { setPlaidTransactions } from "./new-user";

const router = express.Router();

// Plaid rotates keys infrequently — cache avoids a round-trip on every webhook
const keyCache = new Map<string, crypto.KeyObject>();

async function getVerificationKey(kid: string): Promise<crypto.KeyObject> {
  const cached = keyCache.get(kid);
  if (cached) return cached;
  const res = await plaidClient.webhookVerificationKeyGet({ key_id: kid });
  const key = crypto.createPublicKey({ key: res.data.key as JsonWebKey, format: "jwk" });
  keyCache.set(kid, key);
  return key;
}

// Plaid signs webhook JWTs with ES256 (P-256 + SHA-256). The JWT payload includes
// request_body_sha256 so a MITM cannot swap the body after signing.
async function verifyPlaidSignature(rawBody: Buffer, token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [h, p, sig] = parts;

  let header: { kid?: string; alg?: string };
  let payload: { iat?: number; request_body_sha256?: string };
  try {
    header = JSON.parse(Buffer.from(h, "base64url").toString("utf-8"));
    payload = JSON.parse(Buffer.from(p, "base64url").toString("utf-8"));
  } catch {
    return false;
  }

  if (!header.kid || header.alg !== "ES256") return false;

  // reject tokens older than 5 minutes to prevent replay attacks
  if (!payload.iat || payload.iat < Math.floor(Date.now() / 1000) - 300) return false;

  const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");
  if (bodyHash !== payload.request_body_sha256) return false;

  try {
    const publicKey = await getVerificationKey(header.kid);
    return crypto.verify(
      "SHA256",
      Buffer.from(`${h}.${p}`),
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(sig, "base64url"),
    );
  } catch {
    return false;
  }
}

// express.raw is applied at the route level so this route gets the raw Buffer before the
// global express.json() middleware runs — necessary for body-hash signature verification
router.post("/api/plaid/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const rawBody = req.body as Buffer;
  const verificationToken = req.headers["plaid-verification"] as string | undefined;

  // sandbox webhooks don't carry a real JWT signature
  const isSandbox = process.env.PLAID_ENVIRONMENT === "sandbox";

  if (!isSandbox) {
    if (!verificationToken) {
      return res.status(401).json({ error: "Missing verification token" });
    }
    const valid = await verifyPlaidSignature(rawBody, verificationToken);
    if (!valid) {
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString("utf-8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  const { webhook_type, webhook_code, item_id } = body as {
    webhook_type: string;
    webhook_code: string;
    item_id: string;
  };

  if (!webhook_type || !webhook_code || !item_id) {
    return res.status(400).json({ error: "Missing required webhook fields" });
  }

  // respond immediately — Plaid retries if we take longer than 10s
  res.status(200).json({ received: true });

  handleWebhookAsync(webhook_type, webhook_code, item_id).catch((err) => {
    console.error(`Webhook handler error [${webhook_type}/${webhook_code}] itemId=${item_id}:`, err);
  });
});

async function handleWebhookAsync(webhookType: string, webhookCode: string, itemId: string) {
  if (webhookType === "TRANSACTIONS") {
    const syncCodes = ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "DEFAULT_UPDATE"];
    if (!syncCodes.includes(webhookCode)) return;

    const plaidUser = await prisma.plaidUser.findUnique({ where: { plaidItemId: itemId } });
    if (!plaidUser) {
      console.warn(`Webhook: no plaidUser found for itemId=${itemId}`);
      return;
    }

    // setPlaidTransactions decrypts the token internally
    await setPlaidTransactions(plaidUser.plaidAccessToken, plaidUser.userId, itemId);
    return;
  }

  if (webhookType === "ITEM") {
    // all three codes indicate the user must re-authenticate through Plaid Link
    const reAuthCodes = ["ERROR", "USER_PERMISSION_REVOKED", "PENDING_EXPIRATION"];
    if (reAuthCodes.includes(webhookCode)) {
      await prisma.plaidUser.update({
        where: { plaidItemId: itemId },
        data: { needsReAuth: true },
      });
    }
    return;
  }
}

export default router;
