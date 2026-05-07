"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "../lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token"));
    setTokenChecked(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (!token) return;

    setLoading(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (result?.error) {
        toast.error(result.error.message || "Failed to reset password. The link may have expired.");
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {/* left panel — branding */}
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
              Almost there
            </p>
            <h1 className="text-4xl font-bold leading-tight">
              Choose a password you won&apos;t forget.
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Make it at least 8 characters.
            </p>
          </div>
        </div>

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

            {/* success state */}
            {done ? (
              <div className="flex flex-col gap-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#3ecf8e]/12 border border-[#3ecf8e]/25 flex items-center justify-center text-[#3ecf8e] text-xl font-bold mx-auto">
                  ✓
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">Password updated</h2>
                  <p className="text-white/40 text-sm">Redirecting you to sign in…</p>
                </div>
              </div>

            /* missing or invalid token state */
            ) : tokenChecked && !token ? (
              <div className="flex flex-col gap-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F97316]/12 border border-[#F97316]/25 flex items-center justify-center text-[#F97316] text-xl font-bold mx-auto">
                  !
                </div>
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">Link invalid</h2>
                  <p className="text-white/40 text-sm leading-relaxed">
                    This reset link is missing or has already been used. Request a new one from the sign-in page.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="px-6 py-3 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-sm hover:brightness-110 transition-all text-center"
                >
                  Back to sign in
                </Link>
              </div>

            /* form */
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <h2 className="text-2xl font-bold">Set a new password</h2>
                  <p className="text-white/40 text-sm">
                    Enter your new password below to regain access.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="password"
                      className="text-white/50 text-[10px] font-bold tracking-[0.15em] uppercase"
                    >
                      New password
                    </label>
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

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="confirm-password"
                      className="text-white/50 text-[10px] font-bold tracking-[0.15em] uppercase"
                    >
                      Confirm new password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className={`bg-[#1A1A2E] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none transition-colors ${
                        confirmPassword && password !== confirmPassword
                          ? "border-[#F97316]/60 focus:border-[#F97316]/70"
                          : "border-white/10 focus:border-[#5EB3FF]/50"
                      }`}
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-[#F97316] text-xs font-semibold">
                        Passwords do not match.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !tokenChecked}
                    className="mt-2 px-6 py-3 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-sm hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading && (
                      <div className="w-4 h-4 rounded-full border-2 border-[#1A1A2E]/30 border-t-[#1A1A2E] animate-spin" />
                    )}
                    {loading ? "Updating…" : "Set new password →"}
                  </button>
                </form>

                <p className="text-white/30 text-xs text-center">
                  Remembered it?{" "}
                  <Link href="/login" className="text-[#5EB3FF] hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
