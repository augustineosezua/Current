"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "../lib/auth-client";
import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ActivePage = "home" | "transactions" | "bills" | "savings" | "settings";

interface AppHeaderProps {
  activePage: ActivePage;
}

const NAV_ITEMS: { label: string; href: string; page: ActivePage }[] = [
  { label: "Home", href: "/dashboard", page: "home" },
  { label: "Transactions", href: "/transactions", page: "transactions" },
  { label: "Bills", href: "/bills", page: "bills" },
  { label: "Savings", href: "/savings", page: "savings" },
  { label: "Settings", href: "/settings", page: "settings" },
];

export default function AppHeader({ activePage }: AppHeaderProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstName = session?.user.name?.split(" ")[0] ?? "";

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    router.push("/login");
  }

  return (
    <header className="sticky top-0 z-40 h-18 px-10 flex items-center gap-10 border-b border-white/6 bg-[#111125]/90 backdrop-blur-md">
      {/* logo */}
      <div className="flex items-center gap-2.5 font-extrabold text-[18px] tracking-[-0.3px]">
        <div className="w-7 h-7 rounded-lg bg-[#5EB3FF] flex items-center justify-center font-black text-[#1A1A2E] text-[16px]">
          C
        </div>
        Current
      </div>

      {/* nav */}
      <nav className="flex gap-1 flex-1">
        {NAV_ITEMS.map(({ label, href, page }) =>
          activePage === page ? (
            <span
              key={page}
              className="px-4 py-2 rounded-full bg-[#5EB3FF]/12 text-[#5EB3FF] font-semibold text-sm cursor-default"
            >
              {label}
            </span>
          ) : (
            <Link
              key={page}
              href={href}
              className="px-4 py-2 rounded-full text-white/50 font-semibold text-sm hover:text-white/80 transition-colors"
            >
              {label}
            </Link>
          )
        )}
      </nav>

      {/* user pill with dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white/4 rounded-full hover:bg-white/8 transition-colors select-none hover:cursor-pointer"
        >
          <div className="w-6 h-6 rounded-full bg-linear-to-br from-[#5EB3FF] to-[#16213E] flex items-center justify-center text-[11px] font-bold">
            {firstName ? (
              firstName.charAt(0).toUpperCase()
            ) : (
              <User className="h-3.5 w-3.5" />
            )}
          </div>
          {firstName && (
            <span className="text-[13px] font-semibold">{firstName}</span>
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-44 bg-[#16213E] rounded-2xl border border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden z-50">
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="h-px bg-white/6 mx-2" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-[13px] font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
