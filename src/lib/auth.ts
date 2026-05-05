import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";
import { users, sessions, accounts, verifications } from "@/lib/db/schema";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-before-production",
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, account: accounts, verification: verifications },
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
