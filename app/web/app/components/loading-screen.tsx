"use client";
import { useEffect } from "react";
import { toast } from "sonner";

export default function LoadingScreen() {
  useEffect(() => {
    const timer = setTimeout(() => {
      toast("Taking longer than expected", {
        description: "Try refreshing the page if this persists.",
        action: { label: "Refresh", onClick: () => window.location.reload() },
        duration: Infinity,
      });
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#111125] flex flex-col items-center justify-center gap-8">
      {/* wordmark */}
      <div className="flex items-center gap-2.5 font-extrabold text-[20px] tracking-[-0.3px] text-white select-none">
        <div className="w-8 h-8 rounded-lg bg-[#5EB3FF] flex items-center justify-center font-black text-[#1A1A2E] text-[18px]">
          C
        </div>
        Current
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-[3px] border-[#5EB3FF]/20 border-t-[#5EB3FF] animate-spin" />
        <p className="text-white/50 text-xl font-semibold tracking-wide">Loading…</p>
      </div>
    </div>
  );
}
