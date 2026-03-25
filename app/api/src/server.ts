import "dotenv/config";
import express from "express";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import cors from "cors";
import plaidRouter from "./plaid/new-user";
import getUserDetailsRouter from "./plaid/get-user-details";

const app = express();
const port = 3001;

const corsOptions: cors.CorsOptions = {
  origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

app.all("/api/auth{/*authPath}", toNodeHandler(auth));

app.use(plaidRouter);
app.use(getUserDetailsRouter);

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
