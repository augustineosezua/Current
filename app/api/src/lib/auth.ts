import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "../generated/prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient({
  accelerateUrl: process.env.DATABASE_URL!,
}).$extends(withAccelerate());

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword:{
    enabled: true,
    //need password reset
  },
  
  baseURL: process.env.BASE_URL ?? "http://localhost:3001",
  trustedOrigins: [process.env.CORS_ORIGIN ?? "http://localhost:3000"],
});