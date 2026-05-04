"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const ONBOARDING_STEPS = ["Welcome", "Bank", "Accounts", "Setup", "Done"];

const SUB_STEPS = [
  { id: "paycheck", label: "Paycheck schedule" },
  { id: "savings", label: "Monthly savings goal" },
  { id: "bills", label: "Recurring bills" },
  { id: "goals", label: "Savings goals" },
  { id: "spend", label: "Minimum monthly spend" },
];

const PAYCHECK_FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "semimonthly", label: "Semi-monthly" },
  { value: "monthly", label: "Monthly" },
];

const BILL_FREQS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const SAVINGS_PRESETS = [50, 100, 200, 350, 500];
const SPEND_PRESETS = [100, 200, 300, 400, 500];

const LEFT_CONTEXT = [
  { sectionLabel: "YOUR INCOME", heading: "When does money hit?" },
  { sectionLabel: "YOUR SAVINGS", heading: "How much will you save?" },
  { sectionLabel: "YOUR BILLS", heading: "What comes out monthly?" },
  { sectionLabel: "YOUR GOALS", heading: "What are you saving towards?" },
  { sectionLabel: "SPENDING FLOOR", heading: "How much stays safe to spend?" },
];

interface PendingBill {
  name: string;
  amount: number;
  dueDate: string;
  frequency: string;
}

interface PendingGoal {
  name: string;
  amount: number;
  dueDate: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtGoalDate(iso: string) {
  const [y, m] = iso.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export default function SetupPage() {
  const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;
  const router = useRouter();
  const [subStep, setSubStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // step 1
  const [paychequeAmount, setPaychequeAmount] = useState("");
  const [paychequeFrequency, setPaychequeFrequency] = useState("biweekly");
  const [nextPaychequeDate, setNextPaychequeDate] = useState("");

  // step 2 — single source of truth
  const [savingsAmount, setSavingsAmount] = useState("50");

  // step 3 — bills held locally until final submit
  const [pendingBills, setPendingBills] = useState<PendingBill[]>([]);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState("");
  const [billFrequency, setBillFrequency] = useState("monthly");

  // step 4 — goals held locally until final submit
  const [pendingGoals, setPendingGoals] = useState<PendingGoal[]>([]);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");

  // step 5
  const [spendAmount, setSpendAmount] = useState("300");

  const addBill = () => {
    const amount = parseFloat(billAmount);
    if (!billName.trim() || !amount || amount <= 0 || !billDate) {
      toast.error("Fill in all bill fields.");
      return;
    }
    setPendingBills((prev) => [
      ...prev,
      { name: billName.trim(), amount, dueDate: billDate, frequency: billFrequency },
    ]);
    setBillName("");
    setBillAmount("");
    setBillDate("");
    setBillFrequency("monthly");
  };

  const removeBill = (index: number) =>
    setPendingBills((prev) => prev.filter((_, i) => i !== index));

  const addGoal = () => {
    const amount = parseFloat(goalAmount);
    if (!goalName.trim() || !amount || amount <= 0 || !goalDate) {
      toast.error("Fill in all goal fields.");
      return;
    }
    setPendingGoals((prev) => [
      ...prev,
      { name: goalName.trim(), amount, dueDate: goalDate },
    ]);
    setGoalName("");
    setGoalAmount("");
    setGoalDate("");
  };

  const removeGoal = (index: number) =>
    setPendingGoals((prev) => prev.filter((_, i) => i !== index));

  const moveGoal = (index: number, dir: -1 | 1) => {
    setPendingGoals((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleContinue = async () => {
    if (subStep === 0) {
      const amount = parseFloat(paychequeAmount);
      if (!paychequeAmount || isNaN(amount) || amount <= 0) {
        toast.error("Enter a valid paycheck amount.");
        return;
      }
      if (!nextPaychequeDate) {
        toast.error("Enter your next payday.");
        return;
      }
      setSubStep(1);
    } else if (subStep === 1) {
      if ((parseFloat(savingsAmount) || 0) <= 0) {
        toast.error("Enter a valid savings goal.");
        return;
      }
      setSubStep(2);
    } else if (subStep === 2) {
      const amount = parseFloat(billAmount);
      if (billName.trim() && amount > 0 && billDate) {
        setPendingBills((prev) => [
          ...prev,
          { name: billName.trim(), amount, dueDate: billDate, frequency: billFrequency },
        ]);
        setBillName(""); setBillAmount(""); setBillDate(""); setBillFrequency("monthly");
      }else if(billName.trim() && (!amount || amount <= 0 || !billDate) || (!billName.trim() && (amount || billDate)) || (!billName.trim() && !amount && billDate) || (!billName.trim() && amount && !billDate)){
        toast.error("Fill in all bill fields correctly.");
        return;
      }
      setSubStep(3);
    } else if (subStep === 3) {
      const amount = parseFloat(goalAmount);
      if (goalName.trim() && amount > 0 && goalDate) {
        setPendingGoals((prev) => [
          ...prev,
          { name: goalName.trim(), amount, dueDate: goalDate },
        ]);
        setGoalName(""); setGoalAmount(""); setGoalDate("");
      }else if(goalName.trim() && (!amount || amount <= 0 || !goalDate) || (!goalName.trim() && (amount || goalDate)) || (!goalName.trim() && !amount && goalDate) || (!goalName.trim() && amount && !goalDate)){
        toast.error("Fill in all goal fields correctly.");
        return;
      }
      setSubStep(4);
    } else {
      // final step — submit everything
      setSaving(true);
      try {
        const paychequeNum = parseFloat(paychequeAmount);
        if (paychequeNum > 0 && paychequeFrequency && nextPaychequeDate) {
          const res = await fetch(`${API}/settings/income`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              paychequeAmount: paychequeNum,
              paychequeFrequency,
              nextPaychequeDate,
            }),
          });
          if (!res.ok) {
            const err = await res.json();
            toast.error(err.error || "Failed to save paycheck info.");
            return;
          }
        }

        const savingsNum = parseFloat(savingsAmount) || 0;
        if (savingsNum > 0) {
          const now = new Date();
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
          const createRes = await fetch(`${API}/create-budget-item`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "Monthly Savings",
              amount: savingsNum,
              dueDate: endOfMonth.toISOString(),
            }),
          });
          if (createRes.ok) {
            const createData = await createRes.json();
            await fetch(`${API}/update-budget-item`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                budgetItemId: createData.data.id,
                isReccuring: true,
                frequency: "monthly",
                isMonthlySavingGoal: true,
              }),
            });
          }
        }

        for (const bill of pendingBills) {
          await fetch(`${API}/bills`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: bill.name,
              amount: bill.amount,
              dueDate: bill.dueDate,
              isReccuring: true,
              frequency: bill.frequency,
            }),
          });
        }

        for (let i = 0; i < pendingGoals.length; i++) {
          const goal = pendingGoals[i];
          const res = await fetch(`${API}/create-budget-item`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: goal.name,
              amount: goal.amount,
              dueDate: goal.dueDate,
            }),
          });
          if (res.ok && pendingGoals.length > 1) {
            const created = await res.json();
            await fetch(`${API}/update-budget-item`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                budgetItemId: created.data.id,
                priority: pendingGoals.length - i,
              }),
            });
          }
        }

        await fetch(`${API}/settings`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            desiredMinimumMonthlySpend: parseFloat(spendAmount) || 0,
          }),
        });

        router.push("/dashboard");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleSkip = () => {
    if (subStep < SUB_STEPS.length - 1) {
      setSubStep(subStep + 1);
    } else {
      router.push("/dashboard");
    }
  };

  const { sectionLabel, heading } = LEFT_CONTEXT[subStep];

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {/* left panel */}
      <div className="w-[42%] flex flex-col border-r border-white/8">
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

        <div className="flex-1 flex flex-col justify-center px-10 gap-8 relative">
          <div className="absolute w-130 h-130 rounded-full bg-[#5EB3FF]/10 blur-[120px] pointer-events-none top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2" />

          <div className="relative flex flex-col gap-2">
            <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase">
              {sectionLabel}
            </p>
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
              {heading}
            </h2>
          </div>

          <div className="relative flex flex-col gap-3.5">
            {SUB_STEPS.map((step, i) => (
              <div key={step.id} className="flex items-center gap-3">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    i < subStep
                      ? "bg-[#3ecf8e] text-[#1A1A2E]"
                      : i === subStep
                        ? "bg-[#5EB3FF] text-[#1A1A2E]"
                        : "border border-white/20 text-white/25"
                  }`}
                >
                  {i < subStep ? "✓" : i + 1}
                </span>
                <span
                  className={`text-sm transition-colors ${
                    i === subStep
                      ? "text-white font-semibold"
                      : i < subStep
                        ? "text-white/40"
                        : "text-white/25"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-4 text-xs text-white/25">
          © Current · Bank-grade encryption · SOC 2 Type II
        </div>
      </div>

      {/* right panel */}
      <div className="w-[58%] flex flex-col border-l border-white/8">
        {/* top nav */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/8">
          <div className="flex items-center gap-1 text-xs text-white/40">
            {ONBOARDING_STEPS.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < 3
                      ? "bg-[#3ecf8e] text-[#1A1A2E]"
                      : i === 3
                        ? "bg-[#5EB3FF] text-[#1A1A2E]"
                        : "border border-white/20 text-white/30"
                  }`}
                >
                  {i < 3 ? "✓" : i + 1}
                </span>
                <span
                  className={
                    i === 3
                      ? "text-white font-semibold"
                      : i < 3
                        ? "text-white/40"
                        : ""
                  }
                >
                  {name}
                </span>
                {i < ONBOARDING_STEPS.length - 1 && (
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

        {/* step content */}
        <div className="flex-1 flex flex-col justify-center overflow-y-auto px-16 py-8">

          {/* ── STEP 1: Paycheck ── */}
          {subStep === 0 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5">
                  STEP 1 OF 5
                </p>
                <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
                  How much is your paycheck?
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  Current uses this to forecast when income is coming in.
                </p>
              </div>

              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
                  PAYCHECK AMOUNT
                </p>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="2,500"
                    value={paychequeAmount}
                    onChange={(e) => setPaychequeAmount(e.target.value)}
                    className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl pl-8 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors placeholder:text-white/20"
                  />
                </div>
              </div>

              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
                  HOW OFTEN
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {PAYCHECK_FREQS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setPaychequeFrequency(f.value)}
                      className={`py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                        paychequeFrequency === f.value
                          ? "bg-[#5EB3FF] text-[#1A1A2E]"
                          : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase mb-2">
                  NEXT PAYDAY
                </p>
                <input
                  type="date"
                  value={nextPaychequeDate}
                  onChange={(e) => setNextPaychequeDate(e.target.value)}
                  className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark"
                />
              </div>
            </div>
          )}

          {/* ── STEP 2: Savings goal ── */}
          {subStep === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5">
                  STEP 2 OF 5
                </p>
                <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
                  Save how much each month?
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  We'll quietly hold this back from your Safe-To-Spend so you
                  don't have to think about it. You'll set specific goals like
                  an emergency fund or vacation next.
                </p>
              </div>

              {/* editable gold card */}
              <div className="bg-[#16213E] rounded-[28px] p-6 flex flex-col items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-[#F5C400] text-[11px] font-bold tracking-[0.18em] uppercase">
                  MONTHLY SAVINGS GOAL
                </p>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-[#F5C400]/60 text-2xl font-bold mr-0.5">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={savingsAmount}
                    onChange={(e) =>
                      setSavingsAmount(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    className="text-[#F5C400] text-6xl font-bold leading-none bg-transparent border-b-2 border-transparent focus:border-[#F5C400]/30 outline-none text-center w-36 transition-colors caret-[#F5C400]/60 placeholder:text-[#F5C400]/25"
                  />
                </div>
                {(parseFloat(savingsAmount) || 0) > 0 && (
                  <p className="text-white/30 text-[11px]">
                    = ${fmt(Math.round((parseFloat(savingsAmount) || 0) / 4))} / week
                  </p>
                )}
              </div>

              {/* preset shortcuts */}
              <div className="flex gap-2">
                {SAVINGS_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSavingsAmount(String(p))}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                      savingsAmount === String(p)
                        ? "bg-[#5EB3FF] text-[#1A1A2E]"
                        : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                    }`}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Bills ── */}
          {subStep === 2 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5">
                  STEP 3 OF 5
                </p>
                <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
                  What bills do you pay?
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  Current subtracts these before you see your Safe-To-Spend.
                </p>
              </div>

              {pendingBills.length > 0 && (
                <div className="flex flex-col gap-2">
                  {pendingBills.map((bill, i) => (
                    <div
                      key={i}
                      className="bg-[#16213E] rounded-2xl px-4 py-3 flex items-center justify-between shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div>
                        <p className="text-white text-sm font-semibold">
                          {bill.name}
                        </p>
                        <p className="text-white/35 text-[11px]">
                          ${fmt(bill.amount)} ·{" "}
                          {BILL_FREQS.find((f) => f.value === bill.frequency)
                            ?.label ?? bill.frequency}
                        </p>
                      </div>
                      <button
                        onClick={() => removeBill(i)}
                        className="text-white/20 hover:text-white/60 text-[11px] transition-colors ml-4"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[#16213E] rounded-[20px] p-5 flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase">
                  {pendingBills.length > 0 ? "ADD ANOTHER BILL" : "ADD A BILL"}
                </p>

                <input
                  type="text"
                  placeholder="Bill name (e.g. Rent, Netflix)"
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors placeholder:text-white/20"
                />

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Amount"
                      value={billAmount}
                      onChange={(e) => setBillAmount(e.target.value)}
                      className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl pl-7 pr-3 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors placeholder:text-white/20"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark"
                    />
                  </div>
                </div>

                <div>
                  <p className="text-white/30 text-[11px] font-bold tracking-[0.15em] uppercase mb-2">
                    FREQUENCY
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {BILL_FREQS.map((f) => (
                      <button
                        key={f.value}
                        onClick={() => setBillFrequency(f.value)}
                        className={`py-2 rounded-xl text-[12px] font-bold transition-all ${
                          billFrequency === f.value
                            ? "bg-[#5EB3FF] text-[#1A1A2E]"
                            : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={addBill}
                  className="w-full py-2.5 bg-white/8 text-white/70 font-semibold rounded-xl text-sm hover:bg-white/12 hover:text-white transition-all"
                >
                  + Add bill
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Savings goals ── */}
          {subStep === 3 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5">
                  STEP 4 OF 5
                </p>
                <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
                  What are you saving towards?
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  Current will break these into monthly contributions, funded
                  automatically from your Safe-To-Spend.
                </p>
              </div>

              {pendingGoals.length > 0 && (
                <div className="flex flex-col gap-2">
                  {pendingGoals.length > 1 && (
                    <p className="text-white/25 text-[11px] px-1">
                      Current funds goals top-to-bottom — drag the arrows to set priority.
                    </p>
                  )}
                  {pendingGoals.map((goal, i) => (
                    <div
                      key={i}
                      className="bg-[#16213E] rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      {/* priority controls */}
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <button
                          onClick={() => moveGoal(i, -1)}
                          disabled={i === 0}
                          className="text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-default transition-colors text-xs leading-none"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveGoal(i, 1)}
                          disabled={i === pendingGoals.length - 1}
                          className="text-white/30 hover:text-white/70 disabled:opacity-20 disabled:cursor-default transition-colors text-xs leading-none"
                        >
                          ↓
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">
                          {goal.name}
                        </p>
                        <p className="text-white/35 text-[11px]">
                          ${fmt(goal.amount)} · by {fmtGoalDate(goal.dueDate)}
                        </p>
                      </div>

                      <span className="text-white/20 text-[10px] font-bold tracking-widest shrink-0">
                        #{i + 1}
                      </span>

                      <button
                        onClick={() => removeGoal(i)}
                        className="text-white/20 hover:text-white/60 text-[11px] transition-colors shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-[#16213E] rounded-[20px] p-5 flex flex-col gap-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase">
                  {pendingGoals.length > 0 ? "ADD ANOTHER GOAL" : "ADD A GOAL"}
                </p>

                <input
                  type="text"
                  placeholder="Goal name (e.g. Emergency Fund, Vacation)"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors placeholder:text-white/20"
                />

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      placeholder="Target amount"
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(e.target.value)}
                      className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl pl-7 pr-3 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors placeholder:text-white/20"
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="date"
                      value={goalDate}
                      onChange={(e) => setGoalDate(e.target.value)}
                      className="w-full bg-[#1A1A2E] border border-white/8 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark"
                    />
                  </div>
                </div>

                <button
                  onClick={addGoal}
                  className="w-full py-2.5 bg-white/8 text-white/70 font-semibold rounded-xl text-sm hover:bg-white/12 hover:text-white transition-all"
                >
                  + Add goal
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 5: Minimum monthly spend ── */}
          {subStep === 4 && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-[#5EB3FF] text-[11px] font-bold tracking-[0.18em] uppercase mb-1.5">
                  STEP 5 OF 5
                </p>
                <h1 className="text-[28px] font-extrabold tracking-[-0.5px] leading-tight mb-1.5">
                  What's your spending floor?
                </h1>
                <p className="text-white/40 text-sm leading-relaxed">
                  Current won't let savings push your spendable amount
                  below this.
                </p>
              </div>

              <div className="bg-[#16213E] rounded-[28px] p-6 flex flex-col items-center gap-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <p className="text-white/40 text-[11px] font-bold tracking-[0.18em] uppercase">
                  MINIMUM MONTHLY SPEND
                </p>
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-[#5EB3FF]/60 text-2xl font-bold mr-0.5">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={spendAmount}
                    onChange={(e) =>
                      setSpendAmount(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    placeholder="0"
                    className="text-[#5EB3FF] text-6xl font-bold leading-none bg-transparent border-b-2 border-transparent focus:border-[#5EB3FF]/30 outline-none text-center w-36 transition-colors caret-[#5EB3FF]/60 placeholder:text-[#5EB3FF]/25"
                  />
                </div>
                {(parseFloat(spendAmount) || 0) > 0 && (
                  <p className="text-white/30 text-[11px]">
                    always available to spend each month
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {SPEND_PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSpendAmount(String(p))}
                    className={`flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all ${
                      spendAmount === String(p)
                        ? "bg-[#5EB3FF] text-[#1A1A2E]"
                        : "bg-white/6 text-white/40 hover:text-white/60 hover:bg-white/9"
                    }`}
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* footer actions */}
        <div className="border-t border-white/8">
          <div className="px-16 pb-8 pt-4 flex flex-col gap-3">
            <button
              onClick={handleContinue}
              disabled={saving}
              className="w-full py-3.5 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-[15px] hover:brightness-110 transition-all disabled:opacity-45 disabled:cursor-not-allowed tracking-[-0.2px]"
            >
              {saving ? "Saving…" : subStep === 4 ? "Finish setup →" : "Continue →"}
            </button>
            <button
              onClick={handleSkip}
              className="text-sm text-white/30 hover:text-white/60 transition-colors text-center"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
