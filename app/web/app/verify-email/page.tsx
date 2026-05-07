"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";

const onboardingCallbackURL =
  typeof window === "undefined"
    ? "/onboarding?step=intro"
    : `${window.location.origin}/onboarding?step=intro`;

export default function VerifyEmailPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
  }, []);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Enter your email so we can resend the verification link.");
      return;
    }

    setLoading(true);
    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: onboardingCallbackURL,
      });

      if (result?.error) {
        toast.error(result.error.message || "Could not send verification link.");
        return;
      }

      toast.success("Verification link sent. Check your email.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      <div className="w-[42%] flex flex-col border-r border-white/5">
        <div
          className="flex items-center px-8 pt-1 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <div className="flex items-center gap-2 py-4">
            <div className="w-8 h-8 rounded-md bg-[#5EB3FF] flex items-center justify-center font-bold text-[#1A1A2E] text-lg">
              C
            </div>
            <span className="font-semibold text-xl">Current</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-12 relative">
          <div className="absolute w-80 h-80 rounded-full bg-[#5EB3FF]/10 blur-[80px] pointer-events-none" />
          <div className="relative text-center flex flex-col gap-4">
            <p className="text-[#5EB3FF] text-[10px] font-bold tracking-[0.2em] uppercase">
              One quick check
            </p>
            <h1 className="text-4xl font-bold leading-tight">
              Verify your email to keep your account secure
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Your dashboard is waiting on the other side.
            </p>
          </div>
        </div>

        <div className="px-8 py-4 text-xs text-white/25">
          © Current · Secured by Plaid · Read-only access
        </div>
      </div>

      <div className="w-[58%] flex flex-col border-l border-white/5">
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="w-full max-w-sm flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">Check your email</h2>
              <p className="text-white/40 text-sm">
                We sent a verification link. It will take you to onboarding.
              </p>
            </div>

            <form onSubmit={handleResend} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-white/50 text-[10px] font-bold tracking-[0.15em] uppercase"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="bg-[#1A1A2E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 px-6 py-3 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && (
                  <div className="w-4 h-4 rounded-full border-2 border-[#1A1A2E]/30 border-t-[#1A1A2E] animate-spin" />
                )}
                {loading ? "Sending..." : "Resend verification email"}
              </button>
            </form>

            <p className="text-white/30 text-xs text-center">
              Already verified?{" "}
              <Link href="/login" className="text-[#5EB3FF] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
