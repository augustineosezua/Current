// The only server Current runs until ROADMAP 3.7: the stateless AI fallback proxy (2.9).
// Separate from server.ts so it needs no Postgres, Better Auth or Plaid configuration.
// Env: ANTHROPIC_API_KEY, REVENUECAT_SECRET_KEY, optional REVENUECAT_ENTITLEMENT (default "plus"), PORT.
import express from "express";

import { aiRouter } from "./ai/proxy.ts";

const app = express();
const port = process.env.PORT ?? 3002;

// Cloud Run sits behind one proxy
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});
app.use("/ai", aiRouter);

app.listen(port, () => {
  console.log(`AI proxy listening on ${port}`);
});
