"use client";
import { useSession } from "../lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bike,
  Car,
  Check,
  Circle,
  CircleDollarSign,
  CircleParking,
  Clapperboard,
  Coffee,
  CreditCard,
  Droplets,
  Dumbbell,
  Fuel,
  Gamepad2,
  GraduationCap,
  Heart,
  Home,
  Hotel,
  Info,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Pill,
  Plane,
  Receipt,
  Scissors,
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
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import AppHeader from "../components/app-header";
import InfoPopup from "./helpers/info-popup";
import ErrorDashboard from "./error-dashboard";
import LoadingScreen from "../components/loading-screen";

type LoadingState = "loading" | "loaded" | "error";

interface Account {
  id: string;
  plaidAccountId: string;
  accountName: string;
  accountType: string;
  accountSubType: string;
  institutionName: string;
  isSavingsAccount: boolean;
  availableBalance: string | number;
}

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

interface Bill {
  id: string;
  billName: string;
  amount: string | number;
  dueDate: string;
  isPaid: boolean;
}

interface BudgetItem {
  id: string;
  name: string;
  amount: string | number;
  amountSaved: string | number;
  dueDate: string;
  priority: number;
  isMonthlySavingGoal: boolean;
  isReccuring: boolean;
}

interface SafeToSpend {
  safeToSpend: number;
  pendingBudgetItemUpdates?: unknown[];
  acceptedBudgetItems?: unknown[];
  ignoredBudgetItems?: unknown[];
  availableAfterAmount?: number | null;
  availableAfterDate?: string | null;
  checkingBalance?: number;
  billsTotal?: number;
  scheduledSavings?: number;
  spendingFloor?: number;
}

// Prisma Decimal serializes as string — coerce everywhere
function fmtMoney(n: string | number) {
  const abs = Math.abs(Number(n) || 0);
  const d = Math.floor(abs);
  const c = Math.round((abs % 1) * 100)
    .toString()
    .padStart(2, "0");
  return { d: d.toLocaleString("en-US"), c };
}

function shortDate(s: string): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

// "Today", "Yesterday", or "Apr 15"
function txnDateLabel(dateStr: string): string {
  try {
    const txn = new Date(dateStr);
    txn.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (txn.getTime() === today.getTime()) return "Today";
    if (txn.getTime() === yesterday.getTime()) return "Yesterday";
    return txn.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return shortDate(dateStr);
  }
}

function daysUntil(s: string): number {
  try {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / 86400000);
  } catch {
    return 0;
  }
}

function timeGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());
}

// Full lookup table for all Plaid personal_finance_category detailed + primary values
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
  // primary category fallbacks
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

// detailed transactionCategory → icon, falls back to primary category[0]
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

// look up the human-readable label from the full lookup table
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

function billIcon(name: string): LucideIcon {
  const s = name.toLowerCase();
  if (s.includes("rent") || s.includes("housing") || s.includes("mortgage"))
    return Home;
  if (s.includes("phone") || s.includes("mobile") || s.includes("wireless"))
    return Smartphone;
  if (
    s.includes("spotify") ||
    s.includes("netflix") ||
    s.includes("music") ||
    s.includes("subscription") ||
    s.includes("streaming")
  )
    return Music;
  if (
    s.includes("electric") ||
    s.includes("power") ||
    s.includes("utility") ||
    s.includes("hydro")
  )
    return Zap;
  if (s.includes("water") || s.includes("gas")) return Droplets;
  if (s.includes("internet") || s.includes("wifi") || s.includes("cable"))
    return Wifi;
  if (s.includes("insurance")) return Shield;
  return Receipt;
}

// Transaction.accountId === bankAccounts.plaidAccountId
function matchAccount(
  accountId: string | null,
  accounts: Account[],
): Account | null {
  if (!accountId) return null;
  return accounts.find((a) => a.plaidAccountId === accountId) ?? null;
}

function pickFeaturedItem(items: BudgetItem[]): BudgetItem | null {
  if (!items.length) return null;
  const monthly = items.find((i) => i.isMonthlySavingGoal);
  if (monthly) return monthly;
  return [...items].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
}

// function starts
export default function Dashboard() {
  const router = useRouter();
  const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api`;
  const { data: session, isPending } = useSession();
  const [authResolved, setAuthResolved] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>("loading");

  const [saveToSpend, setSaveToSpend] = useState<SafeToSpend>({
    safeToSpend: 0,
  });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [showInfoPopup, setShowInfoPopup] = useState(false);

  // useEffect never runs on the server, so authResolved stays false during SSR
  // preventing any flash of content before the client knows the session state
  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  useEffect(() => {
    if (!isPending && !session) router.push("/login");
    else if (session?.user.id) getUserData();
  }, [session, isPending]);

  if (!authResolved) return <LoadingScreen />;
  if (!session) return null;

  async function getUserData() {
    if (!session) {
      toast.dismiss();
      router.push("/login");
      return;
    }
    // Clear any toasts left over from a previous failed load before fetching.
    toast.dismiss();
    try {
      // fetch user details and bills in parallel
      const [detailsRes, billsRes] = await Promise.all([
        fetch(`${API}/user-details`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
        fetch(`${API}/bills-active`, {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        }),
      ]);

      if (!detailsRes.ok) {
        toast.error("Failed to load your details.");
        setLoadingState("error");
        return;
      }

      const data = await detailsRes.json();
      const { onboardingStep, userStatus } = data.returnData;

      if (userStatus === "pending_deletion") {
        toast.dismiss();
        toast.error("Your account is scheduled for deletion. Go to Settings to cancel.", { duration: 6000 });
        router.push("/settings");
        return;
      }

      if (onboardingStep !== "complete") {
        toast.dismiss();
        router.push(`/onboarding?step=${onboardingStep ?? "intro"}`);
        return;
      }

      // sort transactions newest first
      const sortedTxns: Transaction[] = (
        data.returnData.transactions ?? []
      ).sort(
        (a: Transaction, b: Transaction) =>
          new Date(b.date).getTime() - new Date(a.date).getTime(),
      );
      setAccounts(data.returnData.bankAccounts ?? []);
      setTransactions(sortedTxns);
      setBudgetItems(data.returnData.budgetItems ?? []);

      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData.bills ?? []);
      }

      const stsRes = await fetch(`${API}/safe-to-spend`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!stsRes.ok) {
        toast.error("Failed to load Safe-to-Spend.");
        setLoadingState("error");
        return;
      }
      const sts = await stsRes.json();
      setSaveToSpend(sts.safeToSpend);
      setLoadingState("loaded");
    } catch {
      toast.error("Something went wrong. Check your connection and try again.");
      setLoadingState("error");
    }
  }

  if (loadingState === "error") return <ErrorDashboard onRetry={getUserData} />;

  const loading = loadingState === "loading" || isPending;
  const { d: stsDollars, c: stsCents } = fmtMoney(saveToSpend.safeToSpend);
  const firstName = session?.user.name?.split(" ")[0] ?? "";
  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // period always ends last day of current month
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodEndLabel = periodEnd.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const daysLeft = Math.max(
    0,
    Math.ceil(
      (periodEnd.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
    ),
  );

  const featuredItem = pickFeaturedItem(budgetItems);
  const upcomingBills = [...bills]
    .sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    )
    .slice(0, 3);
  const recentTxns = transactions.slice(0, 6);

  return (
    <div
      className="min-h-screen bg-[#111125] text-white"
      style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      {/* info popup overlay */}
      {showInfoPopup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowInfoPopup(false)}
        >
          <InfoPopup
            props={{ exit: () => setShowInfoPopup(false) }}
            breakdown={{
              checkingBalance: saveToSpend.checkingBalance ?? 0,
              billsTotal: saveToSpend.billsTotal ?? 0,
              scheduledSavings: saveToSpend.scheduledSavings ?? 0,
              safeToSpend: saveToSpend.safeToSpend,
            }}
          />
        </div>
      )}

      <AppHeader activePage="home" />

      {/* page content */}
      <main className="px-10 py-9 mx-auto w-full max-w-7xl">
        {/* greeting */}
        <div className="mb-6">
          <p className="text-white/50 text-sm font-semibold">
            {timeGreeting()}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <p className="text-[18px] font-semibold tracking-[-0.3px] text-white/70 mt-0.5">
            {todayStr}
          </p>
        </div>

        {/* hero row: safe-to-spend (2/3) + featured goal (1/3) */}
        <div className="grid grid-cols-3 gap-5 mb-5">
          {/* safe-to-spend card */}
          <div className="col-span-2 bg-[#16213E] rounded-[28px] p-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] bg-[radial-gradient(ellipse_at_top_left,rgba(94,179,255,0.08),transparent_60%)]">
            <p className="text-[11px] font-bold tracking-[2.2px] text-white/40 uppercase mb-3.5">
              SAFE TO SPEND
            </p>

            {/* the number */}
            {loading ? (
              <div className="h-27.5 bg-white/4 rounded-2xl animate-pulse mb-7" />
            ) : (
              <div
                className={`font-extrabold leading-[0.95] tabular-nums ${
                  saveToSpend.safeToSpend > 0
                    ? "text-[#5EB3FF]"
                    : "text-[#F97316]"
                }`}
                style={{
                  fontSize: "clamp(72px, 9vw, 140px)",
                  letterSpacing: "-0.04em",
                }}
              >
                <span
                  style={{
                    fontSize: "clamp(36px, 4.5vw, 64px)",
                    fontWeight: 700,
                    opacity: 0.55,
                    verticalAlign: "top",
                    lineHeight: 1.2,
                    marginRight: 2,
                  }}
                >
                  $
                </span>
                {stsDollars}
                <span
                  style={{
                    fontSize: "clamp(36px, 4.5vw, 64px)",
                    fontWeight: 700,
                    opacity: 0.55,
                  }}
                >
                  .{stsCents}
                </span>
              </div>
            )}

            {/* chips */}
            <div className="flex items-center gap-2.5 mt-7 flex-wrap">
              {!loading && (
                <span className="px-3.5 py-2 rounded-full bg-[#5EB3FF]/10 text-[#5EB3FF] font-semibold text-[13px]">
                  {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                </span>
              )}
              <button
                onClick={() => setShowInfoPopup(true)}
                className="flex hover:cursor-pointer items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/4 text-white/60 font-semibold text-[13px] hover:bg-white/7 transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
                See the math
              </button>
            </div>
          </div>

          {/* featured budget item */}
          {loading ? (
            <div className="col-span-1 bg-[#16213E] rounded-[28px] p-7 animate-pulse" />
          ) : featuredItem ? (
            <div className="col-span-1 bg-[#16213E] rounded-[28px] p-7 shadow-[inset_0_0_0_1px_rgba(245,196,0,0.18)] bg-[radial-gradient(ellipse_at_top_left,rgba(245,196,0,0.12),transparent_65%)]">
              <p className="text-[11px] font-bold tracking-[2px] text-[#F5C400] uppercase mb-3">
                {featuredItem.isMonthlySavingGoal
                  ? "Monthly Savings"
                  : featuredItem.name}
              </p>

              {/* target amount */}
              <div className="flex items-baseline gap-1.5 mb-5">
                <span className="text-[#F5C400]/60 text-[20px] font-bold">
                  $
                </span>
                <span
                  className="text-[#F5C400] font-bold tabular-nums"
                  style={{ fontSize: "34px", letterSpacing: "-1px" }}
                >
                  {(Number(featuredItem.amount) || 0).toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>

              {/* progress bar using amountSaved */}
              {Number(featuredItem.amountSaved) >= 0 &&
                Number(featuredItem.amount) > 0 && (
                  <>
                    <div className="h-2.5 rounded-full bg-white/6 overflow-hidden mb-3">
                      {Number(featuredItem.amountSaved) > 0 ? (
                        <div
                          className="h-full rounded-full bg-[#F5C400] transition-[width_0.6s_ease]"
                          style={{
                            width: `${Math.min(100, (Number(featuredItem.amountSaved) / Number(featuredItem.amount)) * 100)}%`,
                            boxShadow: "0 0 12px rgba(245,196,0,0.4)",
                          }}
                        />
                      ) : (
                        <div className="h-full w-full rounded-full bg-[#F5C400]/10" />
                      )}
                    </div>
                    <div className="flex justify-between text-[12px] text-white/50 mb-4">
                      <span>
                        <span className="text-white font-bold">
                          $
                          {(
                            Number(featuredItem.amountSaved) || 0
                          ).toLocaleString("en-US", {
                            maximumFractionDigits: 0,
                          })}
                        </span>{" "}
                        saved
                      </span>
                      <span>
                        of $
                        {(Number(featuredItem.amount) || 0).toLocaleString(
                          "en-US",
                          { maximumFractionDigits: 0 },
                        )}
                      </span>
                    </div>
                  </>
                )}

              <p className="text-[13px] text-white/50">
                {featuredItem.isMonthlySavingGoal
                  ? "Recurring · set aside monthly"
                  : featuredItem.dueDate
                    ? `Goal · due ${shortDate(featuredItem.dueDate)}`
                    : "Savings goal"}
              </p>
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[#F5C400]/15 bg-[#F5C400]/8 px-4 py-3">
                <p className="text-[13px] leading-5 text-white/62">
                  Contribute to your savings
                </p>
                <Link
                  href="/savings"
                  aria-label="Open savings page"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5C400] text-[#111125] shadow-[0_8px_22px_rgba(245,196,0,0.24)] transition-transform hover:-translate-y-0.5"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="col-span-1 bg-[#16213E] rounded-[28px] p-7 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#F5C400]/10 flex items-center justify-center text-[#F5C400]">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-white/40 text-sm">No savings goals yet.</p>
              <Link
                href="/onboarding"
                className="text-[#5EB3FF] text-sm font-semibold hover:underline"
              >
                Set up a goal →
              </Link>
            </div>
          )}
        </div>

        {/* lower grid: left (2/3) + sidebar (1/3) */}
        <div className="grid grid-cols-3 gap-5">
          {/* ── left column ── */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* accounts */}
            <section>
              <div className="flex justify-between items-baseline mb-3 px-1">
                <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase">
                  Accounts
                </p>
                <Link
                  href="/accounts"
                  className="text-[#5EB3FF] text-[13px] font-semibold hover:underline"
                >
                  Manage
                </Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-3 gap-3.5">
                  {[0, 1, 2].map((k) => (
                    <div
                      key={k}
                      className="bg-[#16213E] rounded-[20px] h-32 animate-pulse"
                    />
                  ))}
                </div>
              ) : accounts.length > 0 ? (
                <div
                  className={`grid gap-3.5 ${
                    accounts.length === 1
                      ? "grid-cols-1 max-w-xs"
                      : accounts.length === 2
                        ? "grid-cols-2"
                        : "grid-cols-3"
                  }`}
                >
                  {accounts.slice(0, 3).map((acc) => (
                    <div
                      key={acc.plaidAccountId}
                      className="bg-[#16213E] rounded-[20px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <p className="text-[11px] font-bold tracking-[1px] text-white/40 uppercase truncate">
                        {acc.institutionName}
                      </p>
                      <p className="text-[13px] text-white/60 mt-1 truncate">
                        {acc.accountName}
                      </p>
                      <p
                        className={`mt-4 text-[22px] font-bold tracking-[-0.5px] tabular-nums ${Number(acc.availableBalance) < 0 ? "text-white/60" : "text-white"}`}
                      >
                        {Number(acc.availableBalance) < 0 ? "−" : ""}$
                        {Math.abs(Number(acc.availableBalance)).toLocaleString(
                          "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          },
                        )}
                      </p>
                      <p
                        className={`mt-2.5 text-[10px] font-bold tracking-[1px] uppercase ${acc.isSavingsAccount ? "text-[#3ecf8e]" : "text-[#5EB3FF]"}`}
                      >
                        {acc.isSavingsAccount ? "• Savings" : "• Spending"}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#16213E] rounded-[20px] p-8 text-center">
                  <p className="text-white/40 text-sm">No linked accounts.</p>
                </div>
              )}
            </section>

            {/* recent transactions */}
            <section>
              <div className="flex justify-between items-baseline mb-3 px-1">
                <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase">
                  Recent Activity
                </p>
                <Link
                  href="/transactions"
                  className="text-[#5EB3FF] text-[13px] font-semibold hover:underline"
                >
                  See all
                </Link>
              </div>

              {loading ? (
                <div className="bg-[#16213E] rounded-[20px] p-4 flex flex-col gap-3">
                  {[0, 1, 2, 3, 4].map((k) => (
                    <div
                      key={k}
                      className="h-12 bg-white/4 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : recentTxns.length > 0 ? (
                <div className="bg-[#16213E] rounded-[20px] p-4">
                  {recentTxns.map((txn, i) => {
                    // Plaid: positive amount = money leaving (expense), negative = money entering (income)
                    const isIncome = Number(txn.amount) < 0;
                    const displayAmt = Math.abs(Number(txn.amount));
                    const account = matchAccount(txn.accountId, accounts);
                    const TransactionIcon = txnIcon(
                      txn.category,
                      txn.transactionCategory,
                    );
                    return (
                      <div
                        key={txn.id}
                        className={`flex items-center gap-3.5 py-3 ${i < recentTxns.length - 1 ? "border-b border-white/6" : ""}`}
                      >
                        {/* merchant logo or category icon */}
                        <div className="w-10 h-10 rounded-[13px] bg-[#5EB3FF]/10 flex items-center justify-center text-[#5EB3FF] shrink-0 overflow-hidden">
                          {txn.logoUrl ? (
                            <img
                              src={txn.logoUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <TransactionIcon className="h-5 w-5" />
                          )}
                        </div>

                        {/* merchant + meta */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-semibold truncate">
                            {txn.merchantName ? toTitleCase(txn.merchantName) : "Unknown"}
                          </p>
                          <p className="text-[12px] text-white/40 mt-0.5">
                            {txnLabel(txn.category, txn.transactionCategory)}
                            {account ? ` · ${account.accountName}` : ""}
                            {" · "}
                            {txnDateLabel(txn.date)}
                          </p>
                        </div>

                        {/* amount — green for income, neutral for expense */}
                        <p
                          className={`text-[15px] font-bold tabular-nums shrink-0 ${isIncome ? "text-[#3ecf8e]" : "text-white"}`}
                        >
                          {isIncome ? "+" : "−"}${displayAmt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-[#16213E] rounded-[20px] p-8 text-center">
                  <p className="text-white/40 text-sm">
                    No recent transactions.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* ── right sidebar ── */}
          <div className="flex flex-col gap-5">
            {/* upcoming bills */}
            <section>
              <div className="flex justify-between items-baseline mb-3 px-1">
                <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase">
                  Bills
                </p>
                <Link
                  href="/bills"
                  className="text-[#5EB3FF] text-[13px] font-semibold hover:underline"
                >
                  Manage
                </Link>
              </div>

              {loading ? (
                <div className="bg-[#16213E] rounded-[20px] p-2 flex flex-col gap-1">
                  {[0, 1, 2].map((k) => (
                    <div
                      key={k}
                      className="h-15 bg-white/4 rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : upcomingBills.length > 0 ? (
                <div className="bg-[#16213E] rounded-[20px] p-2">
                  {upcomingBills.map((bill, i) => {
                    const days = daysUntil(bill.dueDate);
                    const overdue = days < 0;
                    const BillIcon = billIcon(bill.billName);
                    return (
                      <div
                        key={bill.id}
                        className={`flex items-center gap-3 px-3 py-3.5 ${i < upcomingBills.length - 1 || upcomingBills.length < 3 ? "border-b border-white/6" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0 ${overdue ? "bg-[#F97316]/10 text-[#F97316]" : "bg-[#5EB3FF]/10 text-[#5EB3FF]"}`}>
                          <BillIcon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[14px] font-semibold truncate">
                              {toTitleCase(bill.billName)}
                            </p>
                            {overdue && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-[#F97316]/12 text-[#F97316] text-[10px] font-bold tracking-wide uppercase">
                                Overdue
                              </span>
                            )}
                          </div>
                          <p className={`text-[11px] mt-0.5 ${overdue ? "text-[#F97316]/60" : "text-white/40"}`}>
                            {overdue
                              ? `Due ${shortDate(bill.dueDate)} · ${Math.abs(days)}d ago`
                              : `${shortDate(bill.dueDate)}${days <= 31 ? ` · ${days}d` : ""}`}
                          </p>
                        </div>
                        <p className={`text-[14px] font-bold tabular-nums shrink-0 ${overdue ? "text-[#F97316]" : "text-white/60"}`}>
                          ${(Number(bill.amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                  {upcomingBills.length < 3 && (
                    <p className="px-3 py-3.5 text-[12px] text-white/25 text-center">
                      No more upcoming bills this month
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-[#16213E] rounded-[20px] p-6 text-center">
                  <p className="text-white/40 text-sm">No upcoming bills.</p>
                </div>
              )}
            </section>

            {/* insights from availableAfterAmount / availableAfterDate */}
            {!loading && saveToSpend.availableAfterAmount != null && (
              <section>
                <p className="text-[11px] font-bold tracking-[1.6px] text-white/40 uppercase mb-3 px-1">
                  Insights
                </p>
                <div className="bg-[#16213E] rounded-[20px] p-4 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#5EB3FF]/14 flex items-center justify-center text-[#5EB3FF] shrink-0 mt-0.5">
                    <Check className="h-4 w-4" />
                  </div>
                  <p className="text-[13px] font-medium leading-[1.45]">
                    You&apos;ll have an additional{" "}
                    <span className="text-white font-bold">
                      $
                      {(
                        Number(saveToSpend.availableAfterAmount) || 0
                      ).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>{" "}
                    available
                    {saveToSpend.availableAfterDate
                      ? ` after ${shortDate(saveToSpend.availableAfterDate)}`
                      : " soon"}
                    .
                  </p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
