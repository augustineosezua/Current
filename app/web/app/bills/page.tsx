"use client";

import { useSession } from "../lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Droplets,
  Home,
  Music,
  Pencil,
  Plus,
  Receipt,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import AppHeader from "../components/app-header";
import ErrorDashboard from "../dashboard/error-dashboard";
import LoadingScreen from "../components/loading-screen";

type LoadingState = "loading" | "loaded" | "error";
type SortOption = "due-asc" | "due-desc" | "amount-desc" | "amount-asc" | "name-asc";

interface Bill {
  id: string;
  billName: string;
  amount: string | number;
  dueDate: string;
  isPaid: boolean;
  isReccuring: boolean;
  frequency: string | null;
}

interface Suggestion {
  billId: string;
  transactionId: string;
  merchantName?: string;
  transactionAmount?: string | number;
}

function billIcon(name: string): LucideIcon {
  const s = name.toLowerCase();
  if (s.includes("rent") || s.includes("housing") || s.includes("mortgage")) return Home;
  if (s.includes("phone") || s.includes("mobile") || s.includes("wireless")) return Smartphone;
  if (
    s.includes("spotify") || s.includes("netflix") || s.includes("music") ||
    s.includes("subscription") || s.includes("streaming")
  ) return Music;
  if (s.includes("electric") || s.includes("power") || s.includes("utility") || s.includes("hydro")) return Zap;
  if (s.includes("water") || s.includes("gas")) return Droplets;
  if (s.includes("internet") || s.includes("wifi") || s.includes("cable")) return Wifi;
  if (s.includes("insurance")) return Shield;
  return Receipt;
}

function shortDate(s: string): string {
  if (!s) return "";
  try {
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function daysUntil(s: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = s.slice(0, 10).split("-").map(Number);
    return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
  } catch {
    return 0;
  }
}

function isOverdueBill(dueDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dueDate.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d) < today;
}

function sortBills(bills: Bill[], sort: SortOption): Bill[] {
  return [...bills].sort((a, b) => {
    switch (sort) {
      case "due-asc":
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      case "due-desc":
        return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
      case "amount-asc":
        return Number(a.amount) - Number(b.amount);
      case "amount-desc":
        return Number(b.amount) - Number(a.amount);
      case "name-asc":
        return a.billName.localeCompare(b.billName);
    }
  });
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Twice monthly",
  monthly: "Monthly",
  yearly: "Yearly",
};

function freqLabel(bill: Bill): string {
  if (!bill.isReccuring) return "One-time";
  return FREQ_LABELS[bill.frequency ?? ""] ?? "Recurring";
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function fmtAmount(n: string | number): string {
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Bills() {
  const router = useRouter();
  const API = "/api";
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");

  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 30;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [markingPaidIds, setMarkingPaidIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("due-asc");
  const [editingBill, setEditingBill] = useState<Bill | null>(null);

  // add / edit panel shared form fields
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDueDate, setAddDueDate] = useState("");
  const [addRecurring, setAddRecurring] = useState(false);
  const [addFrequency, setAddFrequency] = useState("monthly");
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  const hasMore = bills.length < total;

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
    else if (session?.user.id) loadData();
  }, [session, isPending]);

  // load more bills when sentinel enters viewport
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && loadingState === "loaded") {
          loadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadingState]);

  if (!authResolved) return <LoadingScreen />;
  if (!session) {
    router.push("/login");
    return null;
  }

  async function loadData() {
    if (!session) { router.push("/login"); return; }
    try {
      const [billsRes, suggestionsRes] = await Promise.all([
        fetch(`${API}/bills-all?skip=0&take=${PAGE_SIZE}`, { credentials: "include" }),
        fetch(`${API}/bills/suggestions`, { credentials: "include" }),
      ]);
      if (!billsRes.ok) { setLoadingState("error"); return; }
      const billsData = await billsRes.json();
      setBills(billsData.bills ?? []);
      setTotal(billsData.total ?? (billsData.bills ?? []).length);
      if (suggestionsRes.ok) {
        const sugData = await suggestionsRes.json();
        setSuggestions(sugData.suggestions ?? []);
      }
      setLoadingState("loaded");
    } catch {
      setLoadingState("error");
    }
  }

  async function loadMore() {
    if (!session || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/bills-all?skip=${bills.length}&take=${PAGE_SIZE}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setBills((prev) => [...prev, ...(data.bills ?? [])]);
      setTotal(data.total ?? total);
    } catch {/* silent */}
    finally { setLoadingMore(false); }
  }

  async function markPaid(billId: string) {
    const bill = bills.find(b => b.id === billId);
    setMarkingPaidIds(prev => { const n = new Set(prev); n.add(billId); return n; });
    // optimistic: flip isPaid so it moves to the paid section immediately
    setBills(prev => prev.map(b => b.id === billId ? { ...b, isPaid: true } : b));
    try {
      const res = await fetch(`${API}/bills/${billId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: true }),
      });
      if (!res.ok) { toast.error("Failed to mark bill as paid."); loadData(); }
      else {
        toast.success("Marked as paid.");
        // backend spawns the next occurrence for recurring bills — reload to show it
        if (bill?.isReccuring) loadData();
      }
    } catch {
      toast.error("Something went wrong."); loadData();
    } finally {
      setMarkingPaidIds(prev => { const n = new Set(prev); n.delete(billId); return n; });
    }
  }

  async function confirmMatch(billId: string, transactionId: string) {
    const bill = bills.find(b => b.id === billId);
    setSuggestions(prev => prev.filter(s => s.billId !== billId));
    setBills(prev => prev.map(b => b.id === billId ? { ...b, isPaid: true } : b));
    try {
      const res = await fetch(`${API}/bills/match`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, transactionId }),
      });
      if (!res.ok) { toast.error("Failed to confirm match."); loadData(); }
      else {
        toast.success("Bill matched and marked as paid.");
        // reload to pick up the next occurrence the backend spawned for recurring bills
        if (bill?.isReccuring) loadData();
      }
    } catch {
      toast.error("Something went wrong."); loadData();
    }
  }

  async function deleteBill(billId: string) {
    setConfirmDeleteId(null);
    setBills(prev => prev.filter(b => b.id !== billId));
    try {
      const res = await fetch(`${API}/delete/bill`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId }),
      });
      if (!res.ok) { toast.error("Failed to delete bill."); loadData(); }
    } catch {
      toast.error("Something went wrong."); loadData();
    }
  }

  async function handleAddBill(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addAmount || !addDueDate) return;
    setAddSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: addName.trim(),
        amount: parseFloat(addAmount),
        dueDate: addDueDate,
        isReccuring: addRecurring,
      };
      if (addRecurring) body.frequency = addFrequency;
      const res = await fetch(`${API}/bills`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Failed to add bill."); return; }
      const data = await res.json();
      const newBill: Bill = data.bill ?? {
        id: Math.random().toString(36).slice(2),
        billName: addName.trim(),
        amount: parseFloat(addAmount),
        dueDate: addDueDate,
        isPaid: false,
        isReccuring: addRecurring,
        frequency: addRecurring ? addFrequency : null,
      };
      setBills(prev => [...prev, newBill]);
      setAddName(""); setAddAmount(""); setAddDueDate("");
      setAddRecurring(false); setAddFrequency("monthly");
      setShowAddForm(false);
      toast.success("Bill added.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setAddSubmitting(false);
    }
  }

  function closePanel() {
    setShowAddForm(false);
    setEditingBill(null);
    setAddName(""); setAddAmount(""); setAddDueDate("");
    setAddRecurring(false); setAddFrequency("monthly");
  }

  function startEdit(bill: Bill) {
    setEditingBill(bill);
    setAddName(bill.billName);
    setAddAmount(String(Number(bill.amount)));
    setAddDueDate(bill.dueDate.slice(0, 10));
    setAddRecurring(bill.isReccuring);
    setAddFrequency(bill.frequency ?? "monthly");
  }

  async function handleEditBill(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBill || !addName.trim() || !addAmount || !addDueDate) return;
    setAddSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        billName: addName.trim(),
        amount: parseFloat(addAmount),
        dueDate: addDueDate,
        isReccuring: addRecurring,
        frequency: addRecurring ? addFrequency : null,
      };
      const res = await fetch(`${API}/bills/${editingBill.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { toast.error("Failed to update bill."); return; }
      const data = await res.json();
      const updated: Bill = data.bill ?? {
        ...editingBill,
        billName: addName.trim(),
        amount: parseFloat(addAmount),
        dueDate: addDueDate,
        isReccuring: addRecurring,
        frequency: addRecurring ? addFrequency : null,
      };
      setBills(prev => prev.map(b => b.id === editingBill.id ? updated : b));
      closePanel();
      toast.success("Bill updated.");
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setAddSubmitting(false);
    }
  }

  if (loadingState === "error") return <ErrorDashboard onRetry={loadData} />;

  const loading = loadingState === "loading" || isPending;
  const firstName = session.user.name?.split(" ")[0] ?? "";

  const unpaidBills = bills.filter(b => !b.isPaid);
  const overdueBills = sortBills(unpaidBills.filter(b => isOverdueBill(b.dueDate)), sortBy);
  const upcomingBills = sortBills(unpaidBills.filter(b => !isOverdueBill(b.dueDate)), sortBy);
  // paid section defaults to most-recently-due first when sort is due-asc, else honour the selection
  const paidBills = sortBills(
    bills.filter(b => b.isPaid),
    sortBy === "due-asc" ? "due-desc" : sortBy,
  );

  const activeSuggestions = suggestions.filter(s => !dismissedSuggestions.has(s.billId));
  const suggestionMap = new Map(activeSuggestions.map(s => [s.billId, s]));

  // shared row renderer; isPaidSection disables the mark-paid button and dims the accent
  function renderSection(sectionBills: Bill[], isOverdue: boolean, isPaidSection = false) {
    return sectionBills.map((bill, i) => {
      const BillIcon = billIcon(bill.billName);
      const days = daysUntil(bill.dueDate);
      const suggestion = !isPaidSection ? suggestionMap.get(bill.id) : undefined;
      const isLast = i === sectionBills.length - 1;
      const isConfirmingDelete = confirmDeleteId === bill.id;
      const isPaying = markingPaidIds.has(bill.id);

      return (
        <div key={bill.id} className={!isLast ? "border-b border-white/6" : ""}>
          {/* fuzzy match suggestion banner */}
          {suggestion && (
            <div className="mx-4 mt-3 mb-1 rounded-2xl bg-[#F97316]/8 border border-[#F97316]/18 px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-[#F97316]/15 flex items-center justify-center text-[#F97316] shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white/80 leading-snug">
                    Looks like this transaction may have paid this bill. Confirm?
                  </p>
                  {(suggestion.merchantName || suggestion.transactionAmount) && (
                    <p className="text-[12px] text-white/45 mt-0.5">
                      {suggestion.merchantName ? toTitleCase(suggestion.merchantName) : "Transaction"}
                      {suggestion.transactionAmount
                        ? ` · $${fmtAmount(suggestion.transactionAmount)}`
                        : ""}
                      {" → "}
                      {toTitleCase(bill.billName)} · ${fmtAmount(bill.amount)}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2.5">
                    <button
                      onClick={() => confirmMatch(suggestion.billId, suggestion.transactionId)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#3ecf8e] text-[#111125] rounded-full text-[12px] font-bold hover:bg-[#3ecf8e]/90 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Confirm
                    </button>
                    <button
                      onClick={() => setDismissedSuggestions(prev => new Set(prev).add(suggestion.billId))}
                      className="px-3.5 py-1.5 text-white/40 rounded-full text-[12px] font-semibold hover:text-white/60 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* bill row */}
          <div className={`flex items-center gap-4 px-4 py-4 ${isPaidSection ? "opacity-60" : ""}`}>
            {/* icon */}
            <div className={`w-10 h-10 rounded-[13px] flex items-center justify-center shrink-0 ${
              isPaidSection
                ? "bg-[#3ecf8e]/10 text-[#3ecf8e]"
                : isOverdue
                  ? "bg-[#F97316]/10 text-[#F97316]"
                  : "bg-[#5EB3FF]/10 text-[#5EB3FF]"
            }`}>
              <BillIcon className="h-5 w-5" />
            </div>

            {/* name + meta */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[15px] font-semibold truncate">{toTitleCase(bill.billName)}</p>
                {isPaidSection && (
                  <span className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#3ecf8e]/12 text-[#3ecf8e] text-[10px] font-bold tracking-wide uppercase">
                    <Check className="h-2.5 w-2.5" />
                    Paid
                  </span>
                )}
              </div>
              <p className={`text-[12px] mt-0.5 ${
                isPaidSection
                  ? "text-white/35"
                  : isOverdue
                    ? "text-[#F97316]/60"
                    : "text-white/40"
              }`}>
                {isPaidSection
                  ? `Due ${shortDate(bill.dueDate)} · ${freqLabel(bill)}`
                  : isOverdue
                    ? `Due ${shortDate(bill.dueDate)} · ${Math.abs(days)}d overdue · ${freqLabel(bill)}`
                    : days === 0
                      ? `Due today · ${freqLabel(bill)}`
                      : `Due ${shortDate(bill.dueDate)} · ${days}d · ${freqLabel(bill)}`}
              </p>
            </div>

            {/* amount */}
            <p className={`text-[16px] font-bold tabular-nums shrink-0 ${
              isPaidSection ? "text-white/50" : isOverdue ? "text-[#F97316]" : "text-white"
            }`}>
              ${fmtAmount(bill.amount)}
            </p>

            {/* actions */}
            {isConfirmingDelete ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-1.5 text-white/40 text-[12px] font-semibold hover:text-white/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteBill(bill.id)}
                  className="px-3.5 py-1.5 bg-[#F97316]/15 text-[#F97316] rounded-full text-[12px] font-bold hover:bg-[#F97316]/25 transition-colors"
                >
                  Delete
                </button>
              </div>
            ) : isPaidSection ? (
              /* paid bills: edit + delete */
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => startEdit(bill)}
                  aria-label="Edit bill"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(bill.id)}
                  aria-label="Delete bill"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* unpaid bills: mark paid + edit + delete */
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => markPaid(bill.id)}
                  disabled={isPaying}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12px] font-bold transition-colors disabled:opacity-40 mr-1 ${
                    isOverdue
                      ? "bg-[#F97316]/12 text-[#F97316] hover:bg-[#F97316]/22"
                      : "bg-[#5EB3FF]/12 text-[#5EB3FF] hover:bg-[#5EB3FF]/22"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark as paid
                </button>
                <button
                  onClick={() => startEdit(bill)}
                  aria-label="Edit bill"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDeleteId(bill.id)}
                  aria-label="Delete bill"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/25 hover:text-white/55 hover:bg-white/5 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      );
    });
  }

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      {/* add / edit bill slide-in panel */}
      {(showAddForm || editingBill !== null) && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={closePanel}
        >
          <div
            className="absolute right-0 top-0 h-full w-105 bg-[#16213E] border-l border-white/6 p-8 overflow-y-auto shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]"
            onClick={e => e.stopPropagation()}
          >
            {/* panel header */}
            <div className="flex items-start justify-between mb-7">
              <div>
                <p className="text-[10px] font-bold tracking-[2px] text-white/35 uppercase mb-1.5">
                  {editingBill ? "Edit bill" : "New bill"}
                </p>
                <h2 className="text-[21px] font-extrabold tracking-[-0.5px]">
                  {editingBill ? "Edit Bill" : "Add a Bill"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={editingBill ? handleEditBill : handleAddBill} className="flex flex-col gap-5">
              {/* bill name */}
              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Bill name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Netflix, Rent, Electricity"
                  value={addName}
                  onChange={e => setAddName(e.target.value)}
                  required
                  className="w-full bg-[#111125] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors"
                />
              </div>

              {/* amount */}
              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    value={addAmount}
                    onChange={e => setAddAmount(e.target.value)}
                    required
                    className="w-full bg-[#111125] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors"
                  />
                </div>
              </div>

              {/* due date */}
              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Due date
                </label>
                <input
                  type="date"
                  value={addDueDate}
                  onChange={e => setAddDueDate(e.target.value)}
                  required
                  className="w-full bg-[#111125] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark"
                />
              </div>

              {/* one-time vs recurring segmented control */}
              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Billing type
                </label>
                <div className="flex bg-[#111125] rounded-xl p-1 border border-white/8">
                  <button
                    type="button"
                    onClick={() => setAddRecurring(false)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                      !addRecurring
                        ? "bg-[#5EB3FF] text-[#111125]"
                        : "text-white/40 hover:text-white/65"
                    }`}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddRecurring(true)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                      addRecurring
                        ? "bg-[#5EB3FF] text-[#111125]"
                        : "text-white/40 hover:text-white/65"
                    }`}
                  >
                    Recurring
                  </button>
                </div>
              </div>

              {/* frequency — only shown when recurring */}
              {addRecurring && (
                <div>
                  <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                    Frequency
                  </label>
                  <div className="relative">
                    <select
                      value={addFrequency}
                      onChange={e => setAddFrequency(e.target.value)}
                      className="w-full appearance-none bg-[#111125] border border-white/8 rounded-xl px-4 py-2.5 pr-9 text-sm text-white/70 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="semimonthly">Twice monthly</option>
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={addSubmitting || !addName.trim() || !addAmount || !addDueDate}
                className="w-full py-3 bg-[#5EB3FF] text-[#111125] rounded-xl text-[14px] font-bold hover:bg-[#5EB3FF]/90 disabled:opacity-40 transition-colors mt-2"
              >
                {editingBill
                  ? (addSubmitting ? "Saving..." : "Save Changes")
                  : (addSubmitting ? "Adding..." : "Add Bill")}
              </button>
            </form>
          </div>
        </div>
      )}

      <AppHeader activePage="bills" />

      {/* page content */}
      <main className="px-10 py-9 mx-auto w-full max-w-4xl">
        {/* page heading */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">Bills</h1>
            {!loading && bills.length > 0 && (
              <p className="text-white/40 text-sm mt-1">
                {unpaidBills.length} unpaid
                {paidBills.length > 0 && (
                  <span className="text-white/25"> · {paidBills.length} paid</span>
                )}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* sort dropdown */}
            {!loading && bills.length > 1 && (
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="appearance-none bg-[#16213E] border border-white/8 rounded-full pl-4 pr-9 py-2.5 text-[13px] text-white/60 font-semibold focus:outline-none focus:border-[#5EB3FF]/30 transition-colors cursor-pointer"
                >
                  <option value="due-asc">Due date ↑</option>
                  <option value="due-desc">Due date ↓</option>
                  <option value="amount-desc">Amount: High → Low</option>
                  <option value="amount-asc">Amount: Low → High</option>
                  <option value="name-asc">Name A–Z</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              </div>
            )}

            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#5EB3FF] text-[#111125] rounded-full text-[14px] font-bold hover:bg-[#5EB3FF]/90 transition-colors shadow-[0_4px_16px_rgba(94,179,255,0.25)]"
            >
              <Plus className="h-4 w-4" />
              Add bill
            </button>
          </div>
        </div>

        {/* skeleton */}
        {loading ? (
          <div className="flex flex-col gap-6">
            {[0, 1, 2].map(si => (
              <div key={si}>
                <div className="h-3 w-20 bg-white/6 rounded-full animate-pulse mb-3 mx-1" />
                <div className="bg-[#16213E] rounded-[28px] overflow-hidden">
                  {[0, 1, 2].map(k => (
                    <div
                      key={k}
                      className={`flex items-center gap-4 px-4 py-4 ${k < 2 ? "border-b border-white/6" : ""}`}
                    >
                      <div className="w-10 h-10 rounded-[13px] bg-white/4 animate-pulse shrink-0" />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-3.5 bg-white/6 rounded-full animate-pulse w-1/3" />
                        <div className="h-2.5 bg-white/4 rounded-full animate-pulse w-1/4" />
                      </div>
                      <div className="h-4 w-14 bg-white/4 rounded-full animate-pulse" />
                      <div className="h-8 w-28 bg-white/4 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : bills.length === 0 ? (
          /* empty state */
          <div className="flex items-center justify-center py-24">
            <div className="bg-[#16213E] rounded-[28px] p-10 flex flex-col items-center gap-3 text-center max-w-sm w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="w-12 h-12 rounded-full bg-[#5EB3FF]/10 flex items-center justify-center text-[#5EB3FF] mb-1">
                <Receipt className="h-5 w-5" />
              </div>
              <p className="text-white font-semibold">No bills yet.</p>
              <p className="text-white/40 text-sm leading-relaxed">
                Track your bills and never miss a payment.
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#5EB3FF]/12 text-[#5EB3FF] rounded-full text-sm font-semibold hover:bg-[#5EB3FF]/20 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add your first bill
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-7">
            {/* overdue */}
            {overdueBills.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <p className="text-[11px] font-bold tracking-[1.6px] text-[#F97316] uppercase shrink-0">
                    Overdue
                  </p>
                  <div className="flex-1 h-px bg-[#F97316]/20" />
                  <span className="text-[11px] text-[#F97316]/55 font-semibold shrink-0">
                    {overdueBills.length} bill{overdueBills.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="bg-[#16213E] rounded-[28px] overflow-hidden shadow-[inset_0_0_0_1px_rgba(249,115,22,0.12)]">
                  {renderSection(overdueBills, true)}
                </div>
              </section>
            )}

            {/* upcoming */}
            {upcomingBills.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase shrink-0">
                    Upcoming
                  </p>
                  <div className="flex-1 h-px bg-white/6" />
                  <span className="text-[11px] text-white/30 font-semibold shrink-0">
                    {upcomingBills.length} bill{upcomingBills.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="bg-[#16213E] rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {renderSection(upcomingBills, false)}
                </div>
              </section>
            )}

            {/* paid */}
            {/* sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <div className="flex items-center gap-2 text-[13px] text-white/30">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                  Loading more…
                </div>
              </div>
            )}

            {paidBills.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-3 px-1">
                  <p className="text-[11px] font-bold tracking-[1.6px] text-[#3ecf8e]/60 uppercase shrink-0">
                    Paid
                  </p>
                  <div className="flex-1 h-px bg-[#3ecf8e]/10" />
                  <span className="text-[11px] text-[#3ecf8e]/40 font-semibold shrink-0">
                    {paidBills.length} bill{paidBills.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="bg-[#16213E] rounded-[28px] overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {renderSection(paidBills, false, true)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
