"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const DOCS = [
  { label: "Privacy Policy", file: "/legal/current_privacy_policy.pdf" },
  { label: "Terms & Conditions", file: "/legal/current_terms_and_conditions.pdf" },
];

export default function LegalPage() {
  const [active, setActive] = useState(0);
  const router = useRouter();

  return (
    <div className="flex flex-col h-screen bg-[#080d1a] text-white">
      {/* header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/8 shrink-0">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <div className="w-7 h-7 rounded-md bg-[#5EB3FF] flex items-center justify-center font-bold text-[#1A1A2E] text-base">
            C
          </div>
          <span className="font-semibold">Current</span>
          <span className="text-white/20 text-sm mx-1">·</span>
          <span className="text-white/40 text-sm">Legal</span>
        </div>

        {/* tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
          {DOCS.map((doc, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active === i
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              {doc.label}
            </button>
          ))}
        </div>

        <a
          href={DOCS[active].file}
          download
          className="text-xs text-[#5EB3FF] hover:text-[#5EB3FF]/70 transition-colors"
        >
          Download PDF ↓
        </a>
      </div>

      {/* PDF viewer */}
      <iframe
        key={active}
        src={DOCS[active].file}
        className="flex-1 w-full"
        title={DOCS[active].label}
      />
    </div>
  );
}
