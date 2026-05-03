'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import localFont from 'next/font/local';

const jakarta = localFont({
  src: './fonts/plus-jakarta-sans-latin.woff2',
  variable: '--font-jakarta',
  display: 'swap',
  weight: '400 800',
});

const grotesk = localFont({
  src: './fonts/space-grotesk-latin.woff2',
  variable: '--font-grotesk',
  display: 'swap',
  weight: '400 700',
});

function useFadeIn(initialVisible = false) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(initialVisible);

  useEffect(() => {
    if (!element) return;

    const revealIfInView = () => {
      const rect = element.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setIsVisible(true);
        return true;
      }
      return false;
    };

    const frame = window.requestAnimationFrame(revealIfInView);
    window.addEventListener('pageshow', revealIfInView);

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          io.unobserve(element);
        }
      },
      { threshold: 0.08 }
    );

    io.observe(element);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('pageshow', revealIfInView);
      io.disconnect();
    };
  }, [element]);

  return [setElement, isVisible] as const;
}

function fade(visible: boolean, delay?: string) {
  return `transition-transform duration-700 ease-out${delay ? ` ${delay}` : ''} ${
    visible ? 'translate-y-0' : 'translate-y-5'
  }`;
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);

  function handleLogoClick() {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.location.assign('/');
  }

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.documentElement.style.scrollBehavior = '';
    };
  }, []);

  const [setHeroElement, heroVisible] = useFadeIn(true);
  const [setProblemElement, problemVisible] = useFadeIn();
  const [setHowElement, howVisible] = useFadeIn();
  const [setFeaturesElement, featuresVisible] = useFadeIn();
  const [setTrustElement, trustVisible] = useFadeIn();
  const [setCtaElement, ctaVisible] = useFadeIn();

  return (
    <div
      className={`${jakarta.variable} ${grotesk.variable} min-h-screen bg-[#07090F] [font-family:var(--font-jakarta)] text-white antialiased`}
    >

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-white/5 bg-[#07090F]/80 backdrop-blur-xl'
            : ''
        }`}
      >
        <div className="mx-auto flex h-16 max-w-280 items-center justify-between px-6 md:px-12">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex hover:cursor-pointer items-center gap-2.5 text-[18px] font-extrabold tracking-[-0.3px] text-white transition-colors hover:text-white/80"
            aria-label="Refresh Current homepage and return to top"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5EB3FF] text-[16px] font-black text-[#1A1A2E]">
              C
            </span>
            <span>Current</span>
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="#how-it-works"
              className="hidden px-3 py-2 text-sm text-white/50 transition-colors hover:text-white md:block"
            >
              How it works
            </Link>
            <Link
              href="/login"
              className="hidden h-9 items-center rounded-full border border-white/15 px-4 text-sm text-white transition-colors hover:border-white/30 md:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-9 items-center rounded-full bg-[#4B9FFF] px-5 text-sm font-semibold text-[#07090F] transition-colors hover:bg-[#6ab3ff]"
            >
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        ref={setHeroElement}
        className={`relative overflow-hidden flex min-h-screen items-center pt-16 ${fade(heroVisible, 'delay-150')}`}
      >
        {/* ambient blue glow */}
        <div className="pointer-events-none absolute -top-32 right-0 h-175 w-175 rounded-full bg-[#4B9FFF]/6 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 h-175 w-175 rounded-full bg-[#4B9FFF]/4 blur-[100px]" />
        <div className="mx-auto w-full max-w-280 px-6 py-24 md:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

            {/* Left: copy */}
            <div className="flex flex-col gap-6">
              <span className="self-start rounded-xl border border-[#4B9FFF]/30 px-3 py-1.5 text-xs font-medium tracking-[0.07em] text-[#4B9FFF]">
                Now in beta · Canada only
              </span>

              <h1 className="text-[clamp(36px,5vw,56px)] font-bold leading-[1.1] tracking-[-0.04em] text-white">
                Know exactly what you can spend.
              </h1>

              <p className="text-lg leading-[1.65] text-white/50">
                Current connects to your Canadian bank and gives you one number — how much you can safely spend today without touching your savings or missing a bill.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href="/signup"
                  className="inline-flex h-14 items-center justify-center rounded-full bg-[#4B9FFF] px-8 text-base font-semibold text-[#07090F] transition-colors hover:bg-[#6ab3ff]"
                >
                  Get started free
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex items-center justify-center h-14 px-6 text-[#4B9FFF] text-base hover:text-[#6ab3ff] transition-colors"
                >
                  See how it works →
                </Link>
              </div>

              <p className="text-xs text-white/30">
                No credit card. Works with TD, RBC, Scotiabank, BMO, CIBC, and more.
              </p>
            </div>

            {/* Right: STS card */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-90 rounded-3xl border border-[#4B9FFF]/25 bg-[#111722] p-8 shadow-[0_0_80px_rgba(75,159,255,0.18)]">

                <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-white/50">
                  Safe to spend
                </p>

                <div className="flex items-end mb-2">
                  <span className="[font-family:var(--font-grotesk)] text-[clamp(64px,12vw,88px)] font-bold leading-none text-[#4B9FFF]">
                    $284
                  </span>
                  <span className="mb-1 [font-family:var(--font-grotesk)] text-[clamp(40px,7vw,56px)] font-bold leading-none text-[#4B9FFF]/30">
                    .50
                  </span>
                </div>

                <p className="mb-6 text-sm text-white/50">Until May 16</p>

                <div className="mb-5 h-px bg-white/10" />

                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4B9FFF]" />
                      <span className="text-[13px] text-white/45">Total balance</span>
                    </div>
                    <span className="[font-family:var(--font-grotesk)] text-[13px] text-white/45">
                      +$1,450.00
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2DD4A0]" />
                      <span className="text-[13px] text-white/45">Expected income</span>
                    </div>
                    <span className="[font-family:var(--font-grotesk)] text-[13px] text-white/45">
                      +$336.00
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#F97316]" />
                      <span className="text-[13px] text-white/45">Upcoming bills</span>
                    </div>
                    <span className="[font-family:var(--font-grotesk)] text-[13px] text-white/45">
                      −$905.99
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#2DD4A0]" />
                      <span className="text-[13px] text-white/45">Savings goal</span>
                    </div>
                    <span className="[font-family:var(--font-grotesk)] text-[13px] text-white/45">
                      −$200.00
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Problem ─────────────────────────────────────────────────────── */}
      <section
        ref={setProblemElement}
        className={`bg-[#0C1018] py-24 ${fade(problemVisible)}`}
      >
        <div className="mx-auto max-w-180 px-6 text-center md:px-12">
          <p className="mb-5 text-xs uppercase tracking-[0.14em] text-[#4B9FFF]">
            The problem with money apps
          </p>
          <h2 className="text-[clamp(26px,4vw,44px)] font-bold tracking-[-0.03em] text-white leading-[1.15] mb-8">
            Most apps show you everything except what actually matters.
          </h2>
          <p className="mb-5 text-base leading-[1.7] text-white/50">
            Dashboards, graphs, category breakdowns, net worth calculators. You open the app, see a wall of numbers, and still leave not knowing if you can afford dinner.
          </p>
          <p className="text-base leading-[1.7] text-white/50">
            Current strips that away. One number. Recalculated in real time. Built around how students and young adults actually live.
          </p>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        ref={setHowElement}
        className={`py-24 bg-[#07090F] ${fade(howVisible)}`}
      >
        <div className="mx-auto max-w-280 px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="mb-5 text-xs uppercase tracking-[0.14em] text-[#4B9FFF]">
              How it works
            </p>
            <h2 className="text-[clamp(26px,4vw,44px)] font-bold tracking-[-0.03em] text-white leading-[1.15]">
              Up and running in three steps.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111722] p-8">
              <span className="pointer-events-none absolute top-5 left-7 select-none [font-family:var(--font-grotesk)] text-[56px] font-bold leading-none text-[#4B9FFF]/15">
                01
              </span>
              <div className="relative pt-16">
                <h3 className="text-[17px] font-semibold text-white mb-3">Link your bank</h3>
                <p className="text-sm leading-[1.65] text-white/50">
                  Connect securely through Plaid. Your credentials never touch our servers. Works with every major Canadian bank.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111722] p-8">
              <span className="pointer-events-none absolute top-5 left-7 select-none [font-family:var(--font-grotesk)] text-[56px] font-bold leading-none text-[#4B9FFF]/15">
                02
              </span>
              <div className="relative pt-16">
                <h3 className="text-[17px] font-semibold text-white mb-3">Set your savings goal</h3>
                <p className="text-sm leading-[1.65] text-white/50">
                  Tell Current what you want to save each period. That amount is protected before your Safe-To-Spend is ever calculated.
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111722] p-8">
              <span className="pointer-events-none absolute top-5 left-7 select-none [font-family:var(--font-grotesk)] text-[56px] font-bold leading-none text-[#4B9FFF]/15">
                03
              </span>
              <div className="relative pt-16">
                <h3 className="text-[17px] font-semibold text-white mb-3">Spend with confidence</h3>
                <p className="text-sm leading-[1.65] text-white/50">
                  Your Safe-To-Spend updates in real time as money moves. Bills coming up? Already subtracted. Paycheck incoming? Already counted.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Feature Highlights ──────────────────────────────────────────── */}
      <section
        ref={setFeaturesElement}
        className={`py-24 bg-[#0C1018] ${fade(featuresVisible)}`}
      >
        <div className="mx-auto max-w-280 px-6 md:px-12">
          <div className="text-center mb-16">
            <p className="mb-5 text-xs uppercase tracking-[0.14em] text-[#4B9FFF]">
              Built different
            </p>
            <h2 className="text-[clamp(26px,4vw,44px)] font-bold tracking-[-0.03em] text-white leading-[1.15]">
              Everything your balance can&apos;t tell you.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-3xl border border-[#4B9FFF]/20 bg-[#111722] p-8">
              <div className="mb-5 h-1.5 w-1.5 rounded-full bg-[#4B9FFF]" />
              <h3 className="text-[17px] font-semibold text-white mb-3">Safe-To-Spend</h3>
              <p className="text-sm leading-[1.65] text-white/50">
                Not a balance. Not a budget. One number that accounts for income, bills, savings, and what you&apos;ve already spent.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111722] p-8">
              <div className="mb-5 h-1.5 w-1.5 rounded-full bg-[#2DD4A0]" />
              <h3 className="text-[17px] font-semibold text-white mb-3">Savings protection</h3>
              <p className="text-sm leading-[1.65] text-white/50">
                Your savings goal is locked in before your STS is calculated. You can&apos;t accidentally spend what you&apos;re trying to save.
              </p>
            </div>

            <div className="rounded-3xl border border-[#4B9FFF]/20 bg-[#111722] p-8">
              <div className="mb-5 h-1.5 w-1.5 rounded-full bg-[#4B9FFF]" />
              <h3 className="text-[17px] font-semibold text-white mb-3">Real-time sync</h3>
              <p className="text-sm leading-[1.65] text-white/50">
                Transactions from your linked accounts update your number automatically. No manual entry required.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[#111722] p-8">
              <div className="mb-5 h-1.5 w-1.5 rounded-full bg-[#F97316]" />
              <h3 className="text-[17px] font-semibold text-white mb-3">Bill awareness</h3>
              <p className="text-sm leading-[1.65] text-white/50">
                Upcoming bills are factored in the moment they&apos;re detected. Your number is always honest about what&apos;s already spoken for.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ───────────────────────────────────────────────────────── */}
      <section
        ref={setTrustElement}
        className={`py-24 bg-[#07090F] ${fade(trustVisible)}`}
      >
        <div className="mx-auto max-w-160 px-6 text-center md:px-12">
          <h2 className="text-[clamp(26px,4vw,40px)] font-bold tracking-[-0.03em] text-white leading-[1.15] mb-6">
            Your data stays yours.
          </h2>
          <p className="mb-10 text-base leading-[1.7] text-white/50">
            Current uses Plaid, the same secure connection layer trusted by millions of Canadians. We read transactions. We never touch your money. Bank-level encryption throughout.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className="rounded-full border border-[#4B9FFF]/25 px-4 py-2 text-xs text-[#4B9FFF]/70">
              Plaid secured
            </span>
            <span className="rounded-full border border-[#4B9FFF]/25 px-4 py-2 text-xs text-[#4B9FFF]/70">
              256-bit encryption
            </span>
            <span className="rounded-full border border-[#4B9FFF]/25 px-4 py-2 text-xs text-[#4B9FFF]/70">
              Read-only access
            </span>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section
        ref={setCtaElement}
        className={`py-32 relative overflow-hidden bg-[#07090F] ${fade(ctaVisible)}`}
      >
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-125 w-175 rounded-full bg-[#4B9FFF]/9 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-280 px-6 text-center md:px-12">
          <h2 className="text-[clamp(28px,4.5vw,52px)] font-bold tracking-[-0.04em] text-white leading-[1.1] mb-5">
            Stop guessing. Start spending with clarity.
          </h2>
          <p className="mb-10 text-base text-white/50">
            Free while in beta. No credit card required. Takes about 3 minutes to set up.
          </p>
          <Link
            href="/signup"
            className="inline-flex h-14 items-center justify-center rounded-full bg-[#4B9FFF] px-10 text-base font-semibold text-[#07090F] transition-colors hover:bg-[#6ab3ff]"
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-[#07090F] py-8">
        <div className="mx-auto flex max-w-280 flex-col items-center justify-between gap-4 px-6 text-center md:flex-row md:px-12 md:text-left">
          <span className="text-sm text-white/30">
            Current · A Chicken Labs product
          </span>
          <div className="flex items-center gap-6">
            <span className="text-xs text-white/30">
              Privacy
            </span>
            <span className="text-xs text-white/30">
              Terms
            </span>
            <span className="text-xs text-white/30">
              Contact
            </span>
          </div>
          <span className="text-xs text-white/30">© 2025 Chicken Labs</span>
        </div>
      </footer>

    </div>
  );
}
