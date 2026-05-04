import { betterAuth } from "better-auth";

/**
 * W1 placeholder — auth is fully wired in W3 once Neon DB is connected.
 *
 * To activate:
 * 1. Set DATABASE_URL (Neon Postgres) in .env.local
 * 2. Set RESEND_API_KEY for magic-link emails
 * 3. Add the drizzle adapter and email provider below
 * 4. Run `pnpm db:push` to apply the Better Auth schema
 */

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-before-production",
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

  // TODO W3: swap to drizzle adapter + Neon Postgres
  // database: drizzleAdapter(db, { provider: "pg" }),

  emailAndPassword: {
    enabled: false,
  },

  // TODO W3: enable magic link via Resend
  // plugins: [
  //   magicLink({
  //     sendMagicLink: async ({ email, url }) => {
  //       await resend.emails.send({
  //         from: "FinAI <noreply@finai.advertout.in>",
  //         to: email,
  //         subject: "Sign in to FinAI",
  //         html: `<a href="${url}">Click here to sign in</a>`,
  //       });
  //     },
  //   }),
  // ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
