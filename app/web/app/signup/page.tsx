"use client";
import { useState } from "react";
import { signUp } from "../lib/auth-client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");

  const createUser = async () => {
    await signUp.email(
      {
        email,
        password,
        name,
      },
      {
        onError: (ctx) => {
          console.log("Sign up failed: " + ctx.error.message);
        },
      },
    );
  };

  return (
    <div className="max-w-xs mx-auto mt-24 flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Sign Up</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await createUser();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button
          type="submit"
          className="bg-black text-white rounded py-2 cursor-pointer"
        >
          Sign Up
        </button>
      </form>
    </div>
  );
}
