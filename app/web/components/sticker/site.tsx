// The web pages' shell in the mobile app's Sticker Book look (app/mobile/DESIGN.md): warm paper, Fredoka and
// Nunito, soft-ledge cards. Colours come from the .sticker-site tokens in app/globals.css.
import { Fredoka, Nunito } from "next/font/google";
import Link from "next/link";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["500", "600", "800"], variable: "--font-nunito", display: "swap" });

export const SUPPORT_EMAIL = "support@aosezua.dev";
export const APP_STORE_URL = "https://apps.apple.com/app/id6836023975";

// the app icon, swapped for the dark one in dark mode
export function AppIcon({ size = 44 }: { size?: number }) {
  return (
    <picture>
      <source srcSet="/app-icon-dark.png" media="(prefers-color-scheme: dark)" />
      <img
        src="/app-icon.png"
        alt=""
        width={size}
        height={size}
        className="rounded-[22%]"
        style={{ boxShadow: "0 3px 0 var(--st-ledge), 0 12px 32px var(--st-glow)" }}
      />
    </picture>
  );
}

// an emoji on a die-cut sticker; decorative, so screen readers skip it
export function Sticker({
  emoji,
  fill,
  size = 44,
  tilt = 0,
}: {
  emoji: string;
  fill: string;
  size?: number;
  tilt?: number;
}) {
  return (
    <span
      aria-hidden
      className="st-sticker shrink-0"
      style={{
        width: size,
        height: size,
        background: `var(${fill})`,
        transform: `rotate(${tilt}deg)`,
        fontSize: size * 0.48,
      }}
    >
      {emoji}
    </span>
  );
}

export function StickerSite({ children }: { children: React.ReactNode }) {
  return (
    <div className={`sticker-site ${fredoka.variable} ${nunito.variable} flex min-h-screen flex-col`}>
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pt-6">
        <Link href="/" className="flex items-center gap-3">
          <AppIcon size={36} />
          <span className="st-display text-xl">Current</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm font-semibold">
          <Link href="/support" className="rounded-full px-3 py-2 hover:bg-[var(--st-field)]">
            Support
          </Link>
          <Link href="/legal" className="rounded-full px-3 py-2 hover:bg-[var(--st-field)]">
            Legal
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-10">{children}</main>

      <footer className="mx-auto w-full max-w-3xl px-5 pb-8 text-sm text-[var(--st-muted)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>Made in Ontario, Canada</span>
          <Link href="/support" className="underline-offset-4 hover:underline">
            Support
          </Link>
          <Link href="/legal?tab=privacy" className="underline-offset-4 hover:underline">
            Privacy
          </Link>
          <Link href="/legal?tab=terms" className="underline-offset-4 hover:underline">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
