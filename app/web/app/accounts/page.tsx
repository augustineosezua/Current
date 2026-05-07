"use client";
import { useSession } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowDownUp } from "lucide-react";
import AppHeader from "../components/app-header";
import LoadingScreen from "../components/loading-screen";
import { toast } from "sonner";

const API = "/api";

interface AccountSummary {
  id: string;
  plaidAccountId: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  institutionName: string;
  isSavingsAccount: boolean;
  availableBalance: string | number;
  currentBalance: string | number;
  linkedAt: string;
  monthSpent: number;
  txnCount: number;
  lastTxnDate: string | null;
}

type SortKey = "balance-desc" | "balance-asc" | "name-asc" | "savings-first" | "spending-first";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "balance-desc", label: "Balance: High → Low" },
  { key: "balance-asc", label: "Balance: Low → High" },
  { key: "name-asc", label: "Name: A → Z" },
  { key: "savings-first", label: "Savings first" },
  { key: "spending-first", label: "Spending first" },
];

function getInitials(name: string) {
  return (name ?? "?")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

function sortAccounts(accounts: AccountSummary[], sort: SortKey): AccountSummary[] {
  return [...accounts].sort((a, b) => {
    switch (sort) {
      case "balance-desc":
        return Number(b.availableBalance) - Number(a.availableBalance);
      case "balance-asc":
        return Number(a.availableBalance) - Number(b.availableBalance);
      case "name-asc":
        return a.accountName.localeCompare(b.accountName);
      case "savings-first":
        return (b.isSavingsAccount ? 1 : 0) - (a.isSavingsAccount ? 1 : 0);
      case "spending-first":
        return (a.isSavingsAccount ? 1 : 0) - (b.isSavingsAccount ? 1 : 0);
    }
  });
}

function fmtBal(n: string | number) {
  const abs = Math.abs(Number(n) || 0);
  const [dollars, cents] = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).split(".");
  return { dollars, cents, negative: Number(n) < 0 };
}

export default function AccountsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<SortKey>("balance-desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
    else if (session) loadAccounts();
  }, [session, isPending]);

  useEffect(() => {
    if (!sortOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [sortOpen]);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/accounts/summary`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) { toast.error("Failed to load accounts."); return; }
      const data = await res.json();
      setAccounts(data.accounts ?? []);
    } catch {
      toast.error("Failed to load accounts.");
    } finally {
      setLoading(false);
    }
  }

  if (!authResolved) return <LoadingScreen />;
  if (!session) return null;

  const sorted = sortAccounts(accounts, sort);
  const spendingTotal = accounts
    .filter((a) => !a.isSavingsAccount)
    .reduce((s, a) => s + Number(a.availableBalance), 0);
  const savingsTotal = accounts
    .filter((a) => a.isSavingsAccount)
    .reduce((s, a) => s + Number(a.availableBalance), 0);
  const activeLabel = SORT_OPTIONS.find((o) => o.key === sort)!.label;

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <AppHeader activePage="accounts" />

      <main className="px-10 py-9 mx-auto w-full max-w-7xl">
        {/* page header */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.5px]">Accounts</h1>
            <p className="text-white/40 text-sm mt-1">
              {loading ? "Loading…" : `${accounts.length} linked account${accounts.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* totals summary */}
          {!loading && accounts.length > 0 && (
            <div className="flex items-center gap-5">
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-[1.5px] text-[#5EB3FF]/60 uppercase mb-0.5">Spending</p>
                <p className="text-[18px] font-bold tabular-nums">
                  ${spendingTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="w-px h-9 bg-white/8" />
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-[1.5px] text-[#3ecf8e]/60 uppercase mb-0.5">Savings</p>
                <p className="text-[18px] font-bold tabular-nums">
                  ${savingsTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* section label + sort */}
        <div className="flex items-center justify-between mb-4 px-1">
          <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase">All Accounts</p>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setSortOpen((o) => !o)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/8 text-white/60 hover:text-white/80 text-[12px] font-semibold transition-colors"
            >
              <ArrowDownUp className="h-3.5 w-3.5" />
              {activeLabel}
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-[#16213E] rounded-2xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-20 py-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => { setSort(opt.key); setSortOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                      opt.key === sort
                        ? "text-[#5EB3FF] bg-[#5EB3FF]/8"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* cards */}
        {loading ? (
          <div className="grid grid-cols-3 gap-5">
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="bg-[#16213E] rounded-[28px] p-7 h-60 animate-pulse" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-[#16213E] rounded-[28px] p-12 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-white/40 text-sm mb-4">No linked accounts.</p>
            <button
              onClick={() => router.push("/settings")}
              className="px-5 py-2.5 rounded-xl bg-[#5EB3FF]/10 text-[#5EB3FF] text-sm font-semibold hover:bg-[#5EB3FF]/16 transition-colors"
            >
              Connect a bank →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {sorted.map((acc) => {
              const { dollars, cents, negative } = fmtBal(acc.availableBalance);
              const isSavings = acc.isSavingsAccount;
              const linkedDate = new Date(acc.linkedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" });

              return (
                <div
                  key={acc.id}
                  className="bg-[#16213E] rounded-[28px] p-7 flex flex-col gap-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                >
                  {/* top row: institution badge + type tag */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* institution initials */}
                      <div className="w-10 h-10 rounded-2xl bg-[#1A1A2E] flex items-center justify-center text-[12px] font-bold text-[#5EB3FF] shrink-0">
                        {getInitials(acc.institutionName ?? acc.accountName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14px] font-semibold leading-snug truncate">{acc.accountName}</p>
                        <p className="text-[11px] text-white/40 truncate">{acc.institutionName}</p>
                      </div>
                    </div>
                    {/* savings / spending badge */}
                    <span
                      className={`shrink-0 text-[10px] font-bold tracking-[0.7px] uppercase px-2.5 py-1 rounded-full ${
                        isSavings
                          ? "bg-[#3ecf8e]/10 text-[#3ecf8e]"
                          : "bg-[#5EB3FF]/10 text-[#5EB3FF]"
                      }`}
                    >
                      {isSavings ? "Savings" : "Spending"}
                    </span>
                  </div>

                  {/* available balance */}
                  <div>
                    <p className="text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                      Available Balance
                    </p>
                    <div className="flex items-baseline gap-0.5">
                      <span className={`text-base font-bold mr-0.5 ${negative ? "text-white/40" : "text-white/50"}`}>
                        {negative ? "−" : ""}$
                      </span>
                      <span
                        className={`text-[30px] font-extrabold leading-none tabular-nums tracking-[-1px] ${
                          negative ? "text-white/50" : "text-white"
                        }`}
                      >
                        {dollars}
                      </span>
                      <span className={`text-[17px] font-bold leading-none tabular-nums ${negative ? "text-white/35" : "text-white/45"}`}>
                        .{cents}
                      </span>
                    </div>
                  </div>

                  {/* stats footer */}
                  <div className="pt-4 border-t border-white/6 grid grid-cols-3 gap-3">
                    {/* MTD spend / activity */}
                    <div>
                      <p className="text-[9px] font-bold tracking-[0.8px] text-white/30 uppercase mb-1">
                        {isSavings ? "MTD activity" : "Spent MTD"}
                      </p>
                      <p className="text-[13px] font-bold tabular-nums text-white/70">
                        {isSavings
                          ? `${acc.txnCount} txn${acc.txnCount !== 1 ? "s" : ""}`
                          : `$${acc.monthSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </p>
                    </div>

                    {/* account subtype */}
                    <div>
                      <p className="text-[9px] font-bold tracking-[0.8px] text-white/30 uppercase mb-1">Type</p>
                      <p className="text-[13px] font-semibold text-white/60 capitalize">
                        {acc.accountSubType || acc.accountType}
                      </p>
                    </div>

                    {/* linked since */}
                    <div>
                      <p className="text-[9px] font-bold tracking-[0.8px] text-white/30 uppercase mb-1">Linked</p>
                      <p className="text-[13px] font-semibold text-white/60">{linkedDate}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
