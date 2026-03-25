"use client";
import { useSession, signOut } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  usePlaidLink,
  PlaidLinkOptions,
  PlaidLinkOnSuccess,
} from "react-plaid-link";

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [linkToken, setLinkToken] = useState<string | null>(null)

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
    <div className="bg-white flex justify-between text-black h-screen w-screen flex-col">
      <div className="w-full flex justify-between px-4 pt-2">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <button
          className="bg-blue-500 hover:bg-blue-700 h-12 text-white font-bold py-2 px-4 rounded"
          onClick={(e) => {
            e.preventDefault();
            signOut({ fetchOptions: { onSuccess: () => router.push("/") } });
          }}
        >
          Log Out
        </button>
      </div>
      <div className="h-2"></div>
      <div className="w-full h-full bg-gray-700"></div>
    </div>
  );
}
