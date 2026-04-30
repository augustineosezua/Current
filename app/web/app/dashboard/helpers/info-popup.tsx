import { X } from "lucide-react";

type Breakdown = {
  checkingBalance: number;
  billsTotal: number;
  scheduledSavings: number;
  safeToSpend: number;
};

type InfoPopupProps = {
  props: { exit: () => void };
  breakdown: Breakdown;
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Row({
  label,
  amount,
  sign,
}: {
  label: string;
  amount: number;
  sign: "+" | "-";
}) {
  const positive = sign === "+";
  return (
    <div className="flex items-center justify-between py-4 border-b border-white/6 last:border-0">
      <p className="text-[15px] text-white/70">{label}</p>
      <p className={`text-[15px] font-semibold tabular-nums ${positive ? "text-[#3ecf8e]" : "text-white/80"}`}>
        {sign}${fmt(amount)}
      </p>
    </div>
  );
}

export default function InfoPopup({ props, breakdown }: InfoPopupProps) {
  // whatever the STS didn't account for with bills + savings is the actual buffer deducted
  const impliedBuffer = Math.round(
    (breakdown.checkingBalance - breakdown.billsTotal - breakdown.scheduledSavings - breakdown.safeToSpend)
    * 100
  ) / 100;

  return (
    <div className="absolute inset-0 flex items-center justify-center px-4">
      <div
        className="relative w-full max-w-md rounded-[28px] p-8"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#16213E",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {/* header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold tracking-[2px] text-white/35 uppercase mb-1.5">
              How it&apos;s calculated
            </p>
            <h2 className="text-[21px] font-extrabold tracking-[-0.5px] text-white">
              Safe to Spend
            </h2>
          </div>
          <button
            type="button"
            onClick={props.exit}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ledger rows */}
        <div className="mb-5">
          <Row label="Current Balance" amount={breakdown.checkingBalance} sign="+" />
          <Row label="Overdue & Upcoming Bills" amount={breakdown.billsTotal} sign="-" />
          <Row label="Scheduled Savings" amount={breakdown.scheduledSavings} sign="-" />
          {impliedBuffer > 0 && (
            <Row label="Monthly Buffer" amount={impliedBuffer} sign="-" />
          )}
        </div>

        {/* result */}
        <div className="flex items-center justify-between rounded-2xl bg-[#5EB3FF]/8 border border-[#5EB3FF]/14 px-6 py-5">
          <p className="text-[11px] font-bold tracking-[2px] text-[#5EB3FF] uppercase">
            Safe to Spend
          </p>
          <p className="text-[28px] font-extrabold tracking-[-0.5px] tabular-nums text-[#5EB3FF]">
            ${fmt(breakdown.safeToSpend)}
          </p>
        </div>
      </div>
    </div>
  );
}
