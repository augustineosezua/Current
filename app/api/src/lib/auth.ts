import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
  sendPasswordResetEmail,
  passwordResetNotificationEmail,
  emailVerificationEmail,
} from "./email";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }, request) => {
      await sendPasswordResetEmail(user.email, url);
    },
    onPasswordReset: async ({ user }, request) => {
      await passwordResetNotificationEmail(user.email);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await emailVerificationEmail(user.email, url);
    },
  },

  advanced:{
    cookiePrefix: "better-auth",
    useSecureCookies: true,
    cookies:{
      session_token:{
        attributes:{
          sameSite: "none",
          secure: true,
        }
      }
    }
  },

  baseURL:
    process.env.BETTER_AUTH_URL ??
    process.env.BASE_URL ??
    "http://localhost:3001",
  trustedOrigins: [process.env.CORS_ORIGIN ?? "http://localhost:3000"],
});
