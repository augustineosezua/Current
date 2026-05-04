"use client";

import { useSession } from "../lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  GripVertical,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import AppHeader from "../components/app-header";
import LoadingScreen from "../components/loading-screen";
import ErrorDashboard from "../dashboard/error-dashboard";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type LoadingState = "loading" | "loaded" | "error";

interface BudgetItem {
  id: string;
  name: string;
  amount: string | number;
  amountSaved: string | number;
  dueDate: string;
  priority: number;
  isMonthlySavingGoal: boolean;
  isReccuring: boolean;
  isCompleted: boolean;
  isDeleted: boolean;
}

interface Reconciliation {
  savingsAccountTotal: number;
  goalsTotal: number;
  gap: number;
  underfundedGoals: { id: string; name: string; shortfall: number; amountCovered?: number }[];
}

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;

// formats a number as a locale-aware dollar string with a configurable decimal count
function fmtMoney(n: string | number, decimals = 0): string {
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// converts an ISO date string to a human-readable "Mon YYYY" label for goal due dates
function goalDate(iso: string): string {
  if (!iso) return "";
  // guard against invalid dates that could throw or render "Invalid Date"
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

// calculates how many whole months remain until a due date, floored at 1 to avoid division by zero
function monthsUntil(iso: string): number {
  // +1 because the due month itself is a valid contribution month
  try {
    const now = new Date();
    const due = new Date(iso);
    return Math.max(
      1,
      (due.getFullYear() - now.getFullYear()) * 12 +
        (due.getMonth() - now.getMonth()) +
        1,
    );
  } catch {
    // unparseable date — return 1 so division elsewhere stays defined
    return 1;
  }
}

// derives how much the user needs to set aside this month to stay on track for a goal
function monthlyContribution(item: BudgetItem): number {
  const amount = Number(item.amount) || 0;
  const saved = Number(item.amountSaved) || 0;
  // recurring and monthly goals use their full amount as the flat monthly target
  if (item.isMonthlySavingGoal || item.isReccuring) return amount;
  // one-time goals divide the remaining balance over the months left
  const months = monthsUntil(item.dueDate);
  return (amount - saved) / months;
}

// ── Sortable goal card ──────────────────────────────────────────────────────

interface GoalCardProps {
  item: BudgetItem;
  rank: number;
  onDelete: (id: string) => void;
  onAllocate: (item: BudgetItem) => void;
  isDragging?: boolean;
}

// active goal card — draggable, shows progress bar and monthly contribution, used in the DnD list
function GoalCard({ item, rank, onDelete, onAllocate }: GoalCardProps) {
  // dnd-kit wires up drag state, ref, and ARIA attributes for this specific item
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const amount = Number(item.amount) || 0;
  const saved = Number(item.amountSaved) || 0;
  const pct = amount > 0 ? Math.min(100, (saved / amount) * 100) : 0;
  const monthly = monthlyContribution(item);
  const isComplete = item.isCompleted || saved >= amount;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#16213E] rounded-[28px] p-6 shadow-[inset_0_0_0_1px_rgba(245,196,0,0.10)] bg-[radial-gradient(ellipse_at_top_left,rgba(245,196,0,0.06),transparent_60%)]"
    >
      <div className="flex items-start gap-4">
        {/* drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing shrink-0 touch-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          {/* header row */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold tracking-[1.8px] text-[#F5C400]/60 uppercase">
                  #{rank}
                </span>
                {isComplete && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3ecf8e]/12 text-[#3ecf8e] text-[10px] font-bold tracking-wide uppercase">
                    <CheckCircle2 className="h-3 w-3" />
                    Complete
                  </span>
                )}
                {item.isMonthlySavingGoal && (
                  <span className="px-2 py-0.5 rounded-full bg-[#F5C400]/10 text-[#F5C400] text-[10px] font-bold tracking-wide uppercase">
                    Monthly
                  </span>
                )}
              </div>
              <p className="text-[18px] font-extrabold tracking-[-0.3px] truncate">
                {item.name}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[#F5C400] font-bold tabular-nums text-[22px] leading-none tracking-[-0.5px]">
                ${fmtMoney(amount)}
              </p>
              <p className="text-white/35 text-[11px] mt-0.5">target</p>
            </div>
          </div>

          {/* progress */}
          {isComplete ? (
            <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-[#3ecf8e]/8 border border-[#3ecf8e]/15 mb-4">
              <CheckCircle2 className="h-4 w-4 text-[#3ecf8e] shrink-0" />
              <p className="text-[13px] text-[#3ecf8e] font-semibold">
                Goal reached — ${fmtMoney(saved)} saved
              </p>
            </div>
          ) : (
            <>
              <div className="h-2 rounded-full bg-white/6 overflow-hidden mb-2">
                <div
                  className="h-full rounded-full bg-[#F5C400] transition-[width_0.5s_ease]"
                  style={{
                    width: `${pct}%`,
                    boxShadow: pct > 0 ? "0 0 10px rgba(245,196,0,0.35)" : undefined,
                  }}
                />
              </div>
              <div className="flex justify-between text-[12px] text-white/45 mb-4">
                <span>
                  <span className="text-white font-semibold">${fmtMoney(saved)}</span> saved
                </span>
                <span>${fmtMoney(amount - saved)} remaining</span>
              </div>
            </>
          )}

          {/* meta row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-[12px] text-white/40">
              {item.dueDate && (
                <span>
                  Due <span className="text-white/60 font-semibold">{goalDate(item.dueDate)}</span>
                </span>
              )}
              {!isComplete && (
                <span>
                  <span className="text-[#F5C400]/70 font-semibold">${fmtMoney(monthly, 0)}/mo</span> needed
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAllocate(item)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#F5C400]/12 text-[#F5C400] text-[12px] font-bold hover:bg-[#F5C400]/22 transition-colors"
              >
                <Wallet className="h-3.5 w-3.5" />
                Allocate ${fmtMoney(monthly, 0)}/mo
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                aria-label="Delete goal"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Savings() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");

  const [goals, setGoals] = useState<BudgetItem[]>([]);
  const [reconciliation, setReconciliation] = useState<Reconciliation | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [spentConfirmId, setSpentConfirmId] = useState<string | null>(null);

  // add goal panel
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addDate, setAddDate] = useState("");
  const [addMonthly, setAddMonthly] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);

  // monthly goal template — amount from the most recent isMonthlySavingGoal item
  const [monthlyGoalAmount, setMonthlyGoalAmount] = useState<number | null>(null);
  const [creatingMonthlyGoal, setCreatingMonthlyGoal] = useState(false);

  // allocate panel
  const [allocateItem, setAllocateItem] = useState<BudgetItem | null>(null);
  const [allocateMonths, setAllocateMonths] = useState(1);
  const [allocateSubmitting, setAllocateSubmitting] = useState(false);
  const [allocatingAll, setAllocatingAll] = useState(false);

  // affordability modal
  const [affordabilityModal, setAffordabilityModal] = useState<{
    total: number;
    available: number;
    onConfirm: () => void;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
    else if (session?.user.id) loadData();
  }, [session, isPending]);

  if (!authResolved) return <LoadingScreen />;
  if (!session) { router.push("/login"); return null; }

  // fetches all goals and the savings reconciliation in parallel, populating both state slices
  async function loadData() {
    try {
      const [detailsRes, reconciliationRes] = await Promise.all([
        fetch(`${API}/user-details`, { credentials: "include" }),
        fetch(`${API}/savings-reconciliation`, { credentials: "include" }),
      ]);

      if (!detailsRes.ok) { setLoadingState("error"); return; }

      const data = await detailsRes.json();
      const allItems: BudgetItem[] = data.returnData.budgetItems ?? [];

      // derive the user's preferred monthly savings amount from any past monthly goal
      // (search all items including spent/deleted so the amount persists across months)
      const lastMonthly = [...allItems]
        .filter((i) => i.isMonthlySavingGoal)
        .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime())[0];
      if (lastMonthly) setMonthlyGoalAmount(Number(lastMonthly.amount) || null);

      const allGoals = allItems
        .filter((i) => !i.isDeleted)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      setGoals(allGoals);

      if (reconciliationRes.ok) {
        const rec = await reconciliationRes.json();
        setReconciliation({
          savingsAccountTotal: rec.savingsAccountTotal ?? 0,
          goalsTotal: rec.goalsTotal ?? 0,
          gap: rec.gap ?? 0,
          underfundedGoals: rec.underfundedGoals ?? [],
        });
      }

      setLoadingState("loaded");
    } catch {
      setLoadingState("error");
    }
  }

  // hard-deletes a goal from the DB and removes it from local state optimistically
  async function handleDelete(id: string) {
    setConfirmDeleteId(null);
    // optimistic removal — roll back via loadData if the request fails
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await fetch(`${API}/delete/budget-item`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetItemId: id }),
      });
      if (!res.ok) { toast.error("Failed to delete goal."); loadData(); }
      else {
        toast.success("Goal deleted.");
        // reload reconciliation
        const rec = await fetch(`${API}/savings-reconciliation`, { credentials: "include" });
        if (rec.ok) {
          const d = await rec.json();
          setReconciliation({ savingsAccountTotal: d.savingsAccountTotal ?? 0, goalsTotal: d.goalsTotal ?? 0, gap: d.gap ?? 0, underfundedGoals: d.underfundedGoals ?? [] });
        }
      }
    } catch { toast.error("Something went wrong."); loadData(); }
  }

  // soft-deletes a completed goal by setting isDeleted: true, removing it from the reconciliation total
  async function handleMarkSpent(id: string) {
    setSpentConfirmId(null);
    // optimistic removal — the goal disappears immediately so the UI feels instant
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      const res = await fetch(`${API}/update-budget-item`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetItemId: id, isDeleted: true }),
      });
      if (!res.ok) { toast.error("Failed to mark as spent."); loadData(); }
      else {
        toast.success("Goal marked as spent — removed from your savings total.");
        const rec = await fetch(`${API}/savings-reconciliation`, { credentials: "include" });
        if (rec.ok) {
          const d = await rec.json();
          setReconciliation({ savingsAccountTotal: d.savingsAccountTotal ?? 0, goalsTotal: d.goalsTotal ?? 0, gap: d.gap ?? 0, underfundedGoals: d.underfundedGoals ?? [] });
        }
      }
    } catch { toast.error("Something went wrong."); loadData(); }
  }

  // one-click creates a monthly savings goal for the current month using the user's established amount
  async function handleCreateMonthlyGoal() {
    // no known amount — fall back to the add panel so the user can enter one manually
    if (!monthlyGoalAmount) { setAddMonthly(true); setShowAddPanel(true); return; }
    setCreatingMonthlyGoal(true);
    try {
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const createRes = await fetch(`${API}/create-budget-item`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Monthly Savings",
          amount: monthlyGoalAmount,
          dueDate: endOfMonth.toISOString(),
        }),
      });
      if (!createRes.ok) { toast.error("Failed to create monthly goal."); return; }
      const created = await createRes.json();

      if (created.data?.id) {
        await fetch(`${API}/update-budget-item`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budgetItemId: created.data.id,
            isMonthlySavingGoal: true,
            isReccuring: true,
            frequency: "monthly",
          }),
        });
      }

      const newGoal: BudgetItem = created.data
        ? { ...created.data, isMonthlySavingGoal: true, isReccuring: true, isCompleted: false, isDeleted: false }
        : {
            id: crypto.randomUUID(),
            name: "Monthly Savings",
            amount: monthlyGoalAmount,
            amountSaved: 0,
            dueDate: endOfMonth.toISOString(),
            priority: 1,
            isMonthlySavingGoal: true,
            isReccuring: true,
            isCompleted: false,
            isDeleted: false,
          };

      setGoals((prev) => [newGoal, ...prev]);
      toast.success(`Monthly savings goal of $${fmtMoney(monthlyGoalAmount)}/mo created.`);
    } catch { toast.error("Something went wrong."); }
    finally { setCreatingMonthlyGoal(false); }
  }

  // creates a new goal via the add panel, sets lowest priority when other goals exist, then appends to list
  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!addName.trim() || !addAmount || !addDate) return;
    setAddSubmitting(true);
    try {
      const createRes = await fetch(`${API}/create-budget-item`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName.trim(),
          amount: parseFloat(addAmount),
          dueDate: addDate,
          isMonthlySavingGoal: addMonthly,
        }),
      });
      if (!createRes.ok) { toast.error("Failed to add goal."); return; }
      const created = await createRes.json();

      // set at lowest priority when other goals exist
      if (goals.length > 0 && created.data?.id) {
        await fetch(`${API}/update-budget-item`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ budgetItemId: created.data.id, priority: 1 }),
        });
      }

      const newGoal: BudgetItem = created.data ?? {
        id: crypto.randomUUID(),
        name: addName.trim(),
        amount: parseFloat(addAmount),
        amountSaved: 0,
        dueDate: addDate,
        priority: 1,
        isMonthlySavingGoal: addMonthly,
        isReccuring: addMonthly,
        isCompleted: false,
        isDeleted: false,
      };

      setGoals((prev) => [...prev, newGoal]);
      setAddName(""); setAddAmount(""); setAddDate(""); setAddMonthly(false);
      setShowAddPanel(false);
      toast.success("Goal added.");

      const rec = await fetch(`${API}/savings-reconciliation`, { credentials: "include" });
      if (rec.ok) {
        const d = await rec.json();
        setReconciliation({ savingsAccountTotal: d.savingsAccountTotal ?? 0, goalsTotal: d.goalsTotal ?? 0, gap: d.gap ?? 0, underfundedGoals: d.underfundedGoals ?? [] });
      }
    } catch { toast.error("Something went wrong."); }
    finally { setAddSubmitting(false); }
  }

  // calls the allocate endpoint and patches the goal in local state; closed over by the affordability modal
  async function executeAllocate(item: BudgetItem, amt: number) {
    setAllocateSubmitting(true);
    try {
      const res = await fetch(`${API}/budget-items/allocate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ budgetItemId: item.id, amount: amt }),
      });
      if (!res.ok) { toast.error("Failed to allocate funds."); return; }
      const data = await res.json();
      const updated = data.data;
      setGoals((prev) =>
        prev.map((g) =>
          g.id === item.id
            ? { ...g, amountSaved: updated?.amountSaved ?? Math.min(Number(g.amount), Number(g.amountSaved) + amt), isCompleted: updated?.isCompleted ?? false }
            : g,
        ),
      );
      setAllocateItem(null);
      setAllocateMonths(1);
      toast.success(
        `$${fmtMoney(amt, 2)} (${allocateMonths} ${allocateMonths === 1 ? "month" : "months"}) allocated to ${item.name}.`,
      );
      const rec = await fetch(`${API}/savings-reconciliation`, { credentials: "include" });
      if (rec.ok) {
        const d = await rec.json();
        setReconciliation({ savingsAccountTotal: d.savingsAccountTotal ?? 0, goalsTotal: d.goalsTotal ?? 0, gap: d.gap ?? 0, underfundedGoals: d.underfundedGoals ?? [] });
      }
    } catch { toast.error("Something went wrong."); }
    finally { setAllocateSubmitting(false); }
  }

  // gates the allocation behind an affordability check before handing off to executeAllocate
  function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    if (!allocateItem) return;
    const monthly = monthlyContribution(allocateItem);
    const amt = parseFloat((monthly * allocateMonths).toFixed(2));
    if (amt <= 0) { toast.error("Monthly contribution is $0 — update the goal amount first."); return; }
    const available = reconciliation?.gap ?? 0;
    // gap would go negative — surface the affordability modal instead of allocating silently
    if (amt > available) {
      setAffordabilityModal({ total: amt, available, onConfirm: () => executeAllocate(allocateItem, amt) });
      return;
    }
    executeAllocate(allocateItem, amt);
  }

  // fans out allocation calls to all eligible goals in parallel; each call caps at the goal's target
  async function executeAllocateAll(eligible: BudgetItem[]) {
    setAllocatingAll(true);
    try {
      await Promise.all(
        eligible.map(async (g) => {
          const amt = parseFloat(monthlyContribution(g).toFixed(2));
          if (amt <= 0) return;
          const res = await fetch(`${API}/budget-items/allocate`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ budgetItemId: g.id, amount: amt }),
          });
          if (res.ok) {
            const data = await res.json();
            const updated = data.data;
            setGoals((prev) =>
              prev.map((item) =>
                item.id === g.id
                  ? { ...item, amountSaved: updated?.amountSaved ?? Math.min(Number(item.amount), Number(item.amountSaved) + amt), isCompleted: updated?.isCompleted ?? false }
                  : item,
              ),
            );
          }
        }),
      );
      toast.success(`This month's share allocated to ${eligible.length} goal${eligible.length !== 1 ? "s" : ""}.`);
      const rec = await fetch(`${API}/savings-reconciliation`, { credentials: "include" });
      if (rec.ok) {
        const d = await rec.json();
        setReconciliation({ savingsAccountTotal: d.savingsAccountTotal ?? 0, goalsTotal: d.goalsTotal ?? 0, gap: d.gap ?? 0, underfundedGoals: d.underfundedGoals ?? [] });
      }
    } catch { toast.error("Something went wrong."); }
    finally { setAllocatingAll(false); }
  }

  // computes the total monthly contribution across all incomplete goals and gates on affordability
  function handleAllocateAll() {
    const eligible = goals.filter((g) => !g.isCompleted && Number(g.amountSaved) < Number(g.amount));
    if (!eligible.length) { toast.error("All goals are already complete."); return; }
    const totalAll = parseFloat(eligible.reduce((sum, g) => sum + monthlyContribution(g), 0).toFixed(2));
    const available = reconciliation?.gap ?? 0;
    // total exceeds available savings — prompt before committing all allocations
    if (totalAll > available) {
      setAffordabilityModal({ total: totalAll, available, onConfirm: () => executeAllocateAll(eligible) });
      return;
    }
    executeAllocateAll(eligible);
  }

  // handles a completed drag — reorders the local list optimistically and persists new priorities
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // compute the new order and persist it; UI updates immediately regardless of server response
    setGoals((prev) => {
      const oldIndex = prev.findIndex((g) => g.id === active.id);
      const newIndex = prev.findIndex((g) => g.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      const orderedIds = reordered.map((g) => g.id);

      // fire-and-forget — if the request fails the priorities drift until next reload
      fetch(`${API}/budget-items/reorder`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      }).catch(() => {/* silent */});

      return reordered;
    });
  }

  function closeAddPanel() {
    setShowAddPanel(false);
    setAddName(""); setAddAmount(""); setAddDate(""); setAddMonthly(false);
  }

  if (loadingState === "error") return <ErrorDashboard onRetry={loadData} />;

  const loading = loadingState === "loading" || isPending;
  const firstName = session.user.name?.split(" ")[0] ?? "";
  const allGoalsFunded =
    goals.length > 0 && goals.every((g) => Number(g.amountSaved) >= Number(g.amount));

  const incompleteGoals = goals.filter((g) => !g.isCompleted && Number(g.amountSaved) < Number(g.amount));
  const completedGoals = goals.filter((g) => g.isCompleted || Number(g.amountSaved) >= Number(g.amount));
  // all completed goals count toward allocated until explicitly marked as spent
  const now = new Date();
  const hasMonthlyGoal = goals.some((g) => {
    if (!g.isMonthlySavingGoal) return false;
    const due = new Date(g.dueDate);
    return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
  });

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      {/* ── Affordability modal ────────────────────────────────────────── */}
      {affordabilityModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#16213E] rounded-[28px] p-7 max-w-sm w-full shadow-[inset_0_0_0_1px_rgba(249,115,22,0.18)] bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.08),transparent_60%)]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-[#F97316]/12 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-4.5 w-4.5 text-[#F97316]" />
              </div>
              <h3 className="text-[17px] font-extrabold tracking-[-0.3px]">Not enough in savings</h3>
            </div>
            <p className="text-[13px] text-white/55 leading-relaxed mb-1">
              Allocating{" "}
              <span className="text-white font-semibold">${fmtMoney(affordabilityModal.total, 2)}</span> would exceed your available savings balance of{" "}
              <span className="text-white font-semibold">${fmtMoney(Math.max(0, affordabilityModal.available), 2)}</span>.
            </p>
            <p className="text-[13px] text-white/55 leading-relaxed mb-6">
              You'd be{" "}
              <span className="text-[#F97316] font-semibold">${fmtMoney(affordabilityModal.total - affordabilityModal.available, 2)} short</span>{" "}
              — the allocation will be recorded but won't be backed by your savings account balance until you top it up.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setAffordabilityModal(null)}
                className="flex-1 py-2.5 rounded-full border border-white/12 text-white/60 text-[13px] font-semibold hover:text-white hover:border-white/25 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { affordabilityModal.onConfirm(); setAffordabilityModal(null); }}
                className="flex-1 py-2.5 rounded-full bg-[#F97316]/15 text-[#F97316] text-[13px] font-bold hover:bg-[#F97316]/25 transition-colors"
              >
                Allocate anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add goal panel ─────────────────────────────────────────────── */}
      {showAddPanel && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={closeAddPanel}
        >
          <div
            className="absolute right-0 top-0 h-full w-[420px] bg-[#16213E] border-l border-white/6 p-8 overflow-y-auto shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-7">
              <div>
                <p className="text-[10px] font-bold tracking-[2px] text-[#F5C400]/50 uppercase mb-1.5">
                  New goal
                </p>
                <h2 className="text-[21px] font-extrabold tracking-[-0.5px]">
                  Add a Savings Goal
                </h2>
              </div>
              <button
                onClick={closeAddPanel}
                className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddGoal} className="flex flex-col gap-5">
              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Goal name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emergency Fund, Vacation"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  required
                  className="w-full bg-[#111125] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#F5C400]/30 transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Target amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">
                    $
                  </span>
                  <input
                    type="number"
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    required
                    className="w-full bg-[#111125] border border-white/8 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#F5C400]/30 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Target date
                </label>
                <input
                  type="date"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  required
                  className="w-full bg-[#111125] border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#F5C400]/30 transition-colors scheme-dark"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                  Goal type
                </label>
                <div className="flex bg-[#111125] rounded-xl p-1 border border-white/8">
                  <button
                    type="button"
                    onClick={() => setAddMonthly(false)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                      !addMonthly
                        ? "bg-[#F5C400] text-[#111125]"
                        : "text-white/40 hover:text-white/65"
                    }`}
                  >
                    One-time
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddMonthly(true)}
                    className={`flex-1 py-2 rounded-lg text-[13px] font-semibold transition-all ${
                      addMonthly
                        ? "bg-[#F5C400] text-[#111125]"
                        : "text-white/40 hover:text-white/65"
                    }`}
                  >
                    Recurring monthly
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={addSubmitting || !addName.trim() || !addAmount || !addDate}
                className="w-full py-3 bg-[#F5C400] text-[#111125] rounded-xl text-[14px] font-bold hover:bg-[#F5C400]/90 disabled:opacity-40 transition-colors mt-2"
              >
                {addSubmitting ? "Adding…" : "Add Goal"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Allocate funds panel ────────────────────────────────────────── */}
      {allocateItem && (() => {
        const monthly = monthlyContribution(allocateItem);
        const total = parseFloat((monthly * allocateMonths).toFixed(2));
        const newSaved = Math.min(Number(allocateItem.amount), Number(allocateItem.amountSaved) + total);
        const MONTH_PRESETS = [1, 2, 3, 6, 12];
        return (
          <div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => { setAllocateItem(null); setAllocateMonths(1); }}
          >
            <div
              className="absolute right-0 top-0 h-full w-[420px] bg-[#16213E] border-l border-white/6 p-8 overflow-y-auto shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-7">
                <div>
                  <p className="text-[10px] font-bold tracking-[2px] text-[#F5C400]/50 uppercase mb-1.5">
                    Allocate monthly share
                  </p>
                  <h2 className="text-[21px] font-extrabold tracking-[-0.5px]">
                    {allocateItem.name}
                  </h2>
                </div>
                <button
                  onClick={() => { setAllocateItem(null); setAllocateMonths(1); }}
                  className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* monthly share callout */}
              <div className="bg-[#F5C400]/8 border border-[#F5C400]/18 rounded-2xl px-4 py-3.5 mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-[#F5C400] shrink-0" />
                  <span className="text-[13px] text-white/60 font-medium">Monthly share</span>
                </div>
                <span className="text-[#F5C400] font-bold text-[16px] tabular-nums">
                  ${fmtMoney(monthly, 2)}<span className="text-[#F5C400]/50 font-semibold text-[12px]">/mo</span>
                </span>
              </div>

              {/* goal progress */}
              <div className="bg-[#111125] rounded-2xl p-4 mb-6 border border-white/6">
                <div className="flex justify-between text-[13px] mb-2">
                  <span className="text-white/50">Currently saved</span>
                  <span className="font-semibold">${fmtMoney(allocateItem.amountSaved, 2)}</span>
                </div>
                <div className="flex justify-between text-[13px] mb-3">
                  <span className="text-white/50">Target</span>
                  <span className="font-semibold text-[#F5C400]">${fmtMoney(allocateItem.amount, 2)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#F5C400] transition-[width_0.4s_ease]"
                    style={{
                      width: `${Math.min(100, (Number(allocateItem.amountSaved) / Number(allocateItem.amount)) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <form onSubmit={handleAllocate} className="flex flex-col gap-5">
                <div>
                  <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-2">
                    How many months to allocate?
                  </label>
                  <div className="grid grid-cols-5 gap-2 mb-3">
                    {MONTH_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAllocateMonths(m)}
                        className={`py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                          allocateMonths === m
                            ? "bg-[#F5C400] text-[#111125]"
                            : "bg-white/6 text-white/40 hover:text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {m}mo
                      </button>
                    ))}
                  </div>
                  {/* custom stepper for any value */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAllocateMonths(Math.max(1, allocateMonths - 1))}
                      className="w-8 h-8 rounded-full bg-white/6 text-white/50 hover:bg-white/10 font-bold text-lg leading-none flex items-center justify-center"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={allocateMonths}
                      onChange={(e) => setAllocateMonths(Math.max(1, parseInt(e.target.value) || 1))}
                      className="flex-1 bg-[#111125] border border-white/8 rounded-xl px-4 py-2 text-sm text-white text-center focus:outline-none focus:border-[#F5C400]/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setAllocateMonths(allocateMonths + 1)}
                      className="w-8 h-8 rounded-full bg-white/6 text-white/50 hover:bg-white/10 font-bold text-lg leading-none flex items-center justify-center"
                    >
                      +
                    </button>
                    <span className="text-white/30 text-sm">months</span>
                  </div>
                </div>

                {/* total preview */}
                <div className="bg-[#111125] rounded-xl px-4 py-3 border border-white/6">
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="text-white/45">Total to allocate</span>
                    <span className="font-bold text-[#F5C400]">${fmtMoney(total, 2)}</span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-white/30">New saved total</span>
                    <span className="text-white/60 font-semibold">${fmtMoney(newSaved, 2)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={allocateSubmitting || total <= 0}
                  className="w-full py-3 bg-[#F5C400] text-[#111125] rounded-xl text-[14px] font-bold hover:bg-[#F5C400]/90 disabled:opacity-40 transition-colors"
                >
                  {allocateSubmitting
                    ? "Allocating…"
                    : `Allocate ${allocateMonths} ${allocateMonths === 1 ? "month" : "months"} · $${fmtMoney(total, 2)}`}
                </button>
              </form>
            </div>
          </div>
        );
      })()}

      <AppHeader activePage="savings" />

      {/* ── Page content ───────────────────────────────────────────────── */}
      <main className="px-10 py-9 mx-auto w-full max-w-4xl">
        {/* heading */}
        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">Savings</h1>
            {!loading && incompleteGoals.length > 0 && (
              <p className="text-white/40 text-sm mt-1">
                {incompleteGoals.length} active {incompleteGoals.length === 1 ? "goal" : "goals"} · drag to reprioritize
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAddPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C400] text-[#111125] rounded-full text-[14px] font-bold hover:bg-[#F5C400]/90 transition-colors shadow-[0_4px_16px_rgba(245,196,0,0.22)]"
          >
            <Plus className="h-4 w-4" />
            Add goal
          </button>
        </div>

        {/* ── Reconciliation summary ──────────────────────────────────── */}
        {loading ? (
          <div className="bg-[#16213E] rounded-[28px] h-32 animate-pulse mb-7" />
        ) : reconciliation ? (
          <div className="bg-[#16213E] rounded-[28px] p-6 mb-7 shadow-[inset_0_0_0_1px_rgba(245,196,0,0.12)] bg-[radial-gradient(ellipse_at_top_right,rgba(245,196,0,0.08),transparent_60%)]">
            <p className="text-[10px] font-bold tracking-[2px] text-[#F5C400]/60 uppercase mb-4">
              Savings Reconciliation
            </p>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="text-white/40 text-[12px] mb-1">In savings accounts</p>
                <p className="text-[22px] font-bold tabular-nums text-[#3ecf8e]">
                  ${fmtMoney(reconciliation.savingsAccountTotal, 2)}
                </p>
              </div>
              <div>
                <p className="text-white/40 text-[12px] mb-1">Allocated to goals</p>
                <p className="text-[22px] font-bold tabular-nums text-[#F5C400]">
                  ${fmtMoney(reconciliation.goalsTotal, 2)}
                </p>
                {completedGoals.length > 0 && (
                  <p className="text-[11px] text-[#F5C400]/50 mt-0.5">
                    incl. {completedGoals.length} completed
                  </p>
                )}
              </div>
              <div>
                <p className="text-white/40 text-[12px] mb-1">Gap</p>
                <p
                  className={`text-[22px] font-bold tabular-nums ${
                    reconciliation.gap > 0
                      ? "text-[#3ecf8e]"
                      : reconciliation.gap < 0
                        ? "text-[#F97316]"
                        : "text-white/50"
                  }`}
                >
                  {reconciliation.gap > 0 ? "+" : reconciliation.gap < 0 ? "−" : ""}${fmtMoney(Math.abs(reconciliation.gap), 2)}
                </p>
              </div>
            </div>

            {/* allocate all button */}
            {incompleteGoals.some((g) => Number(g.amountSaved) < Number(g.amount)) && (
              <button
                onClick={handleAllocateAll}
                disabled={allocatingAll}
                className="w-full mb-4 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-[#F5C400]/10 border border-[#F5C400]/18 text-[#F5C400] text-[13px] font-bold hover:bg-[#F5C400]/18 transition-colors disabled:opacity-50"
              >
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                {allocatingAll ? "Allocating…" : "Allocate this month's share to all goals"}
              </button>
            )}

            {reconciliation.underfundedGoals.length > 0 && (
              <div className="rounded-2xl bg-[#F97316]/8 border border-[#F97316]/15 px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-[#F97316] shrink-0" />
                  <p className="text-[12px] font-bold text-[#F97316]">
                    {reconciliation.underfundedGoals.length} underfunded{" "}
                    {reconciliation.underfundedGoals.length === 1 ? "goal" : "goals"}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {reconciliation.underfundedGoals.map((g, i) => (
                    <div key={g.id} className="flex items-center justify-between text-[12px]">
                      <span className="text-white/60">
                        #{i + 1} {g.name}
                      </span>
                      <span className="text-[#F97316] font-semibold">
                        −${fmtMoney(g.shortfall, 2)} short
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allGoalsFunded && (
              <div className="flex items-center gap-2 text-[13px] text-[#3ecf8e]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                All goals are fully funded
              </div>
            )}
          </div>
        ) : null}

        {/* ── Monthly goal banner ────────────────────────────────────── */}
        {!loading && !hasMonthlyGoal && (
          <div className="mb-5 flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-[#F5C400]/8 border border-[#F5C400]/18">
            <CalendarDays className="h-4 w-4 text-[#F5C400] shrink-0" />
            <p className="text-[13px] text-white/60 flex-1">
              No monthly savings goal for this period
              {monthlyGoalAmount ? ` — last set at $${fmtMoney(monthlyGoalAmount)}/mo.` : "."}
            </p>
            <button
              onClick={handleCreateMonthlyGoal}
              disabled={creatingMonthlyGoal}
              className="text-[#F5C400] text-[13px] font-bold hover:underline shrink-0 disabled:opacity-50"
            >
              {creatingMonthlyGoal ? "Creating…" : monthlyGoalAmount ? `Create $${fmtMoney(monthlyGoalAmount)}/mo →` : "Set one →"}
            </button>
          </div>
        )}

        {/* ── Goals list ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((k) => (
              <div key={k} className="bg-[#16213E] rounded-[28px] h-40 animate-pulse" />
            ))}
          </div>
        ) : incompleteGoals.length === 0 && completedGoals.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="bg-[#16213E] rounded-[28px] p-10 flex flex-col items-center gap-3 text-center max-w-sm w-full shadow-[inset_0_0_0_1px_rgba(245,196,0,0.08)]">
              <div className="w-12 h-12 rounded-full bg-[#F5C400]/10 flex items-center justify-center text-[#F5C400] mb-1">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-white font-semibold">No savings goals yet.</p>
              <p className="text-white/40 text-sm leading-relaxed">
                Set a target and Current will track how much to set aside each month.
              </p>
              <button
                onClick={() => setShowAddPanel(true)}
                className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-[#F5C400]/12 text-[#F5C400] rounded-full text-sm font-semibold hover:bg-[#F5C400]/22 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add your first goal
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Section A: Active goals */}
            {incompleteGoals.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div>
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase shrink-0">Active</p>
                    <div className="flex-1 h-px bg-white/6" />
                    <span className="text-[11px] text-white/30 font-semibold shrink-0">{incompleteGoals.length} goal{incompleteGoals.length !== 1 ? 's' : ''}</span>
                  </div>
                  <SortableContext
                    items={incompleteGoals.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-4">
                      {incompleteGoals.map((goal, index) =>
                        confirmDeleteId === goal.id ? (
                          <div
                            key={goal.id}
                            className="bg-[#16213E] rounded-[28px] p-6 border border-[#F97316]/20"
                          >
                            <p className="text-[15px] font-semibold mb-1">
                              Delete &ldquo;{goal.name}&rdquo;?
                            </p>
                            <p className="text-white/40 text-sm mb-4">
                              This will remove the goal and all its saved progress.
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-4 py-2 text-white/40 text-sm font-semibold hover:text-white/70 transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleDelete(goal.id)}
                                className="px-4 py-2 bg-[#F97316]/15 text-[#F97316] rounded-full text-sm font-bold hover:bg-[#F97316]/25 transition-colors"
                              >
                                Delete goal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <GoalCard
                            key={goal.id}
                            item={goal}
                            rank={index + 1}
                            onDelete={(id) => { setConfirmDeleteId(id); setSpentConfirmId(null); }}
                            onAllocate={(item) => { setAllocateItem(item); setAllocateMonths(1); }}
                          />
                        ),
                      )}
                    </div>
                  </SortableContext>
                </div>
              </DndContext>
            )}

            {/* Section B: Completed goals */}
            {completedGoals.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center gap-3 mb-3 px-1">
                  <p className="text-[11px] font-bold tracking-[1.6px] text-[#3ecf8e]/60 uppercase shrink-0">Completed</p>
                  <div className="flex-1 h-px bg-[#3ecf8e]/10" />
                  <span className="text-[11px] text-[#3ecf8e]/40 font-semibold shrink-0">{completedGoals.length}</span>
                </div>
                <div className="flex flex-col gap-4">
                  {completedGoals.map((goal) => (
                    confirmDeleteId === goal.id ? (
                      <div
                        key={goal.id}
                        className="bg-[#16213E] rounded-[28px] p-6 border border-[#F97316]/20"
                      >
                        <p className="text-[15px] font-semibold mb-1">
                          Delete &ldquo;{goal.name}&rdquo;?
                        </p>
                        <p className="text-white/40 text-sm mb-4">
                          This will remove the goal and all its saved progress.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-4 py-2 text-white/40 text-sm font-semibold hover:text-white/70 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="px-4 py-2 bg-[#F97316]/15 text-[#F97316] rounded-full text-sm font-bold hover:bg-[#F97316]/25 transition-colors"
                          >
                            Delete goal
                          </button>
                        </div>
                      </div>
                    ) : spentConfirmId === goal.id ? (
                      <div
                        key={goal.id}
                        className="bg-[#16213E] rounded-[28px] p-6 border border-[#F5C400]/20"
                      >
                        <p className="text-[15px] font-semibold mb-1">
                          Mark &ldquo;{goal.name}&rdquo; as spent?
                        </p>
                        <p className="text-white/40 text-sm mb-4">
                          This records that you&apos;ve withdrawn and used the funds. The goal will be removed from your savings total.
                        </p>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setSpentConfirmId(null)}
                            className="px-4 py-2 text-white/40 text-sm font-semibold hover:text-white/70 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleMarkSpent(goal.id)}
                            className="px-4 py-2 bg-[#F5C400]/15 text-[#F5C400] rounded-full text-sm font-bold hover:bg-[#F5C400]/25 transition-colors"
                          >
                            Mark as spent
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div key={goal.id} className="bg-[#16213E] rounded-[28px] p-6 shadow-[inset_0_0_0_1px_rgba(245,196,0,0.10)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#3ecf8e]/12 text-[#3ecf8e] text-[10px] font-bold tracking-wide uppercase shrink-0">
                                <CheckCircle2 className="h-3 w-3" />Complete
                              </span>
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F5C400]/10 text-[#F5C400] text-[10px] font-bold tracking-wide uppercase shrink-0">
                                In total
                              </span>
                            </div>
                            <p className="text-[17px] font-extrabold tracking-[-0.3px] truncate">{goal.name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-[#F5C400] font-bold text-[18px] tabular-nums">${fmtMoney(goal.amount)}</p>
                            <button
                              onClick={() => setSpentConfirmId(goal.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/6 text-white/45 text-[12px] font-semibold hover:bg-white/10 hover:text-white/70 transition-colors"
                            >
                              Mark as spent
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(goal.id)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white/20 hover:text-white/50 hover:bg-white/5 transition-colors"
                              aria-label="Delete goal"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {goal.dueDate && (
                          <p className="text-[12px] text-white/30 mt-3">
                            Completed · due {goalDate(goal.dueDate)} · mark as spent when funds are withdrawn
                          </p>
                        )}
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
