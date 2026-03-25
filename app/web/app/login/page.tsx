"use client";
import { useState } from "react";
import { signIn } from "../lib/auth-client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  

  return (
    <div className="max-w-xs mx-auto mt-24 flex flex-col gap-6 text-white">
      <h1 className="text-2xl font-semibold">Login</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await signIn.email({
              email: email,
              password: password,
              callbackURL: "http://localhost:3000/dashboard" // Redirect after successful login
            });
            console.log("Logged in successfully!");
          } catch (err) {
            if (err instanceof Error) {
              console.log("Login failed: " + err.message);
            }
          }
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
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <button type="submit" className="bg-black text-white rounded py-2 cursor-pointer">
          Login
        </button>
      </form>
    </div>
  );
}
