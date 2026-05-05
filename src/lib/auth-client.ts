"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL — defaults to the current page origin, which is correct for same-origin usage
// and avoids the env-var-baked-at-build-time problem.
export const authClient = createAuthClient();

export const { signIn, signOut, signUp, useSession } = authClient;
