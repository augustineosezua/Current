import { createAuthClient } from "better-auth/react";

// With the /api proxy in place the auth server is always on the same origin.
// Passing no baseURL lets better-auth use window.location.origin automatically.
export const authClient = createAuthClient({});

export const { signIn, signUp, useSession, signOut } = authClient;