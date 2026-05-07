"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AccountsProps {
  setCategorizationCompleted: (val: boolean) => void;
  setOnboardingStep: (step: string) => void;
  plaidUserData: any;
  session: any;
}

const steps = ["Welcome", "Bank", "Accounts", "Setup", "Done"];

const clean = (s: string) => (s ?? "").replace(/[^a-zA-Z0-9 ]/g, "").trim();

function getInitials(name: string) {
  return clean(name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();
}

function formatDollars(n: number | string) {
  return Math.floor(Number(n) || 0).toLocaleString();
}

function formatCents(n: number | string) {
  return (Number(n) || 0).toFixed(2).split(".")[1];
}

export default function Accounts({
  setCategorizationCompleted,
  setOnboardingStep,
  plaidUserData,
}: AccountsProps) {
  const API = "/api";
  const router = useRouter();
  const [accounts, setAccounts] = useState<any[]>([]);
  // tracks isSavings per account id; updates live as user toggles
  const [savingsMap, setSavingsMap] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const accs = plaidUserData?.plaidUser?.bankAccounts;
    if (!accs) return;
    setLoading(false);
    if (accs.length === 0) {
      setOnboardingStep("connect");
      return;
    }
    setAccounts(accs);
    const map: Record<string, boolean> = {};
    accs.forEach((a: any) => {
      map[a.id] = a.isSavingsAccount ?? a.accountSubType === "savings";
    });
    setSavingsMap(map);
  }, [plaidUserData]);

  const toggle = (id: string, isSavings: boolean) =>
    setSavingsMap((prev) => ({ ...prev, [id]: isSavings }));

  const spendingTotal = accounts
    .filter((a) => !savingsMap[a.id])
    .reduce((sum, a) => sum + (Number(a.availableBalance) || 0), 0);

  const savingsTotal = accounts
    .filter((a) => savingsMap[a.id])
    .reduce((sum, a) => sum + (Number(a.availableBalance) || 0), 0);

  const deleteAccount = async (accountId: string) => {
    setRemovingId(accountId);
    const deleted = await fetch(`${API}/delete/bank-account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ accountId }),
    });
    setRemovingId(null);

    if (!deleted.ok) {
      toast.error("Couldn't remove account. Please try again.");
      return;
    }

    setDeletingId(null);
    setAccounts((prev) => prev.filter((a) => a.id !== accountId));
    toast.success("Account removed.");
  };

  const handleConfirm = async () => {
    setSaving(true);
    for (const account of accounts) {
      await fetch(`${API}/accounts/savings-toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          accountId: account.id,
          isSavings: savingsMap[account.id] ?? false,
        }),
      });
    }
    await fetch(`${API}/settings`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingStep: "setup" }),
    });
    setCategorizationCompleted(true);
    setOnboardingStep("setup");
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {/* left panel */}
      <div className="w-[42%] flex flex-col border-r border-white/8">
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

        {/* summary */}
        <div className="flex-1 flex flex-col justify-center px-10 gap-6 relative">
          {/* ambient glow */}
          <div className="absolute w-130 h-130 rounded-full bg-[#5EB3FF]/15 blur-[120px] pointer-events-none top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2" />

          <div className="relative flex flex-col gap-2">
            <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase">
              Your accounts, grouped
            </p>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              Two buckets. Nothing more to remember.
            </h2>
          </div>

          {/* spending card */}
          <div className="relative bg-[#16213E] rounded-[28px] p-6 flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div>
              <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
                Spending power
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[#5EB3FF]/60 text-2xl font-bold leading-none mr-0.5">
                  $
                </span>
                <span className="text-[#5EB3FF] text-5xl font-bold leading-none">
                  {formatDollars(spendingTotal)}
                </span>
                <span className="text-[#5EB3FF]/45 text-3xl font-bold leading-none">
                  .{formatCents(spendingTotal)}
                </span>
              </div>
            </div>
            <div className="h-px bg-white/8" />
            <p className="text-white/35 text-xs">Drives Safe-To-Spend</p>
          </div>

          {/* savings card — gold accent */}
          <div className="relative bg-[#16213E] rounded-[28px] p-6 flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div>
              <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
                Savings
              </p>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[#F5C400]/60 text-2xl font-bold leading-none mr-0.5">
                  $
                </span>
                <span className="text-[#F5C400] text-5xl font-bold leading-none">
                  {formatDollars(savingsTotal)}
                </span>
                <span className="text-[#F5C400]/45 text-3xl font-bold leading-none">
                  .{formatCents(savingsTotal)}
                </span>
              </div>
            </div>
            <div className="h-px bg-white/8" />
            <p className="text-white/35 text-xs">Powers your goals</p>
          </div>
        </div>

        {/* footer */}
        <div className="px-8 py-4 text-xs text-white/25">
          © Current · Secured by Plaid · Read-only access
        </div>
      </div>

      {/* right panel */}
      <div className="w-[58%] flex flex-col border-l border-white/8">
        {/* top nav */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/8">
          <div className="flex items-center gap-1 text-xs text-white/40">
            {steps.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < 2
                      ? "bg-[#3ecf8e] text-[#1A1A2E]"
                      : i === 2
                        ? "bg-[#5EB3FF] text-[#1A1A2E]"
                        : "border border-white/20 text-white/30"
                  }`}
                >
                  {i < 2 ? "✓" : i + 1}
                </span>
                <span
                  className={
                    i === 2
                      ? "text-white font-semibold"
                      : i < 2
                        ? "text-white/40"
                        : ""
                  }
                >
                  {name}
                </span>
                {i < steps.length - 1 && (
                  <span className="mx-1 tracking-widest text-white/20">··</span>
                )}
              </div>
            ))}
          </div>
          <button className="text-xs text-white/40 hover:text-white/70 transition-colors text-right leading-tight">
            Need
            <br />
            help?
          </button>
        </div>

        {/* account list */}
        <div className="flex-1 flex flex-col px-10 py-8 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
              Tag each account.
            </h1>
            <p className="text-white/40 text-sm leading-relaxed">
              Spending accounts feed your Safe-To-Spend. Savings accounts power
              your goals.
            </p>
          </div>

          {/* debt account callout */}
          <div className="mb-4 flex gap-3 bg-[#5EB3FF]/8 border border-[#5EB3FF]/18 rounded-2xl px-4 py-3.5">
            <span className="text-[#5EB3FF] text-base leading-none mt-0.5">
              ⚠
            </span>
            <div>
              <p className="text-white/80 text-[13px] font-semibold leading-snug mb-0.5">
                Remove debt accounts before continuing
              </p>
              <p className="text-white/40 text-[12px] leading-relaxed">
                Mortgages, student loans, credit cards, and lines of credit have
                negative balances that will reduce your Safe-To-Spend. Use the{" "}
                <span className="text-white/60 font-medium">
                  Remove account
                </span>{" "}
                button below to exclude them.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {loading && (
              <>
                {(["w-44", "w-36", "w-40"] as const).map((nameW, i) => (
                  <div
                    key={i}
                    className="bg-[#16213E] rounded-[20px] px-5 py-4 flex flex-col gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] animate-pulse"
                  >
                    {/* skeleton account info row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/[0.07] shrink-0" />
                        <div className="flex flex-col gap-1.5">
                          <div
                            className={`h-3 rounded-full bg-white/8 ${nameW}`}
                          />
                          <div className="h-2.5 rounded-full bg-white/5 w-28" />
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <div className="h-4 rounded-full bg-white/8 w-20" />
                        <div className="h-2 rounded-full bg-white/5 w-12" />
                      </div>
                    </div>
                    {/* skeleton toggles */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-9 rounded-full bg-white/6" />
                      <div className="h-9 rounded-full bg-white/6" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!loading &&
              accounts.map((account: any) => {
                const isSavings = savingsMap[account.id] ?? false;
                const bal = Number(account.availableBalance) || 0;
                const subtypeRaw = clean(account.accountSubType ?? "");
                const subtype = subtypeRaw
                  ? subtypeRaw.charAt(0).toUpperCase() + subtypeRaw.slice(1)
                  : "";

                const isRemoving = removingId === account.id;

                return (
                  <div
                    key={account.id}
                    className={`bg-[#16213E] rounded-[20px] px-5 py-4 flex flex-col gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-opacity duration-300 ${isRemoving ? "opacity-40 animate-pulse pointer-events-none" : ""}`}
                  >
                    {/* account info row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1A1A2E] flex items-center justify-center text-[11px] font-bold text-[#5EB3FF] shrink-0">
                          {getInitials(
                            account.institutionName ?? account.accountName,
                          )}
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold leading-none mb-0.5">
                            {clean(account.accountName ?? "")}
                          </p>
                          <p className="text-white/35 text-[11px]">
                            {clean(account.institutionName ?? "")}
                            {subtype ? ` · ${subtype}` : ""}
                            {account.mask
                              ? ` · ••${clean(String(account.mask))}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-baseline gap-0.5 justify-end">
                          <span className="text-white/50 text-xs font-bold mr-0.5">
                            $
                          </span>
                          <span className="text-white text-lg font-bold">
                            {formatDollars(bal)}
                          </span>
                          <span className="text-white/40 text-sm font-bold">
                            .{formatCents(bal)}
                          </span>
                        </div>
                        <p className="text-white/25 text-[10px] tracking-widest uppercase">
                          Balance
                        </p>
                      </div>
                    </div>

                    {/* spending / savings toggle */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => toggle(account.id, false)}
                        className={`py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                          !isSavings
                            ? "bg-[#5EB3FF] text-[#1A1A2E]"
                            : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                        }`}
                      >
                        {!isSavings ? "✓ " : ""}Spending
                      </button>
                      <button
                        onClick={() => toggle(account.id, true)}
                        className={`py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                          isSavings
                            ? "bg-[#F5C400] text-[#1A1A2E]"
                            : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                        }`}
                      >
                        {isSavings ? "✓ " : ""}Savings
                      </button>
                    </div>

                    {/* delete — confirm inline to prevent accidents; no unauthorized colors */}
                    {deletingId === account.id ? (
                      <div className="flex items-center justify-between bg-white/4 border border-white/8 rounded-full px-4 py-2">
                        <span className="text-[12px] text-white/45">
                          Remove this account?
                        </span>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setDeletingId(null)}
                            className="text-[12px] text-white/35 hover:text-white/60 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => deleteAccount(account.id)}
                            className="text-[12px] text-white/70 hover:text-white font-bold transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeletingId(account.id)}
                        className="text-[11px] text-white/20 hover:text-white/50 transition-colors text-center"
                      >
                        Remove account
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        {/* confirm — pinned to bottom */}
        <div className="px-10 pb-8 pt-4 border-t border-white/8">
          <button
            onClick={handleConfirm}
            disabled={loading || saving || accounts.length === 0}
            className="w-full py-3.5 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-[15px] hover:brightness-110 transition-all disabled:opacity-45 disabled:cursor-not-allowed tracking-[-0.2px]"
          >
            {saving
              ? "Saving…"
              : `Confirm ${accounts.length} account${accounts.length !== 1 ? "s" : ""} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
