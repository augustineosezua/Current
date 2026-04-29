"use client";
import { useSession, signOut } from "../lib/auth-client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import LinkPage from "./pages/link";
import { IntroContent } from "./pages/intro";
import Accounts from "./pages/accounts";
import SetupPage from "./pages/setup";

export default function Onboarding() {
  const API = "http://localhost:3001/api";
  const [pageIsLoading, setPageIsLoading] = useState(true);
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

  // handles going to next step
  useEffect(() => {
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
  }, [onboardingStep]);

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
    setPlaidUser(userDetailsData.returnData);

    if (!plaidUser) {
      setOnboardingStep("intro");
      setPageIsLoading(false);
      return;
    }

    // check for bankAccounts on PlaidUser
    //check that for some bank account at least one is a savings account (for categorization purposes)
    if (
      plaidUser.bankAccounts.length > 0 &&
      !plaidUser.bankAccounts.some(
        (account: any) => account.isSavingsAccount === true,
      )
    ) {
      setOnboardingStep("accounts");
      setPageIsLoading(false);
      return;
    } // check for account categorization on bankAccounts
    else if (
      plaidUser.bankAccounts.length > 0 &&
      plaidUser.bankAccounts.some(
        (account: any) => account.isSavingsAccount === true,
      )
    ) {
      setCategorizationCompleted(true);
      setOnboardingStep("setup");
      setPageIsLoading(false);
      return;
    }
    // if user settings don't exist, setup isnt completed setOnboarding("setup")
    else if (
      !userDetailsData.returnData.userSettings ||
      !userDetailsData.returnData.userSettings.nextPaycheckDate
    ) {
      setOnboardingStep("setup");
      setPageIsLoading(false);
      return;
    }

    // check for userSettings and nextPaycheckDate on plaidUser
  };

  //wait for user authentication
  useEffect(() => {
    if (!isPending && !session) {
      setPageIsLoading(false);
      router.push("/login");
    } else {
      if (session?.user.id) {
        // the user is signed in so we pass it over to findCurrentStatus
        setPageIsLoading(true);
        findCurrentStatus(session.user.id);
      }
    }
  }, [session, isPending]);

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
