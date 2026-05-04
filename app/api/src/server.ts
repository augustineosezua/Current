import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

import plaidRouter from "./plaid/new-user";
import plaidWebhookRouter from "./plaid/webhook";
import getUserDetailsRouter from "./plaid/get-user-details";
import userCreateDetailsRouter from "./plaid/user-create-details";
import userDeletionRouter from "./plaid/user-deletion";
import userSettingsRouter from "./plaid/user-settings";
import userUpdateDetails from "./plaid/user-update-details";
import { prisma } from "./lib/prisma";

const app = express();
const port = 3001;

// restrict to trusted frontend origin
const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

// 200 req per 15 min global cap
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 64,
});

// strips __proto__, constructor, prototype keys recursively to prevent prototype pollution
function sanitizeBody(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeBody);
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    safe[key] = sanitizeBody(value);
  }
  return safe;
}

app.use(cors(corsOptions));

// webhook router must precede express.json() — it uses express.raw() per-route
// so the raw body bytes are available for Plaid signature verification
app.use(plaidWebhookRouter);

app.use(express.json());

// sets security headers on every response
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// sanitizes parsed body before it reaches any route handler
app.use((req, _res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeBody(req.body);
  }
  next();
});

app.use(limiter);

// unauthenticated — used by load balancers and uptime monitors
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ status: "ok", uptime: Math.floor(process.uptime()), timestamp: new Date().toISOString() });
  } catch {
    return res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
  }
});

app.all("/api/auth{/*authPath}", toNodeHandler(auth));

app.use(plaidRouter);
app.use(getUserDetailsRouter);
app.use(userCreateDetailsRouter);
app.use(userDeletionRouter);
app.use(userSettingsRouter);
app.use(userUpdateDetails);

// catches any error thrown inside a route handler that wasn't caught locally
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
