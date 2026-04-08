//import dependencies
import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

// Import routers
import plaidRouter from "./plaid/new-user";
import getUserDetailsRouter from "./plaid/get-user-details";
import userCreateDetailsRouter from "./plaid/user-create-details";
import userDeletionRouter from "./plaid/user-deletion";
import userSettingsRouter from "./plaid/user-settings";


const app = express();
const port = 3001;

const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

// limits each IP to 150 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  ipv6Subnet: 64,
})

app.use(cors(corsOptions));
app.use(express.json());
app.use(limiter);

app.all("/api/auth{/*authPath}", toNodeHandler(auth));

app.use(plaidRouter);
app.use(getUserDetailsRouter);
app.use(userCreateDetailsRouter);
app.use(userDeletionRouter);
app.use(userSettingsRouter);

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
