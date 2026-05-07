"use client";
import { authClient, useSession, signOut } from "../lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import AppHeader from "../components/app-header";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import LoadingScreen from "../components/loading-screen";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;

interface Account {
  id: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  institutionName: string;
  isSavingsAccount: boolean;
  availableBalance: string | number;
}

interface IncomeRecord {
  id: string;
  source: string | null;
  amount: string | number;
  frequency: string;
  nextPaymentDate: string | null;
}

const FREQ_LABELS: Record<string, string> = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Biweekly",
  semimonthly: "Semimonthly",
  monthly: "Monthly",
  yearly: "Yearly",
};

interface UserSettings {
  paychequeAmount: string | number;
  paychequeFrequency: string;
  nextPaychequeDate: string | null;
  desiredMinimumMonthlySpend: string | number;
  notificationsEnabled: boolean;
  theme: string;
}

function PlaidOpener({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [userStatus, setUserStatus] = useState<string>("active");

  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({});
  const [savedToggleId, setSavedToggleId] = useState<string | null>(null);
  const [disconnectConfirmId, setDisconnectConfirmId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connectingBank, setConnectingBank] = useState(false);

  const [paychequeAmount, setPaychequeAmount] = useState(0);
  const [paychequeFrequency, setPaychequeFrequency] = useState("biweekly");
  const [nextPaychequeDate, setNextPaychequeDate] = useState("");
  const [incomeSaving, setIncomeSaving] = useState(false);

  const [spendingFloor, setSpendingFloor] = useState(0);
  const [floorSaving, setFloorSaving] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [addingIncome, setAddingIncome] = useState(false);
  const [addForm, setAddForm] = useState({ source: "", amount: "", frequency: "monthly", date: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ source: "", amount: "", frequency: "monthly", date: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmIncomeId, setDeleteConfirmIncomeId] = useState<string | null>(null);
  const [deletingIncomeId, setDeletingIncomeId] = useState<string | null>(null);

  const [pwOpen, setPwOpen] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else if (session?.user.id) {
      loadAccounts();
      loadUserDetails();
      loadIncome();
    }
  }, [session, isPending]);

  async function loadAccounts() {
    setAccountsLoading(true);
    try {
      const res = await fetch(`${API}/accounts`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        toast.error("Failed to load accounts.");
        return;
      }
      const data = await res.json();
      const accs: Account[] = data.bankAccounts ?? [];
      setAccounts(accs);
      const initial: Record<string, boolean> = {};
      accs.forEach((a) => { initial[a.id] = a.isSavingsAccount; });
      setToggleStates(initial);
    } catch {
      toast.error("Failed to load accounts.");
    } finally {
      setAccountsLoading(false);
    }
  }

  async function loadUserDetails() {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API}/user-details`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        toast.error("Failed to load settings.");
        return;
      }
      const data = await res.json();
      const settings: UserSettings | null = data.returnData.userSettings ?? null;
      setUserStatus(data.returnData.userStatus ?? "active");
      if (settings) {
        setPaychequeAmount(Number(settings.paychequeAmount) || 0);
        setPaychequeFrequency(settings.paychequeFrequency || "biweekly");
        setNextPaychequeDate(
          settings.nextPaychequeDate
            ? new Date(settings.nextPaychequeDate).toISOString().split("T")[0]
            : ""
        );
        setSpendingFloor(Number(settings.desiredMinimumMonthlySpend) || 0);
      }
    } catch {
      toast.error("Failed to load settings.");
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleSavingsToggle(accountId: string, newValue: boolean) {
    setToggleStates((prev) => ({ ...prev, [accountId]: newValue }));
    try {
      const res = await fetch(`${API}/accounts/savings-toggle`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, isSavings: newValue }),
      });
      if (!res.ok) throw new Error();
      setSavedToggleId(accountId);
      setTimeout(() => setSavedToggleId((prev) => (prev === accountId ? null : prev)), 2000);
    } catch {
      setToggleStates((prev) => ({ ...prev, [accountId]: !newValue }));
      toast.error("Failed to update savings account status.");
    }
  }

  async function handleDisconnect(accountId: string) {
    setDisconnecting(true);
    try {
      const res = await fetch(`${API}/delete/bank-account`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      if (!res.ok) throw new Error();
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      setDisconnectConfirmId(null);
      toast.success("Account disconnected.");
    } catch {
      toast.error("Failed to disconnect account.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleConnectBank() {
    setConnectingBank(true);
    try {
      const res = await fetch(`${API}/create-link-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch {
      toast.error("Failed to start bank connection.");
      setConnectingBank(false);
    }
  }

  async function handlePlaidSuccess(publicToken: string) {
    setLinkToken(null);
    setConnectingBank(false);
    try {
      const res = await fetch(`${API}/exchange-public-token`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
      });
      if (!res.ok) throw new Error();
      toast.success("Bank account connected.");
      await loadAccounts();
    } catch {
      toast.error("Failed to connect bank account.");
    }
  }

  async function handleSaveIncome() {
    if (!nextPaychequeDate) {
      toast.error("Please enter a next paycheque date.");
      return;
    }
    setIncomeSaving(true);
    try {
      // TODO: if this 404s, the backend may have registered the route without a leading slash
      const res = await fetch(`${API}/settings/income`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paychequeAmount, paychequeFrequency, nextPaychequeDate }),
      });
      if (!res.ok) throw new Error();
      toast.success("Income settings saved.");
    } catch {
      toast.error("Failed to save income settings.");
    } finally {
      setIncomeSaving(false);
    }
  }

  async function loadIncome() {
    setIncomeLoading(true);
    try {
      const res = await fetch(`${API}/income`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) { toast.error("Failed to load income."); return; }
      const data = await res.json();
      setIncomeRecords(
        (data.income ?? []).filter((r: IncomeRecord) => r.source !== "paycheque")
      );
    } catch {
      toast.error("Failed to load income.");
    } finally {
      setIncomeLoading(false);
    }
  }

  function startEditIncome(record: IncomeRecord) {
    setEditingId(record.id);
    setDeleteConfirmIncomeId(null);
    setEditForm({
      source: record.source ?? "",
      amount: String(Number(record.amount) || ""),
      frequency: record.frequency,
      date: record.nextPaymentDate
        ? new Date(record.nextPaymentDate).toISOString().split("T")[0]
        : "",
    });
  }

  async function handleAddIncome() {
    const amount = Number(addForm.amount);
    if (!addForm.source.trim()) { toast.error("Source name is required."); return; }
    if (!amount || amount <= 0) { toast.error("Amount must be a positive number."); return; }
    setAddSaving(true);
    try {
      const res = await fetch(`${API}/income`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: addForm.source.trim(),
          amount,
          frequency: addForm.frequency,
          nextPaymentDate: addForm.date || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIncomeRecords((prev) => [...prev, data.income]);
      setAddForm({ source: "", amount: "", frequency: "monthly", date: "" });
      setAddingIncome(false);
      toast.success("Income source added.");
    } catch {
      toast.error("Failed to add income source.");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleUpdateIncome(id: string) {
    const amount = Number(editForm.amount);
    if (!editForm.source.trim()) { toast.error("Source name is required."); return; }
    if (!amount || amount <= 0) { toast.error("Amount must be a positive number."); return; }
    setEditSaving(true);
    try {
      const res = await fetch(`${API}/income/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: editForm.source.trim(),
          amount,
          frequency: editForm.frequency,
          nextPaymentDate: editForm.date || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setIncomeRecords((prev) => prev.map((r) => (r.id === id ? data.income : r)));
      setEditingId(null);
      toast.success("Income source updated.");
    } catch {
      toast.error("Failed to update income source.");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDeleteIncome(id: string) {
    setDeletingIncomeId(id);
    try {
      const res = await fetch(`${API}/income/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      setIncomeRecords((prev) => prev.filter((r) => r.id !== id));
      setDeleteConfirmIncomeId(null);
      toast.success("Income source removed.");
    } catch {
      toast.error("Failed to remove income source.");
    } finally {
      setDeletingIncomeId(null);
    }
  }

  async function handleSaveSpendingFloor() {
    setFloorSaving(true);
    try {
      const res = await fetch(`${API}/settings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desiredMinimumMonthlySpend: spendingFloor }),
      });
      if (!res.ok) throw new Error();
      toast.success("Spending floor saved.");
    } catch {
      toast.error("Failed to save spending floor.");
    } finally {
      setFloorSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch(`${API}/delete/user`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      await signOut();
      router.push("/login");
    } catch {
      toast.error("Failed to schedule account deletion.");
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }

  async function handleCancelDeletion() {
    try {
      const res = await fetch(`${API}/reactivate/user`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      setUserStatus("active");
      toast.success("Account deletion cancelled.");
    } catch {
      toast.error("Failed to cancel deletion. Please try again.");
    }
  }

  async function handleChangePassword() {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      toast.error("Please fill in all fields.");
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error("New passwords do not match.");
      return;
    }
    if (pwNew.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setPwSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword: pwCurrent,
        newPassword: pwNew,
        revokeOtherSessions: true,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Failed to change password.");
        return;
      }
      toast.success("Password updated successfully.");
      setPwOpen(false);
      setPwCurrent(""); setPwNew(""); setPwConfirm("");
    } catch {
      toast.error("Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  if (!authResolved) return <LoadingScreen />;
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      {linkToken && <PlaidOpener token={linkToken} onSuccess={handlePlaidSuccess} />}

      <AppHeader activePage="settings" />

      <main className="px-10 py-9 mx-auto w-full max-w-7xl">
        <div className="mb-8">
          <h1 className="text-[24px] font-extrabold tracking-[-0.5px]">Settings</h1>
          <p className="text-white/40 text-sm mt-1">Manage your account and preferences</p>
        </div>

        <div className="flex flex-col gap-6">
          {/* ── Section 1: Connected Accounts ── */}
          <section>
            <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase mb-3 px-1">
              Connected Accounts
            </p>
            <div className="bg-[#16213E] rounded-[28px] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {accountsLoading ? (
                <div className="flex flex-col gap-3">
                  {[0, 1].map((k) => (
                    <div key={k} className="h-16 bg-white/4 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                <p className="text-white/40 text-sm text-center py-4">No linked accounts.</p>
              ) : (
                <div className="flex flex-col divide-y divide-white/6">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="py-4 first:pt-0 last:pb-0">
                      {disconnectConfirmId === acc.id ? (
                        /* inline disconnect confirmation */
                        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F97316]/8 border border-[#F97316]/20 px-5 py-4">
                          <p className="text-sm text-white/80">
                            Disconnect{" "}
                            <span className="font-semibold text-white">{acc.accountName}</span>
                            {" "}from Current? This will remove all associated transactions.
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setDisconnectConfirmId(null)}
                              className="px-3.5 py-1.5 rounded-xl text-[13px] font-semibold text-white/60 hover:text-white transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDisconnect(acc.id)}
                              disabled={disconnecting}
                              className="px-4 py-1.5 rounded-xl bg-[#F97316] text-white text-[13px] font-semibold hover:bg-[#ea6c10] transition-colors disabled:opacity-50"
                            >
                              {disconnecting ? "Disconnecting…" : "Disconnect"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4">
                          {/* account info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[15px] font-semibold truncate">{acc.accountName}</p>
                              <span className="shrink-0 text-[10px] font-bold tracking-[0.8px] uppercase text-white/30">
                                {acc.accountType}
                                {acc.accountSubType ? ` · ${acc.accountSubType}` : ""}
                              </span>
                            </div>
                            <p className="text-[12px] text-white/40">{acc.institutionName}</p>
                          </div>

                          {/* balance */}
                          <p className="text-[15px] font-bold tabular-nums text-white shrink-0">
                            ${Number(acc.availableBalance).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </p>

                          {/* savings toggle */}
                          <div className="flex items-center gap-2 shrink-0">
                            {savedToggleId === acc.id && (
                              <span className="text-[11px] font-semibold text-[#3ecf8e] animate-pulse">
                                Saved
                              </span>
                            )}
                            <span className="text-[12px] text-white/40 font-medium">Savings account</span>
                            <button
                              onClick={() => handleSavingsToggle(acc.id, !toggleStates[acc.id])}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                toggleStates[acc.id] ? "bg-[#3ecf8e]" : "bg-white/15"
                              }`}
                              role="switch"
                              aria-checked={toggleStates[acc.id]}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                                  toggleStates[acc.id] ? "translate-x-5" : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>

                          {/* disconnect */}
                          <button
                            onClick={() => setDisconnectConfirmId(acc.id)}
                            className="shrink-0 p-2 rounded-xl text-white/30 hover:text-[#F97316] hover:bg-[#F97316]/8 transition-colors"
                            title="Disconnect account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* connect another bank */}
              <div className={`${accounts.length > 0 ? "mt-5 pt-5 border-t border-white/6" : "mt-0"}`}>
                <button
                  onClick={handleConnectBank}
                  disabled={connectingBank}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#5EB3FF]/10 text-[#5EB3FF] font-semibold text-[13px] hover:bg-[#5EB3FF]/16 transition-colors disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {connectingBank ? "Opening Plaid…" : "Connect another bank"}
                </button>
              </div>
            </div>
          </section>

          {/* ── Section 2: Income ── */}
          <section>
            <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase mb-3 px-1">
              Income
            </p>
            <div className="bg-[#16213E] rounded-[28px] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {settingsLoading ? (
                <div className="flex flex-col gap-4">
                  {[0, 1, 2].map((k) => (
                    <div key={k} className="h-10 bg-white/4 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {/* primary paycheque */}
                  <p className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                    Primary Paycheque
                  </p>
                  <div className="grid grid-cols-3 gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={paychequeAmount}
                          onChange={(e) => setPaychequeAmount(Number(e.target.value))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl pl-7 pr-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Frequency
                      </label>
                      <select
                        value={paychequeFrequency}
                        onChange={(e) => setPaychequeFrequency(e.target.value)}
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors appearance-none"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Biweekly</option>
                        <option value="semimonthly">Semimonthly</option>
                        <option value="monthly">Monthly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Next Paycheque Date
                      </label>
                      <input
                        type="date"
                        value={nextPaychequeDate}
                        onChange={(e) => setNextPaychequeDate(e.target.value)}
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      onClick={handleSaveIncome}
                      disabled={incomeSaving}
                      className="px-5 py-2.5 rounded-xl bg-[#5EB3FF] text-[#111125] text-sm font-bold hover:bg-[#4da8f5] transition-colors disabled:opacity-50"
                    >
                      {incomeSaving ? "Saving…" : "Save paycheque"}
                    </button>
                  </div>

                  {/* other income sources */}
                  <div className="border-t border-white/6 pt-5">
                    <p className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase mb-4">
                      Other Income
                    </p>

                    {incomeLoading ? (
                      <div className="flex flex-col gap-2">
                        {[0, 1].map((k) => (
                          <div key={k} className="h-12 bg-white/4 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      <>
                        {incomeRecords.length > 0 && (
                          <div className="flex flex-col divide-y divide-white/6 mb-4">
                            {incomeRecords.map((record) => (
                              <div key={record.id} className="py-3.5 first:pt-0">
                                {editingId === record.id ? (
                                  /* inline edit form */
                                  <div className="rounded-2xl bg-white/3 border border-white/8 p-4">
                                    <div className="grid grid-cols-4 gap-3 mb-3">
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Source</label>
                                        <input
                                          type="text"
                                          placeholder="e.g. Freelance"
                                          value={editForm.source}
                                          onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
                                          className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Amount</label>
                                        <div className="relative">
                                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">$</span>
                                          <input
                                            type="number"
                                            min={0}
                                            step={0.01}
                                            placeholder="0.00"
                                            value={editForm.amount}
                                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                                            className="w-full bg-white/6 border border-white/10 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                          />
                                        </div>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Frequency</label>
                                        <select
                                          value={editForm.frequency}
                                          onChange={(e) => setEditForm((f) => ({ ...f, frequency: e.target.value }))}
                                          className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors appearance-none"
                                        >
                                          <option value="one_time">One-time</option>
                                          <option value="daily">Daily</option>
                                          <option value="weekly">Weekly</option>
                                          <option value="biweekly">Biweekly</option>
                                          <option value="semimonthly">Semimonthly</option>
                                          <option value="monthly">Monthly</option>
                                          <option value="yearly">Yearly</option>
                                        </select>
                                      </div>
                                      <div className="flex flex-col gap-1.5">
                                        <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Next date <span className="text-white/20">(optional)</span></label>
                                        <input
                                          type="date"
                                          value={editForm.date}
                                          onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                                          className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setEditingId(null)}
                                        className="px-3.5 py-1.5 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleUpdateIncome(record.id)}
                                        disabled={editSaving}
                                        className="px-4 py-1.5 rounded-xl bg-[#5EB3FF] text-[#111125] text-[13px] font-bold hover:bg-[#4da8f5] transition-colors disabled:opacity-50"
                                      >
                                        {editSaving ? "Saving…" : "Save"}
                                      </button>
                                    </div>
                                  </div>
                                ) : deleteConfirmIncomeId === record.id ? (
                                  /* inline delete confirmation */
                                  <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F97316]/8 border border-[#F97316]/20 px-4 py-3">
                                    <p className="text-sm text-white/70">
                                      Remove <span className="font-semibold text-white">{record.source}</span>?
                                    </p>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={() => setDeleteConfirmIncomeId(null)}
                                        className="px-3 py-1.5 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white transition-colors"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleDeleteIncome(record.id)}
                                        disabled={deletingIncomeId === record.id}
                                        className="px-4 py-1.5 rounded-xl bg-[#F97316] text-white text-[13px] font-semibold hover:bg-[#ea6c10] transition-colors disabled:opacity-50"
                                      >
                                        {deletingIncomeId === record.id ? "Removing…" : "Remove"}
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  /* row display */
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[14px] font-semibold truncate">{record.source}</p>
                                    </div>
                                    <p className="text-[14px] font-bold tabular-nums text-white shrink-0">
                                      ${Number(record.amount).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </p>
                                    <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#5EB3FF]/10 text-[#5EB3FF] text-[11px] font-bold">
                                      {FREQ_LABELS[record.frequency] ?? record.frequency}
                                    </span>
                                    {record.nextPaymentDate && (
                                      <span className="shrink-0 text-[12px] text-white/35">
                                        {new Date(record.nextPaymentDate).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}
                                    <button
                                      onClick={() => startEditIncome(record)}
                                      className="shrink-0 p-1.5 rounded-xl text-white/30 hover:text-[#5EB3FF] hover:bg-[#5EB3FF]/8 transition-colors"
                                      title="Edit"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setDeleteConfirmIncomeId(record.id);
                                        setEditingId(null);
                                      }}
                                      className="shrink-0 p-1.5 rounded-xl text-white/30 hover:text-[#F97316] hover:bg-[#F97316]/8 transition-colors"
                                      title="Remove"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* add income form / button */}
                        {addingIncome ? (
                          <div className="rounded-2xl bg-white/3 border border-white/8 p-4">
                            <div className="grid grid-cols-4 gap-3 mb-3">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Source</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Freelance"
                                  value={addForm.source}
                                  onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                                  autoFocus
                                  className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                />
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Amount</label>
                                <div className="relative">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm font-semibold">$</span>
                                  <input
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    placeholder="0.00"
                                    value={addForm.amount}
                                    onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                                    className="w-full bg-white/6 border border-white/10 rounded-xl pl-6 pr-3 py-2 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                  />
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Frequency</label>
                                <select
                                  value={addForm.frequency}
                                  onChange={(e) => setAddForm((f) => ({ ...f, frequency: e.target.value }))}
                                  className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors appearance-none"
                                >
                                  <option value="one_time">One-time</option>
                                  <option value="daily">Daily</option>
                                  <option value="weekly">Weekly</option>
                                  <option value="biweekly">Biweekly</option>
                                  <option value="semimonthly">Semimonthly</option>
                                  <option value="monthly">Monthly</option>
                                  <option value="yearly">Yearly</option>
                                </select>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold tracking-[1px] text-white/35 uppercase">Next date <span className="text-white/20">(optional)</span></label>
                                <input
                                  type="date"
                                  value={addForm.date}
                                  onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))}
                                  className="bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setAddingIncome(false);
                                  setAddForm({ source: "", amount: "", frequency: "monthly", date: "" });
                                }}
                                className="px-3.5 py-1.5 rounded-xl text-[13px] font-semibold text-white/50 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleAddIncome}
                                disabled={addSaving}
                                className="px-4 py-1.5 rounded-xl bg-[#5EB3FF] text-[#111125] text-[13px] font-bold hover:bg-[#4da8f5] transition-colors disabled:opacity-50"
                              >
                                {addSaving ? "Adding…" : "Add"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setAddingIncome(true);
                              setEditingId(null);
                              setDeleteConfirmIncomeId(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white/4 text-white/50 font-semibold text-[13px] hover:bg-white/7 hover:text-white/80 transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                            Add income source
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 3: Spending Floor ── */}
          <section>
            <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase mb-3 px-1">
              Spending Floor
            </p>
            <div className="bg-[#16213E] rounded-[28px] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {settingsLoading ? (
                <div className="h-10 bg-white/4 rounded-xl animate-pulse" />
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="flex items-end gap-5">
                    <div className="flex flex-col gap-2 w-60">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Monthly minimum
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 font-semibold text-sm">$</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={spendingFloor}
                          onChange={(e) => setSpendingFloor(Number(e.target.value))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl pl-7 pr-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handleSaveSpendingFloor}
                      disabled={floorSaving}
                      className="px-5 py-2.5 rounded-xl bg-[#5EB3FF] text-[#111125] text-sm font-bold hover:bg-[#4da8f5] transition-colors disabled:opacity-50"
                    >
                      {floorSaving ? "Saving…" : "Save"}
                    </button>
                  </div>
                  <p className="text-[13px] text-white/40 leading-relaxed max-w-lg">
                    Current protects this amount each month before allocating anything to your savings goals.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 4: Password ── */}
          <section>
            <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase mb-3 px-1">
              Password
            </p>
            <div className="bg-[#16213E] rounded-[28px] p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              {pwOpen ? (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Current password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwCurrent}
                        onChange={(e) => setPwCurrent(e.target.value)}
                        className="bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        New password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwNew}
                        onChange={(e) => setPwNew(e.target.value)}
                        className="bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none focus:border-[#5EB3FF]/50 transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold tracking-[1.5px] text-white/40 uppercase">
                        Confirm new password
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={pwConfirm}
                        onChange={(e) => setPwConfirm(e.target.value)}
                        className={`bg-white/4 border rounded-xl px-4 py-2.5 text-sm font-semibold text-white placeholder-white/25 focus:outline-none transition-colors ${
                          pwConfirm && pwNew !== pwConfirm
                            ? "border-[#F97316]/60 focus:border-[#F97316]/70"
                            : "border-white/8 focus:border-[#5EB3FF]/50"
                        }`}
                      />
                    </div>
                  </div>
                  {pwConfirm && pwNew !== pwConfirm && (
                    <p className="text-[#F97316] text-xs font-semibold">Passwords do not match.</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setPwOpen(false); setPwCurrent(""); setPwNew(""); setPwConfirm(""); }}
                      className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white/60 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={pwSaving}
                      className="px-5 py-2.5 rounded-xl bg-[#5EB3FF] text-[#111125] text-sm font-bold hover:bg-[#4da8f5] transition-colors disabled:opacity-50"
                    >
                      {pwSaving ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[15px] font-semibold mb-0.5">Change password</p>
                    <p className="text-[13px] text-white/40">Update the password used to sign in to Current.</p>
                  </div>
                  <button
                    onClick={() => setPwOpen(true)}
                    className="shrink-0 px-4 py-2.5 rounded-xl bg-white/6 text-white text-[13px] font-semibold hover:bg-white/10 transition-colors"
                  >
                    Change password
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 5: Danger Zone ── */}
          <section>
            <p className="text-[11px] font-bold tracking-[2px] text-white/40 uppercase mb-3 px-1">
              Danger Zone
            </p>
            <div
              className="bg-[#16213E] rounded-[28px] p-8 border"
              style={{ borderColor: "rgba(249,115,22,0.3)" }}
            >
              <div className="flex flex-col gap-8">
                {/* account deletion */}
                <div>
                  <p className="text-[15px] font-bold mb-1">Delete account</p>
                  {userStatus === "pending_deletion" ? (
                    <div className="mt-4 rounded-2xl bg-[#F97316]/8 border border-[#F97316]/20 px-5 py-4 flex items-center justify-between gap-4">
                      <p className="text-sm text-white/70">
                        Your account is scheduled for deletion. You can cancel this within the 30-day window.
                      </p>
                      <button
                        onClick={handleCancelDeletion}
                        className="shrink-0 px-4 py-2 rounded-xl bg-white/8 text-white text-[13px] font-semibold hover:bg-white/12 transition-colors"
                      >
                        Cancel deletion
                      </button>
                    </div>
                  ) : deleteConfirmOpen ? (
                    /* inline deletion confirmation */
                    <div className="mt-4 rounded-2xl bg-[#F97316]/8 border border-[#F97316]/20 px-5 py-4">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className="text-sm text-white/80 leading-relaxed">
                          Your account will be{" "}
                          <span className="text-white font-semibold">permanently deleted after 30 days</span>.
                          You can cancel this within that window by returning to settings. All your data — accounts, transactions, and goals — will be removed.
                        </p>
                        <button
                          onClick={() => setDeleteConfirmOpen(false)}
                          className="shrink-0 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDeleteConfirmOpen(false)}
                          className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white/60 hover:text-white transition-colors"
                        >
                          Keep my account
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deleting}
                          className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-[13px] font-bold hover:bg-[#ea6c10] transition-colors disabled:opacity-50"
                        >
                          {deleting ? "Scheduling deletion…" : "Yes, delete my account"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-[13px] text-white/40 mb-4 max-w-lg">
                        Once you request deletion, your account will be permanently removed after a 30-day grace period. You can cancel within that window.
                      </p>
                      <button
                        onClick={() => setDeleteConfirmOpen(true)}
                        className="px-4 py-2.5 rounded-xl border border-[#F97316]/40 text-[#F97316] text-[13px] font-semibold hover:bg-[#F97316]/8 transition-colors"
                      >
                        Delete account
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
