"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface IntroContentProps {
  setIntroCompleted: (val: boolean) => void;
  setOnboardingStep: (step: string) => void;
}

const slides = [
  {
    label: "SOUND FAMILIAR",
    heading: "You check your balance. Still not sure.",
    body: "Having money in your account doesn't mean it's yours to spend. Current gives you the one number that actually answers the question.",
  },
  {
    label: "YOUR SAFE-TO-SPEND",
    heading: "One number. No math required.",
    body: "Current looks at your balance, upcoming bills, and savings goal — then tells you exactly what's left to spend.",
  },
  {
    label: "YOUR DATA, PROTECTED",
    heading: "Your bank stays yours.",
    body: "We connect read-only through Plaid, the same service used by TD and RBC. We can see your transactions. We can never touch your money.",
  },
];

const steps = ["Welcome", "Bank", "Accounts", "Setup", "Done"];

export function IntroContent({
  setIntroCompleted,
  setOnboardingStep,
}: IntroContentProps) {
  const [slide, setSlide] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleContinue = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      setIntroCompleted(true);
      setOnboardingStep("connect");
    }
  };

  const handleSkip = () => {
    setIntroCompleted(true);
    setOnboardingStep("connect");
  };

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const dx = (e.clientX - left - width / 2) / (width / 2);
    const dy = (e.clientY - top - height / 2) / (height / 2);
    setTilt({ x: dy * -10, y: dx * 10 });
  };

  const handleCardMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovering(false);
  };

  const current = slides[slide];

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {/* left panel */}
      <div className="w-[42%] flex flex-col border-r border-white/5">
        {/* logo */}
        <div
          className="flex items-center px-8 pt-1"
        >
          <div className="flex items-center gap-2 py-4 hover:cursor-pointer"  onClick={() => router.push("/")}>
            <div className="w-8 h-8 rounded-md bg-[#5EB3FF] flex items-center justify-center font-bold text-[#080d1a] text-lg">
              C
            </div>
            <span className="font-semibold text-xl">Current</span>
          </div>
        </div>

        {/* STS mockup card */}
        <div className="flex-1 flex items-center justify-center px-8">
          <div className="relative">
            {/* ambient glow */}
            <div className="absolute -inset-8 rounded-full bg-[#5EB3FF]/10 blur-3xl pointer-events-none" />

            {/* tilt wrapper — inline style required: values computed from live mouse position */}
            <div
              ref={cardRef}
              onMouseMove={handleCardMouseMove}
              onMouseEnter={() => setHovering(true)}
              onMouseLeave={handleCardMouseLeave}
              style={{
                transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovering ? 1.03 : 1})`,
                transition: hovering
                  ? "transform 0.08s ease-out"
                  : "transform 0.55s ease-out",
                willChange: "transform",
              }}
              className="relative bg-[#16213E] rounded-[20px] p-6 w-72 flex flex-col gap-4 cursor-default"
            >
              {/* specular glare — inline style required: position tracks mouse */}
              <div
                className="absolute inset-0 rounded-[20px] pointer-events-none overflow-hidden"
                style={{
                  background: `radial-gradient(circle at ${50 + tilt.y * 3}% ${50 - tilt.x * 3}%, rgba(94,179,255,0.09) 0%, transparent 65%)`,
                  opacity: hovering ? 1 : 0,
                  transition: "opacity 0.3s",
                }}
              />

              {/* STS number */}
              <div>
                <p className="text-white/35 text-[10px] font-bold tracking-[0.2em] uppercase mb-2">
                  Safe to spend
                </p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-[#5EB3FF] text-6xl font-bold leading-none">
                    $284
                  </span>
                  <span className="text-[#5EB3FF]/45 text-4xl font-bold leading-none">
                    .50
                  </span>
                </div>
              </div>

              <div className="h-px bg-white/8" />

              {/* breakdown rows */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5EB3FF]" />
                    <span className="text-white/55 text-xs">Total balance</span>
                  </div>
                  <span className="text-white text-xs font-medium">+$1,450.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#3ecf8e]" />
                    <span className="text-white/55 text-xs">Expected income</span>
                  </div>
                  <span className="text-[#3ecf8e] text-xs font-medium">+$600.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#5EB3FF]/50" />
                    <span className="text-white/55 text-xs">Upcoming bills</span>
                  </div>
                  <span className="text-white/70 text-xs font-medium">-$380.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F5C400]" />
                    <span className="text-white/55 text-xs">Savings goal</span>
                  </div>
                  <span className="text-[#F5C400] text-xs font-medium">-$200.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span className="text-white/55 text-xs">Already spent</span>
                  </div>
                  <span className="text-white/45 text-xs font-medium">-$185.50</span>
                </div>
              </div>

              <div className="h-px bg-white/8" />

              {/* recent transactions */}
              <div className="flex flex-col gap-3">
                <p className="text-white/35 text-[10px] font-bold tracking-[0.2em] uppercase">
                  Recent
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1A1A2E] flex items-center justify-center text-[10px] font-bold text-[#5EB3FF]">
                      TH
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium leading-none mb-0.5">
                        Tim Hortons
                      </p>
                      <p className="text-white/35 text-[10px]">Today, 8:42am</p>
                    </div>
                  </div>
                  <span className="text-white/60 text-xs">-$3.25</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1A1A2E] flex items-center justify-center text-[10px] font-bold text-[#5EB3FF]">
                      NF
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium leading-none mb-0.5">
                        No Frills
                      </p>
                      <p className="text-white/35 text-[10px]">Yesterday</p>
                    </div>
                  </div>
                  <span className="text-white/60 text-xs">-$47.80</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#1A1A2E] flex items-center justify-center text-[10px] font-bold text-[#3ecf8e]">
                      TD
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium leading-none mb-0.5">
                        Paycheck
                      </p>
                      <p className="text-white/35 text-[10px]">Apr 26</p>
                    </div>
                  </div>
                  <span className="text-[#3ecf8e] text-xs font-medium">+$1,200.00</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="px-8 py-4 text-xs text-white/25">
          © Current · Secured by Plaid · Read-only access
        </div>
      </div>

      {/* right panel */}
      <div className="w-[58%] flex flex-col border-l border-white/5">
        {/* top nav */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
          <div className="flex items-center gap-1 text-xs text-white/40">
            {steps.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    i === 0
                      ? "bg-[#5EB3FF] text-[#080d1a]"
                      : "border border-white/20 text-white/30"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={i === 0 ? "text-white font-medium" : ""}>
                  {name}
                </span>
                {i < steps.length - 1 && (
                  <span className="mx-1 tracking-widest text-white/20">··</span>
                )}
              </div>
            ))}
          </div>

            {/* help button */}
          <button className="text-xs text-white/50 hover:text-white transition-colors text-right leading-tight">
            Need help?
          </button>
        </div>

        {/* slide content */}
        <div className="flex-1 flex flex-col justify-center px-16 max-w-xl">
          <p className="text-[#5EB3FF] text-xs font-bold tracking-[0.2em] uppercase mb-5">
            {current.label}
          </p>
          <h1 className="text-4xl font-bold leading-tight mb-5">
            {current.heading}
          </h1>
          <p className="text-white/55 text-sm leading-relaxed mb-8">
            {current.body}
          </p>

          {/* progress dots */}
          <div className="flex items-center gap-1.5 mb-8">
            {slides.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === slide ? "w-6 bg-[#5EB3FF]" : "w-1.5 bg-white/25"
                }`}
              />
            ))}
          </div>

          {/* actions */}
          <div className="flex items-center gap-6">
            <button
              onClick={handleContinue}
              className="px-6 py-2.5 bg-[#5EB3FF] text-[#080d1a] font-semibold rounded-full text-sm hover:brightness-110 transition-all"
            >
              Continue →
            </button>
            <button
              onClick={handleSkip}
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Skip intro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
