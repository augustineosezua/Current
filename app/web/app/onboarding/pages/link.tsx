"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePlaidLink } from "react-plaid-link";
import { useRouter } from "next/navigation";

interface LinkProps {
  setLinkToken: (token: string) => void;
  linkToken: string | null;
  setOnboardingStep: (step: string) => void;
  session: any;
  setPlaidUser: (user: any) => void;
}

const steps = ["Welcome", "Bank", "Accounts", "Setup", "Done"];

// Isolated so usePlaidLink is only called once, after a real token exists.
// Mounting this with token=null causes Plaid to embed its script twice.
function PlaidOpener({
  token,
  onSuccess,
}: {
  token: string;
  onSuccess: (publicToken: string) => void;
}) {
  const { open, ready } = usePlaidLink({ token, onSuccess });
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);
  return null;
}

export default function LinkPage({
  setLinkToken,
  linkToken,
  setOnboardingStep,
  setPlaidUser,
}: LinkProps) {
  const API = "http://localhost:3001/api";
  const router = useRouter();
  const [pageIsLoading, setPageIsLoading] = useState(true);
  const [isPlaidUser, setIsPlaidUser] = useState(false);
  const [plaidUserLoading, setPlaidUserLoading] = useState(true);

  const checkIsUser = async () => {
    const userDetails = await fetch(`${API}/user-details`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!userDetails.ok) {
      toast.error("Failed to fetch user details.");
      return;
    }
    const userDetailsData = await userDetails.json();
    const plaidUserData = userDetailsData.returnData;
    if (!plaidUserData) {
      setIsPlaidUser(false);
      setPlaidUserLoading(false);
      return false;
    } else {
      setPlaidUser(plaidUserData);
      setIsPlaidUser(true);
      setPlaidUserLoading(false);
      return true;
    }
  };

  const createLinkToken = async () => {
    const response = await fetch(`${API}/create-link-token`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      toast.error("Failed to create link token.");
      setPageIsLoading(false);
      return;
    }
    const data = await response.json();
    setLinkToken(data.link_token);
    setPageIsLoading(false);
  };

  useEffect(() => {
    if (plaidUserLoading) {
      checkIsUser();
    } else if (!plaidUserLoading && !isPlaidUser) {
      createLinkToken();
    } else if (!plaidUserLoading && isPlaidUser) {
      setOnboardingStep("accounts");
    }
  }, [plaidUserLoading, isPlaidUser]);

  const handleSuccess = async (publicToken: string) => {
    await fetch(`${API}/exchange-public-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ publicToken }),
    });
    setOnboardingStep("accounts");
  };

  return (
    <div className="flex h-screen w-screen bg-[#080d1a] text-white overflow-hidden">
      {linkToken && <PlaidOpener token={linkToken} onSuccess={handleSuccess} />}

      {/* left panel */}
      <div className="w-[42%] flex flex-col border-r border-white/5">
        <div
          className="flex items-center px-8 pt-1 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <div className="flex items-center gap-2 py-4">
            <div className="w-8 h-8 rounded-md bg-[#5EB3FF] flex items-center justify-center font-bold text-[#080d1a] text-lg">
              C
            </div>
            <span className="font-semibold text-xl">Current</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center relative">
          <div className="absolute w-80 h-80 rounded-full bg-[#5EB3FF]/8 blur-[80px] pointer-events-none" />
        </div>

        <div className="px-8 py-4 text-xs text-white/25">
          © Current · Bank-grade encryption · SOC 2 Type II
        </div>
      </div>

      {/* right panel */}
      <div className="w-[58%] flex flex-col border-l border-white/5">
        {/* top nav */}
        <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
          <div className="flex items-center gap-1 text-xs text-white/40">
            {steps.map((name, i) => (
              <div key={name} className="flex items-center gap-1">
                <span
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    i === 0
                      ? "bg-[#3ecf8e] text-[#080d1a]"
                      : i === 1
                        ? "bg-[#5EB3FF] text-[#080d1a]"
                        : "border border-white/20 text-white/30"
                  }`}
                >
                  {i === 0 ? "✓" : i + 1}
                </span>
                <span
                  className={
                    i === 1
                      ? "text-white font-medium"
                      : i === 0
                        ? "text-white/40"
                        : ""
                  }
                >
                  {name}
                </span>
                {i < steps.length - 1 && (
                  <span className="mx-1 tracking-widest text-white/20">··</span>
                )}
              </div>
            ))}
          </div>

          <button className="text-xs text-white/50 hover:text-white transition-colors text-right leading-tight">
            Need
            <br />
            help?
          </button>
        </div>

        {/* loading state — visible until Plaid Link takes over */}
        {pageIsLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-5 h-5 rounded-full border-2 border-[#5EB3FF]/25 border-t-[#5EB3FF] animate-spin" />
            <p className="text-white/35 text-sm">
              Preparing secure connection…
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
      </div>
    </div>
  );
}
