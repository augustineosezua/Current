"use client";

interface ErrorDashboardProps {
  onRetry?: () => void;
}

export default function ErrorDashboard({ onRetry }: ErrorDashboardProps) {
  return (
    <div className="min-h-screen bg-[#111125] flex items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center px-6">
        <div className="w-12 h-12 rounded-full bg-white/6 flex items-center justify-center text-xl text-white/40">
          !
        </div>
        <h2 className="text-xl font-bold tracking-tight">Something went wrong</h2>
        <p className="text-white/40 text-sm leading-relaxed">
          We couldn&apos;t load your dashboard. Check your connection and try again.
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-6 py-3 bg-[#5EB3FF] text-[#1A1A2E] font-bold rounded-full text-sm hover:brightness-110 transition-all"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
