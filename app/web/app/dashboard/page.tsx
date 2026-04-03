"use client";
import { useSession, signOut } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from "react-plaid-link";
import InfoPopup from "./helpers/info-popup";

import { User, Info } from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [linkToken, setLinkToken] = useState<string | null>(null);

  //dashboard states
  const [saveToSpend, setSaveToSpend] = useState({
    until: "April 2nd",
    amount: 300.25,
    message: "You can spend confidently today.",
  });

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
  }, [session, isPending, router]);

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
      console.error("Failed to check Plaid user");
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
        console.error("Failed to create link token");
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
        console.error("Failed to fetch transactions");
      }
      const transactions = await response.json();
      console.log("Transactions:", transactions);

      //accounts
      const accountParams = "?userId=" + session.user.id;
      const accountsResponse = await fetch(
        `http://localhost:3001/api/accounts${accountParams}`,
      );
      if (!accountsResponse.ok) {
        console.error("Failed to fetch accounts");
      }
      const accounts = await accountsResponse.json();
      console.log("Accounts:", accounts);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  return (
    <div className="bg-[#111125] flex items-center text-[#5EB3FF] h-screen w-screen flex-col font-bold">
      {showInfoPopup && <InfoPopup props={{ exit: toggleInfoPopup }} />}

      {/**header */}
      <div className="w-full flex justify-between items-center px-6 py-2 pt-2 border-b border-[#16213E]">
        <h1 className="text-3xl font-bold cursor-default">Currrent</h1>
        <User className="h-6 w-6 hover:cursor-pointer" />
      </div>
      
      <div className="h-2"></div>

      {/**hero section */}
      <div className="flex justify-center h-full w-250 max-w-screen pt-10">
        <div className="w-96 h-24 items-center flex-col justify-center">
          <div className="flex w-full justify-center">
            <h4 className="text-[#ffffff]">
              Safe-To-Spend until {saveToSpend.until}
            </h4>
          </div>
          <div className="flex w-full justify-center py-4 items-center gap-2">
            <div>
              <h1 className="text-[#5EB3FF] text-7xl">
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
      </div>
    </div>
  );
}
