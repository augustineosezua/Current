"use client";
import { useSession, signOut } from "../lib/auth-client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import LinkPage from "./pages/link";
import { IntroContent } from "./pages/intro";
import Accounts from "./pages/accounts";
import SetupPage from "./pages/setup";
import LoadingScreen from "../components/loading-screen";

export default function Onboarding() {
  const API = "http://localhost:3001/api";
  const [pageIsLoading, setPageIsLoading] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [onboardingStep, setOnboardingStep] = useState(
    searchParams.get("step") || "intro",
  );
  const [introCompleted, setIntroCompleted] = useState(false);
  const [categorizationCompleted, setCategorizationCompleted] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [plaidUser, setPlaidUser] = useState(null);

  useEffect(() => {
    if (!isPending) setAuthResolved(true);
  }, [isPending]);

  // handles going to next step — gated so URL never changes during auth/loading
  useEffect(() => {
    if (!authResolved || pageIsLoading) return;
    console.log("Current onboarding step:", onboardingStep);

    switch (onboardingStep) {
      case "intro":
        if (!introCompleted) {
          const params = new URLSearchParams();
          params.set("step", "intro");
          router.push(`${pathname}?${params.toString()}`);
        } else if (introCompleted) {
          const params = new URLSearchParams();
          params.set("step", "connect");
          router.push(`${pathname}?${params.toString()}`);
        }
        break;

      case "connect":
        if (!plaidUser) {
          const params = new URLSearchParams();
          params.set("step", "connect");
          router.push(`${pathname}?${params.toString()}`);
        } else if (plaidUser) {
          const params = new URLSearchParams();
          params.set("step", "accounts");
          router.push(`${pathname}?${params.toString()}`);
        }
        break;

      case "accounts":
        if (!categorizationCompleted) {
          const params = new URLSearchParams();
          params.set("step", "accounts");
          router.push(`${pathname}?${params.toString()}`);
        } else if (categorizationCompleted) {
          const params = new URLSearchParams();
          params.set("step", "setup");
          router.push(`${pathname}?${params.toString()}`);
        }
        break;

      case "setup":
        if (!setupCompleted) {
          const params = new URLSearchParams();
          params.set("step", "setup");
          router.push(`${pathname}?${params.toString()}`);
        } else if (setupCompleted) {
          router.push("/dashboard");
        }
        break;
    }
  }, [onboardingStep, authResolved, pageIsLoading]);

  const findCurrentStatus = async (userId: string) => {
    // first check for plaidUser
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
    const plaidUser = userDetailsData.returnData.plaidUser;
    const userSettings = userDetailsData.returnData.userSettings;
    setPlaidUser(userDetailsData.returnData);

    // no plaid connection at all → intro
    if (!plaidUser) {
      setOnboardingStep("intro");
      setPageIsLoading(false);
      return;
    }

    // plaid connected but no bank accounts imported yet → connect
    if (!plaidUser.bankAccounts?.length) {
      setOnboardingStep("connect");
      setPageIsLoading(false);
      return;
    }

    // accounts exist but none categorized as savings → accounts
    if (!plaidUser.bankAccounts.some((a: any) => a.isSavingsAccount === true)) {
      setOnboardingStep("accounts");
      setPageIsLoading(false);
      return;
    }

    // savings categorized but setup not done → setup
    if (!userSettings?.nextPaychequeDate) {
      setCategorizationCompleted(true);
      setOnboardingStep("setup");
      setPageIsLoading(false);
      return;
    }

    // onboarding fully complete — send to dashboard
    router.push("/dashboard");
  };

  //wait for user authentication
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else {
      if (session?.user.id) {
        // the user is signed in so we pass it over to findCurrentStatus
        setPageIsLoading(true);
        findCurrentStatus(session.user.id);
      }
    }
  }, [session, isPending]);

  // useEffect never runs on the server, so authResolved stays false during SSR
  // preventing any flash before the client knows the session state
  if (!authResolved || pageIsLoading) return <LoadingScreen />;

  if (onboardingStep === "intro") {
    return (
      <IntroContent
        setIntroCompleted={setIntroCompleted}
        setOnboardingStep={setOnboardingStep}
      />
    );
  } else if (onboardingStep === "connect") {
    return (
      <LinkPage
        setLinkToken={setLinkToken}
        setOnboardingStep={setOnboardingStep}
        linkToken={linkToken}
        session={session}
        setPlaidUser={setPlaidUser}
      />
    );
  } else if (onboardingStep === "accounts") {
    return (
      <Accounts
        setCategorizationCompleted={setCategorizationCompleted}
        setOnboardingStep={setOnboardingStep}
        plaidUserData={plaidUser}
        session={session}
      />
    );
  } else if (onboardingStep === "setup") {
    return <SetupPage />;
  } else {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">
          Onboarding Step: {onboardingStep}
        </h1>
        <p className="text-gray-600">This step is under construction.</p>
      </div>
    );
  }
}
