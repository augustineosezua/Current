"use client";
import { useState, useEffect } from "react";
import { authClient, signIn, useSession } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import LoadingScreen from "../components/loading-screen";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (authResolved && session) router.push("/dashboard");
  }, [authResolved, session]);

  if (!authResolved) return <LoadingScreen />;
  if (session) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn.email(
        {
          email,
          password,
          callbackURL: "/dashboard",
        },
        {
          onError: async (ctx) => {
            if (ctx.error.status === 403) {
              await authClient.sendVerificationEmail({
                email,
                callbackURL: "/dashboard",
              });
              toast.error(
                "Please verify your email before signing in. We sent you a new verification link.",
              );
              return;
            }

            toast.error(ctx.error.message || "Invalid email or password.");
          },
        },
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email first, then request a reset link.");
      return;
    }

    setResetLoading(true);
    try {
      const result = await authClient.requestPasswordReset({
        email,
        redirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/reset-password`
            : "/reset-password",
      });

      if (result?.error) {
        toast.error(result.error.message || "Could not send reset link.");
        return;
      }

      toast.success("Password reset link sent. Check your email.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {/* left panel — branding */}
      <div className="w-[42%] flex flex-col border-r border-white/5">
        {/* logo */}
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

        {/* tagline */}
        <div className="flex-1 flex flex-col items-center justify-center px-12 relative">
          <div className="absolute w-80 h-80 rounded-full bg-[#5EB3FF]/10 blur-[80px] pointer-events-none" />
          <div className="relative text-center flex flex-col gap-4">
            <p className="text-[#5EB3FF] text-[10px] font-bold tracking-[0.2em] uppercase">
              Pick up where your money left off.
            </p>
            <h1 className="text-4xl font-bold leading-tight">
              Your budget should update when life does
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Log in to Current
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="px-8 py-4 text-xs text-white/25 flex items-center gap-3">
          <span>© Current</span>
          <span>·</span>
          <Link href="/legal" className="hover:text-white/50 transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/legal" className="hover:text-white/50 transition-colors">Terms</Link>
        </div>
      </div>

      {/* right panel — form */}
      <div className="w-[58%] flex flex-col border-l border-white/5">
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="w-full max-w-sm flex flex-col gap-8">
            {/* heading */}
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="text-white/40 text-sm">
                Sign in to your Current account
              </p>
            </div>

            {/* form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-4">
                  <label
                    htmlFor="password"
                    className="text-white/50 text-[10px] font-bold tracking-[0.15em] uppercase"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={resetLoading}
                    className="text-[11px] font-bold text-[#5EB3FF] hover:text-[#5EB3FF]/80 disabled:opacity-50 transition-colors"
                  >
                    {resetLoading ? "Sending..." : "Forgot password?"}
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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
                {loading ? "Signing in…" : "Sign in →"}
              </button>
            </form>

            {/* switch link */}
            <p className="text-white/30 text-xs text-center">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[#5EB3FF] hover:underline">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
