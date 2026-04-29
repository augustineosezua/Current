"use client";
import { useSession, signOut } from "../lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import InfoPopup from "./helpers/info-popup";
import Account from "./helpers/accounts";
import { User, Info } from "lucide-react";
import Link from 'next/link'


type AccountLoadingState = "loading" | "loaded" | "error";

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [accountLoadingState, setAccountLoadingState] =
    useState<AccountLoadingState>("loading");

  //dashboard states
  const [saveToSpend, setSaveToSpend] = useState({
    until: "April 2nd",
    amount: 300.25,
    message: "You can spend confidently today.",
  });

  const [accounts, setAccounts] = useState([]);

  //safe-to-spend info popup controllers
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const toggleInfoPopup = () => {
    setShowInfoPopup((prev) => !prev);
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token: string) => {
      await fetch("http://localhost:3001/api/exchange-public-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          publicToken: public_token,
          userId: session?.user.id,
        }),
      });
      fetchData();
    },
  });

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    } else {
      if (session?.user.id) {
        createPlaidUser(session.user.id);
      }
    }
  }, [session, isPending]);

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready]);

  if (isPending) return null; // or a loading spinner

  if (!session) return null; // redirecting

  //creates user if does not exist
  async function createPlaidUser(userId: string) {
    if (!session) {
      router.push("/login");
      return;
    }
    //checks if plaid user already exists
    const checkUserResponse = await fetch(
      "http://localhost:3001/api/check-plaid-user",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      },
    );
    //TODO: implement better error handling here + notify user
    if (!checkUserResponse.ok) {
      toast.error("Failed to check Plaid user.");
      return;
    }
    const checkUserData = await checkUserResponse.json();
    if (checkUserData.exists) {
      console.log("Plaid user already exists");
      fetchData();
      return;
    } else {
      //creates link token and initializes Plaid Link
      const response = await fetch(
        "http://localhost:3001/api/create-link-token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        },
      );
      if (!response.ok) {
        toast.error("Failed to create link token.");
        return;
      }
      const data = await response.json();
      console.log("Link token created:", data);
      setLinkToken(data.link_token);
    }
  }

  //fetches transactions and accounts from backend
  const fetchData = async () => {
    if (!session.user.id) return;
    try {
      //transactions
      const transcationParams = "?userId=" + session.user.id;
      const response = await fetch(
        `http://localhost:3001/api/transactions${transcationParams}`,
      );
      if (!response.ok) {
        toast.error("Failed to fetch transactions.");
      }
      const transactions = await response.json();
      console.log("Transactions:", transactions);

      //accounts
      const accountParams = "?userId=" + session.user.id;
      const accountsResponse = await fetch(
        `http://localhost:3001/api/accounts${accountParams}`,
      );
      if (!accountsResponse.ok) {
        toast.error("Failed to fetch accounts.");
      }
      const accounts = await accountsResponse.json();
      console.log("Accounts:", accounts);
      setAccounts(accounts.bankAccounts);
      setAccountLoadingState("loaded");
    } catch (error) {
      toast.error("Something went wrong while loading your data.");
      setAccountLoadingState("error");
    }
  };

  return (
    <div className="bg-[#111125] flex items-center text-[#5EB3FF] h-screen w-screen flex-col font-bold">
      {showInfoPopup && <InfoPopup props={{ exit: toggleInfoPopup }} />}

      {/**header */}
      <div className="w-full flex justify-between items-center px-6 py-2 pt-2 border-b border-[#16213E]">
        <h1 className="text-3xl font-bold cursor-default">Current</h1>
        <User className="h-6 w-6 hover:cursor-pointer" />
      </div>

      <div className="h-2"></div>

      {/**main section */}

      <div className="flex-col items-center flex h-full w-250 max-w-screen pt-10">
        {/**hero section */}

        <div className="w-96 items-center flex-col justify-center">
          <div className="flex w-full justify-center">
            <h4 className="text-[#ffffff]">
              Safe-To-Spend until {saveToSpend.until}
            </h4>
          </div>
          <div className="flex w-full justify-center py-4 items-center gap-2">
            <div>
              <h1 className="text-[#5EB3FF] text-8xl">
                ${saveToSpend.amount.toFixed(2)}
              </h1>
            </div>
            <div>
              <Info
                className="h-6 w-6 text-[#5EB3FF] hover:cursor-pointer"
                onClick={toggleInfoPopup}
              />
            </div>
          </div>
          <div className="flex w-full justify-center ">
            <p className="text-[#ffffff]">{saveToSpend.message}</p>
          </div>
        </div>

        {/**Accounts Section */}
        <div className="h-2"></div>

        <div className="flex w-full px-24 py-8">
          {accountLoadingState === "loading" ? (
            <div className="flex w-full h-32 items-center justify-center flex-col">
              <p className="text-[#ffffff]">Loading Accounts..</p>
              {}
            </div>
          ) : accountLoadingState === "error" ? (
            <div className="flex w-full h-32 items-center justify-center flex-col">
              <p className="text-[#ffffff]">Error loading accounts.</p>
            </div>
          ) : accounts.length > 0 ? (
            <div className="w-full flex flex-col">
              <div className="w-full justify-end flex p-4">
                <Link href="/accounts" className="text-[#5EB3FF] hover:underline">
                  View All
                </Link>
              </div>

              <Account account={accounts} />
            </div>
          ) : (
            <div className="flex w-full h-32 items-center justify-center flex-col">
              <p className="text-[#ffffff]">No accounts found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
