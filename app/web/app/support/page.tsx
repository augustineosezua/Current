import type { Metadata } from "next";
import Link from "next/link";

import { AppIcon, StickerSite, Sticker, SUPPORT_EMAIL } from "@/components/sticker/site";

export const metadata: Metadata = {
  title: "Support · Current",
  description: "Help with Current, the student budget app for iPhone: Plus, purchases, your data and AI features.",
};

type Faq = { q: string; a: React.ReactNode };

const sections: { title: string; emoji: string; fill: string; items: Faq[] }[] = [
  {
    title: "Your money and your data",
    emoji: "🔒",
    fill: "--st-mint",
    items: [
      {
        q: "Where's my budget stored?",
        a: "On your iPhone. There's no account and no bank login, so we never have a copy. It's included in your iPhone's iCloud backup like the rest of your apps.",
      },
      {
        q: "I got a new phone. How do I bring my budget over?",
        a: "Set up the new iPhone from an iCloud or computer backup of your old one and Current comes back with everything in it. You can also export a CSV from the old phone first (Settings, then Export CSV) to keep your own copy.",
      },
      {
        q: "How do I delete my data?",
        a: "Delete the app. That removes your budget from the phone. Older iPhone backups you've already made keep their copy until they're replaced.",
      },
      {
        q: "Can I bring in transactions from my bank?",
        a: "With Plus, yes. Download a CSV or OFX file from your bank's website, then go to Settings, then Import from your bank. Anything already in Current is skipped.",
      },
    ],
  },
  {
    title: "Current Plus",
    emoji: "✨",
    fill: "--st-peach",
    items: [
      {
        q: "How do I cancel or change my plan?",
        a: (
          <>
            Plus is billed by Apple. In Current, go to Settings, then Manage subscription. Or on your iPhone open
            Settings, tap your name, then Subscriptions. Cancel at least a day before it renews and you keep Plus until
            the end of what you&apos;ve paid for.
          </>
        ),
      },
      {
        q: "I paid but Plus isn't on.",
        a: "Go to Settings in Current and tap Restore purchases. Make sure you're signed in to the same Apple Account you bought it with.",
      },
      {
        q: "How do I get a refund?",
        a: (
          <>
            Apple handles refunds, so we can&apos;t issue them ourselves. Request one at{" "}
            <a href="https://reportaproblem.apple.com" className="font-extrabold underline underline-offset-4">
              reportaproblem.apple.com
            </a>
            .
          </>
        ),
      },
    ],
  },
  {
    title: "AI features",
    emoji: "🤖",
    fill: "--st-lilac",
    items: [
      {
        q: "Why does it say I need Apple Intelligence?",
        a: "Quick add, Can I afford this?, Ask Current and the written weekly recap run on Apple's on-device model. They need an iPhone that supports Apple Intelligence, with it turned on in Settings. Everything else in Current works on any iPhone.",
      },
      {
        q: "Does what I type get sent anywhere?",
        a: "No. The AI runs on your phone, and nothing you ask leaves it.",
      },
    ],
  },
  {
    title: "Your daily number",
    emoji: "💸",
    fill: "--st-butter",
    items: [
      {
        q: "How is the daily number worked out?",
        a: "We take your balance, set aside bills due before your next payday (or the end of your budget period), money for your goals and the part of your semester money meant for later weeks, then split what's left over the days you have. Open “How we got this number” on Home to see each step.",
      },
      {
        q: "The number looks wrong.",
        a: "Most of the time the balance in Current is out of date. Check it against your bank app and update it from Home. If it still looks off, email us with what you expected and what you see.",
      },
    ],
  },
];

export default function SupportPage() {
  return (
    <StickerSite>
      <section className="flex flex-col items-start gap-5">
        <AppIcon size={72} />
        <h1 className="st-display text-4xl sm:text-5xl">How can we help?</h1>
        <p className="max-w-xl text-lg text-[var(--st-muted)]">
          Answers for Current on iPhone. Can&apos;t find yours? Email us and a real person gets back to you, usually
          within two days.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Current%20support`} className="st-button rounded-full px-6 py-3 font-extrabold">
          Email {SUPPORT_EMAIL}
        </a>
      </section>

      <div className="mt-12 flex flex-col gap-10">
        {sections.map((section) => (
          <section key={section.title} aria-labelledby={`h-${section.emoji}`}>
            <div className="mb-4 flex items-center gap-3">
              <Sticker emoji={section.emoji} fill={section.fill} size={40} tilt={-4} />
              <h2 id={`h-${section.emoji}`} className="st-display text-2xl">
                {section.title}
              </h2>
            </div>
            <div className="st-raised overflow-hidden rounded-[20px]">
              {section.items.map((item, i) => (
                <details
                  key={item.q}
                  className={`group px-5 py-4 ${i > 0 ? "border-t border-[var(--st-field)]" : ""}`}
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      aria-hidden
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--st-field)] transition-transform group-open:rotate-45 motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-[var(--st-muted)]">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="st-raised mt-12 flex flex-col gap-2 rounded-[20px] p-6">
        <h2 className="st-display text-2xl">Still stuck?</h2>
        <p className="text-[var(--st-muted)]">
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Current%20support`} className="font-extrabold text-[var(--st-ink)] underline underline-offset-4">
            {SUPPORT_EMAIL}
          </a>{" "}
          with your iPhone model and what happened. Please don&apos;t send screenshots of bank statements or account
          numbers; we never need them. Our{" "}
          <Link href="/legal?tab=privacy" className="font-extrabold text-[var(--st-ink)] underline underline-offset-4">
            privacy policy
          </Link>{" "}
          covers what we do with support emails.
        </p>
      </section>
    </StickerSite>
  );
}
