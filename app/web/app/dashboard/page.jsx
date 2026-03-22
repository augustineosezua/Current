"use client";
import { useSession, signOut } from "../lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/login");
    }
  }, [session, isPending, router]);

  if (isPending) return null; // or a loading spinner

  if (!session) return null; // redirecting

  return (
    <div className="bg-white flex justify-between p-4 text-black">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <button
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        onClick={(e) => {
          e.preventDefault();
          signOut({ fetchOptions: { onSuccess: () => router.push("/") } });
        }}
      >
        Log Out
      </button>
    </div>
  );
}
