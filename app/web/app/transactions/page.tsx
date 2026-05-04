"use client";

import { useSession } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Car,
  Circle,
  CircleDollarSign,
  CircleParking,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Fuel,
  Gamepad2,
  GraduationCap,
  Heart,
  Home,
  Hotel,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Pill,
  Plane,
  Scissors,
  ChevronDown,
  Search,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Stethoscope,
  Ticket,
  TrainFront,
  Utensils,
  Wifi,
  Wine,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import AppHeader from "../components/app-header";
import ErrorDashboard from "../dashboard/error-dashboard";
import LoadingScreen from "../components/loading-screen";

type LoadingState = "loading" | "loaded" | "error";

interface Transaction {
  id: string;
  merchantName: string | null;
  amount: string | number;
  date: string;
  transactionTime: string;
  category: string[];
  transactionCategory: string | null;
  transactionType: string;
  accountId: string | null;
  logoUrl: string | null;
}

interface Account {
  id: string;
  plaidAccountId: string;
  accountName: string;
  institutionName: string;
  isSavingsAccount: boolean;
  accountType: string;
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

function txnDateLabel(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.getTime() === today.getTime()) return "Today";
    if (date.getTime() === yesterday.getTime()) return "Yesterday";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== today.getFullYear()
        ? { year: "numeric" }
        : {}),
    });
  } catch {
    return dateStr.slice(0, 10);
  }
}

function fmtShortDate(s: string): string {
  if (!s) return "";
  try {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

const PLAID_LABELS: Record<string, string> = {
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "Bar & Drinks",
  FOOD_AND_DRINK_COFFEE: "Coffee",
  FOOD_AND_DRINK_FAST_FOOD: "Fast Food",
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_RESTAURANT: "Restaurant",
  FOOD_AND_DRINK_VENDING_MACHINES: "Vending",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "Food & Drink",
  TRANSPORTATION_BIKES_AND_SCOOTERS: "Bikes & Scooters",
  TRANSPORTATION_GAS: "Gas",
  TRANSPORTATION_PARKING: "Parking",
  TRANSPORTATION_PUBLIC_TRANSIT: "Transit",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Ride Share",
  TRANSPORTATION_TOLLS: "Tolls",
  TRANSPORTATION_OTHER_TRANSPORTATION: "Transportation",
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "Gambling",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Music",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS:
    "Events & Activities",
  ENTERTAINMENT_TV_AND_MOVIES: "TV & Movies",
  ENTERTAINMENT_VIDEO_GAMES: "Video Games",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: "Books",
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "Clothing",
  GENERAL_MERCHANDISE_CONVENIENCE_STORES: "Convenience Store",
  GENERAL_MERCHANDISE_DEPARTMENT_STORES: "Department Store",
  GENERAL_MERCHANDISE_DISCOUNT_STORES: "Discount Store",
  GENERAL_MERCHANDISE_ELECTRONICS: "Electronics",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "Gifts",
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES: "Office Supplies",
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES: "Online Shopping",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "Pet Supplies",
  GENERAL_MERCHANDISE_SPORTING_GOODS: "Sporting Goods",
  GENERAL_MERCHANDISE_SUPERSTORES: "Superstore",
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPING: "Tobacco & Vaping",
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: "Shopping",
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: "Financial Services",
  GENERAL_SERVICES_AUTOMOTIVE: "Auto Service",
  GENERAL_SERVICES_CHILDCARE: "Childcare",
  GENERAL_SERVICES_CONSULTING_AND_LEGAL: "Legal Services",
  GENERAL_SERVICES_EDUCATION: "Education",
  GENERAL_SERVICES_INSURANCE: "Insurance",
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING: "Shipping",
  GENERAL_SERVICES_STORAGE: "Storage",
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "Donation",
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS: "Government",
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "Tax",
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT: "Government",
  HOME_IMPROVEMENT_FURNITURE: "Furniture",
  HOME_IMPROVEMENT_HARDWARE: "Hardware",
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: "Home Repair",
  HOME_IMPROVEMENT_SECURITY: "Security",
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: "Home Improvement",
  INCOME_DIVIDENDS: "Dividends",
  INCOME_INTEREST_EARNED: "Interest",
  INCOME_RETIREMENT_PENSION: "Pension",
  INCOME_TAX_REFUND: "Tax Refund",
  INCOME_UNEMPLOYMENT: "Unemployment",
  INCOME_WAGES: "Paycheck",
  INCOME_OTHER_INCOME: "Income",
  LOAN_PAYMENTS_CAR_PAYMENT: "Car Payment",
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Credit Card",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Mortgage",
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: "Personal Loan",
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT: "Student Loan",
  LOAN_PAYMENTS_OTHER_PAYMENT: "Loan Payment",
  MEDICAL_DENTAL_CARE: "Dentist",
  MEDICAL_EYE_CARE: "Eye Care",
  MEDICAL_NURSING_CARE: "Nursing",
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: "Pharmacy",
  MEDICAL_PRIMARY_CARE: "Doctor",
  MEDICAL_VETERINARY_SERVICES: "Vet",
  MEDICAL_OTHER_MEDICAL: "Medical",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Gym",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "Hair & Beauty",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "Laundry",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "Personal Care",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Electricity",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Internet",
  RENT_AND_UTILITIES_RENT: "Rent",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Waste Management",
  RENT_AND_UTILITIES_TELEPHONE: "Phone Bill",
  RENT_AND_UTILITIES_WATER: "Water",
  RENT_AND_UTILITIES_OTHER_RENT_AND_UTILITIES: "Utilities",
  BANK_FEES_ATM_FEES: "ATM Fee",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "Foreign Fee",
  BANK_FEES_INSUFFICIENT_FUNDS: "NSF Fee",
  BANK_FEES_INTEREST_CHARGE: "Interest Charge",
  BANK_FEES_OVERDRAFT_FEES: "Overdraft Fee",
  BANK_FEES_OTHER_BANK_FEES: "Bank Fee",
  TRANSFER_IN_CASH_ADVANCES_AND_LOANS: "Cash Advance",
  TRANSFER_IN_DEPOSIT: "Deposit",
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment",
  TRANSFER_IN_SAVINGS: "Savings",
  TRANSFER_IN_ACCOUNT_TRANSFER: "Transfer",
  TRANSFER_IN_OTHER_TRANSFER_IN: "Transfer",
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: "Investment",
  TRANSFER_OUT_SAVINGS: "Savings Transfer",
  TRANSFER_OUT_WITHDRAWAL: "Withdrawal",
  TRANSFER_OUT_ACCOUNT_TRANSFER: "Transfer",
  TRANSFER_OUT_OTHER_TRANSFER_OUT: "Transfer",
  TRAVEL_FLIGHTS: "Flight",
  TRAVEL_LODGING: "Hotel",
  TRAVEL_RENTAL_CARS: "Rental Car",
  TRAVEL_OTHER_TRAVEL: "Travel",
  FOOD_AND_DRINK: "Food & Drink",
  TRANSPORTATION: "Transportation",
  ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE: "Shopping",
  GENERAL_SERVICES: "Services",
  GOVERNMENT_AND_NON_PROFIT: "Government",
  HOME_IMPROVEMENT: "Home",
  INCOME: "Income",
  LOAN_PAYMENTS: "Loan",
  MEDICAL: "Medical",
  OTHER: "Other",
  PERSONAL_CARE: "Personal Care",
  RENT_AND_UTILITIES: "Utilities",
  TRANSFER_IN: "Transfer",
  TRANSFER_OUT: "Transfer",
  BANK_FEES: "Bank Fee",
  TRAVEL: "Travel",
};

function txnIcon(
  category: string[],
  transactionCategory?: string | null,
): LucideIcon {
  const d = transactionCategory ?? "";
  const p = category[0] ?? "";

  if (d.includes("COFFEE")) return Coffee;
  if (d.includes("GROCERIES")) return ShoppingCart;
  if (d.includes("FAST_FOOD")) return Utensils;
  if (d.includes("RESTAURANT")) return Utensils;
  if (d.includes("BEER_WINE")) return Wine;
  if (d.includes("RIDE_SHARES") || d.includes("TAXIS")) return Car;
  if (d.includes("PUBLIC_TRANSIT")) return TrainFront;
  if (d.includes("PARKING")) return CircleParking;
  if (d.includes("TRANSPORTATION_GAS")) return Fuel;
  if (d.includes("BIKES_AND_SCOOTERS")) return Bike;
  if (d.includes("FLIGHTS")) return Plane;
  if (d.includes("LODGING")) return Hotel;
  if (d.includes("RENTAL_CAR")) return Car;
  if (d.includes("TV_AND_MOVIES") || d.includes("VIDEO_GAMES")) return Gamepad2;
  if (d.includes("MUSIC_AND_AUDIO")) return Music;
  if (d.includes("CASINOS")) return CircleDollarSign;
  if (d.includes("SPORTING_EVENTS")) return Ticket;
  if (d.includes("CLOTHING")) return Shirt;
  if (d.includes("ELECTRONICS")) return Laptop;
  if (d.includes("ONLINE_MARKETPLACE")) return ShoppingBag;
  if (d.includes("PET_SUPPLIES")) return PawPrint;
  if (d.includes("RENT_AND_UTILITIES_RENT")) return Home;
  if (d.includes("GAS_AND_ELECTRICITY")) return Zap;
  if (d.includes("INTERNET")) return Wifi;
  if (d.includes("TELEPHONE")) return Smartphone;
  if (d.includes("PHARMACY")) return Pill;
  if (d.includes("DENTAL")) return Stethoscope;
  if (d.includes("GYM") || d.includes("FITNESS")) return Dumbbell;
  if (d.includes("HAIR_AND_BEAUTY")) return Scissors;
  if (d.includes("AUTOMOTIVE")) return Wrench;
  if (d.includes("EDUCATION")) return GraduationCap;
  if (d.includes("INSURANCE")) return Shield;
  if (d.includes("WAGES") || d.includes("PAYROLL") || d.includes("DEPOSIT"))
    return CircleDollarSign;
  if (d.includes("TAX_REFUND") || d.includes("INTEREST_EARNED"))
    return CircleDollarSign;
  if (d.includes("CREDIT_CARD_PAYMENT")) return CreditCard;
  if (d.includes("MORTGAGE_PAYMENT")) return Home;
  if (d.includes("ATM")) return Landmark;
  if (d.includes("DONATION")) return Heart;
  if (d.includes("TAX_PAYMENT")) return Landmark;

  switch (p) {
    case "FOOD_AND_DRINK":
      return Utensils;
    case "TRANSPORTATION":
      return TrainFront;
    case "TRAVEL":
      return Plane;
    case "ENTERTAINMENT":
      return Clapperboard;
    case "GENERAL_MERCHANDISE":
      return ShoppingBag;
    case "GENERAL_SERVICES":
      return Settings;
    case "HOME_IMPROVEMENT":
      return Wrench;
    case "MEDICAL":
      return Stethoscope;
    case "PERSONAL_CARE":
      return Sparkles;
    case "RENT_AND_UTILITIES":
      return Home;
    case "INCOME":
      return CircleDollarSign;
    case "TRANSFER_IN":
      return ArrowDownRight;
    case "TRANSFER_OUT":
      return ArrowUpRight;
    case "LOAN_PAYMENTS":
      return CreditCard;
    case "BANK_FEES":
      return Landmark;
    case "GOVERNMENT_AND_NON_PROFIT":
      return Landmark;
    default:
      return Circle;
  }
}

function txnLabel(
  category: string[],
  transactionCategory: string | null,
): string {
  if (transactionCategory && PLAID_LABELS[transactionCategory]) {
    return PLAID_LABELS[transactionCategory];
  }
  const primary = category[0];
  if (primary && PLAID_LABELS[primary]) return PLAID_LABELS[primary];
  return "Transaction";
}

export default function Transactions() {
  const router = useRouter();
  const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [search, setSearch] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const PAGE_SIZE = 25;

  const hasMore = transactions.length < total;

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
    else if (session?.user.id) loadData();
  }, [session, isPending]);

  // IntersectionObserver: load more when sentinel enters viewport
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
    router.push("/login"); // in case the redirect in useEffect didn't catch it for some reason
    return null;
  }

  async function loadData() {
    if (!session) { router.push("/login"); return; }
    try {
      const [txnRes, accRes] = await Promise.all([
        fetch(`${API}/transactions?skip=0&take=${PAGE_SIZE}`, { credentials: "include" }),
        fetch(`${API}/accounts`, { credentials: "include" }),
      ]);
      if (!txnRes.ok || !accRes.ok) { setLoadingState("error"); return; }
      const txnData = await txnRes.json();
      const accData = await accRes.json();
      setTransactions(txnData.transactions ?? []);
      setTotal(txnData.total ?? 0);
      setAccounts(accData.bankAccounts ?? []);
      setLoadingState("loaded");
    } catch {
      setLoadingState("error");
    }
  }

  async function loadMore() {
    if (!session || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/transactions?skip=${transactions.length}&take=${PAGE_SIZE}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setTransactions((prev) => [...prev, ...(data.transactions ?? [])]);
      setTotal(data.total ?? total);
    } catch {/* silent */}
    finally { setLoadingMore(false); }
  }

  // set error screen
  if (loadingState === "error") return <ErrorDashboard onRetry={loadData} />;

  const loading = loadingState === "loading" || isPending;
  const firstName = session.user.name?.split(" ")[0] ?? "";

  const q = search.trim().toLowerCase();
  const filtered = transactions.filter((txn) => {
    if (q && !(txn.merchantName ?? "").toLowerCase().includes(q)) return false;
    if (selectedAccount && txn.accountId !== selectedAccount) return false;
    if (dateFrom && txn.date.slice(0, 10) < dateFrom) return false;
    if (dateTo && txn.date.slice(0, 10) > dateTo) return false;
    return true;
  });

  const dateMap = new Map<string, Transaction[]>();
  for (const txn of filtered) {
    const key = txn.date.slice(0, 10);
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(txn);
  }
  const groups = [...dateMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, txns]) => ({ date, txns }));

  const activeFilters = [
    search.trim() && {
      key: "search",
      label: `"${search.trim()}"`,
      clear: () => setSearch(""),
    },
    selectedAccount && {
      key: "account",
      label:
        accounts.find((a) => a.plaidAccountId === selectedAccount)
          ?.accountName ?? "Account",
      clear: () => setSelectedAccount(""),
    },
    (dateFrom || dateTo) && {
      key: "date",
      label:
        dateFrom && dateTo
          ? `${fmtShortDate(dateFrom)} – ${fmtShortDate(dateTo)}`
          : dateFrom
            ? `From ${fmtShortDate(dateFrom)}`
            : `Until ${fmtShortDate(dateTo)}`,
      clear: () => {
        setDateFrom("");
        setDateTo("");
      },
    },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  function clearAllFilters() {
    setSearch("");
    setSelectedAccount("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <AppHeader activePage="transactions" />

      {/* page content */}
      <main className="px-10 py-9 mx-auto w-full max-w-5xl">
        {/* heading */}
        <div className="mb-6">
          <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">
            Transactions
          </h1>
          {!loading && (
            <p className="text-white/40 text-sm mt-1">
              {filtered.length.toLocaleString()} transaction
              {filtered.length !== 1 ? "s" : ""}
              {filtered.length !== transactions.length && (
                <span className="text-white/25">
                  {" "}
                  of {transactions.length.toLocaleString()}
                </span>
              )}
            </p>
          )}
        </div>

        {/* filter bar */}
        <div className="bg-[#16213E] rounded-[28px] p-5 mb-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex gap-3 flex-wrap items-end">
            {/* search */}
            <div className="flex-1 min-w-50">
              <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Merchant name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#111125] border border-white/8 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors disabled:opacity-40"
                />
              </div>
            </div>

            {/* account */}
            <div className="min-w-40">
              <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                Account
              </label>
              <div className="relative">
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={loading || accounts.length === 0}
                  className="w-full appearance-none bg-[#111125] border border-white/8 rounded-xl px-3.5 py-2.5 pr-9 text-sm text-white/70 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors disabled:opacity-40"
                >
                  <option value="">All accounts</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.plaidAccountId}>
                      {acc.accountName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
              </div>
            </div>

            {/* date from */}
            <div>
              <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={loading}
                className="bg-[#111125] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark disabled:opacity-40"
              />
            </div>

            {/* date to */}
            <div>
              <label className="block text-[10px] font-bold tracking-[1.5px] text-white/30 uppercase mb-1.5">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={loading}
                className="bg-[#111125] border border-white/8 rounded-xl px-3.5 py-2.5 text-sm text-white/70 focus:outline-none focus:border-[#5EB3FF]/40 transition-colors scheme-dark disabled:opacity-40"
              />
            </div>
          </div>

          {/* active filter chips */}
          {activeFilters.length > 0 && (
            <div className="flex items-center gap-2 mt-3.5 flex-wrap">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={f.clear}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5EB3FF]/12 text-[#5EB3FF] rounded-full text-[12px] font-semibold hover:bg-[#5EB3FF]/20 transition-colors"
                >
                  {f.label}
                  <X className="h-3 w-3" />
                </button>
              ))}
              {activeFilters.length > 1 && (
                <button
                  onClick={clearAllFilters}
                  className="px-3 py-1.5 text-white/35 rounded-full text-[12px] font-semibold hover:text-white/55 transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* content */}
        {loading ? (
          <div className="flex flex-col gap-6">
            {[0, 1, 2].map((gi) => (
              <div key={gi}>
                <div className="h-3 w-16 bg-white/6 rounded-full animate-pulse mb-3 mx-1" />
                <div className="bg-[#16213E] rounded-[20px] p-4 flex flex-col">
                  {[0, 1, 2, 3].map((k) => (
                    <div
                      key={k}
                      className={`flex items-center gap-3.5 py-3 ${k < 3 ? "border-b border-white/6" : ""}`}
                    >
                      <div className="w-10 h-10 rounded-[13px] bg-white/4 animate-pulse shrink-0" />
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="h-3 bg-white/6 rounded-full animate-pulse w-2/5" />
                        <div className="h-2.5 bg-white/4 rounded-full animate-pulse w-1/3" />
                      </div>
                      <div className="h-3.5 w-14 bg-white/4 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="bg-[#16213E] rounded-[28px] p-10 flex flex-col items-center gap-3 text-center max-w-sm w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 font-bold text-xl mb-1">
                $
              </div>
              <p className="text-white font-semibold">No transactions yet.</p>
              <p className="text-white/40 text-sm leading-relaxed">
                Your transaction history will appear here once your accounts
                sync.
              </p>
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="bg-[#16213E] rounded-[28px] p-10 flex flex-col items-center gap-3 text-center max-w-sm w-full shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-1">
                <Search className="h-5 w-5 text-white/20" />
              </div>
              <p className="text-white font-semibold">No results</p>
              <p className="text-white/40 text-sm leading-relaxed">
                No transactions match your current filters.
              </p>
              <button
                onClick={clearAllFilters}
                className="mt-2 px-5 py-2.5 bg-[#5EB3FF]/12 text-[#5EB3FF] rounded-full text-sm font-semibold hover:bg-[#5EB3FF]/20 transition-colors"
              >
                Clear filters
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {!loading && (
              <p className="text-[11px] text-white/30 px-1 -mb-2">
                Showing {transactions.length.toLocaleString()} of {total.toLocaleString()} transactions
                {hasMore && " · scroll for more"}
              </p>
            )}
            {groups.map(({ date, txns }) => (
              <div key={date}>
                {/* date section header */}
                <div className="flex items-center gap-3 mb-2 px-1">
                  <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase shrink-0">
                    {txnDateLabel(date)}
                  </p>
                  <div className="flex-1 h-px bg-white/6" />
                </div>

                {/* transaction rows */}
                <div className="bg-[#16213E] rounded-[20px] p-4">
                  {txns.map((txn, i) => {
                    const isIncome = Number(txn.amount) < 0;
                    const displayAmt = Math.abs(Number(txn.amount));
                    const account = accounts.find(
                      (a) => a.plaidAccountId === txn.accountId,
                    );
                    const TxnIcon = txnIcon(
                      txn.category,
                      txn.transactionCategory,
                    );

                    return (
                      <div
                        key={txn.id}
                        className={`flex items-center gap-3.5 py-3 ${i < txns.length - 1 ? "border-b border-white/6" : ""}`}
                      >
                        {/* merchant logo or category icon */}
                        <div className="w-10 h-10 rounded-[13px] bg-[#5EB3FF]/10 flex items-center justify-center text-[#5EB3FF] shrink-0 overflow-hidden">
                          {txn.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={txn.logoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <TxnIcon className="h-5 w-5" />
                          )}
                        </div>

                        {/* merchant + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold truncate">
                            {txn.merchantName
                              ? toTitleCase(txn.merchantName)
                              : "Unknown"}
                          </p>
                          <p className="text-[12px] text-white/40 mt-0.5">
                            {txnLabel(txn.category, txn.transactionCategory)}
                            {account ? ` · ${account.accountName}` : ""}
                          </p>
                        </div>

                        {/* amount */}
                        <p
                          className={`text-[15px] font-bold tabular-nums shrink-0 ${isIncome ? "text-[#3ecf8e]" : "text-white"}`}
                        >
                          {isIncome ? "+" : "−"}${displayAmt.toFixed(2)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* IntersectionObserver sentinel */}
            <div ref={sentinelRef} className="h-1" />
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-[13px] text-white/30">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" />
                  Loading more…
                </div>
              </div>
            )}
            {!hasMore && transactions.length > 0 && !loading && (
              <p className="text-center text-[12px] text-white/20 py-4">
                All {total.toLocaleString()} transactions loaded
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
