/**
 * Seed two demo accounts so anyone visiting the deployed app can sign in
 * and walk through the full flow without provisioning their own user.
 *
 * Usage:
 *   DATABASE_URL=<prod-or-local> pnpm db:seed
 *
 * Idempotent — safe to run repeatedly. Skips users that already exist.
 *
 * Requires:
 *   DATABASE_URL          — Postgres connection string
 *   BETTER_AUTH_SECRET    — same secret your deployed app uses
 *
 * Optional:
 *   NEXT_PUBLIC_APP_URL   — defaults to http://localhost:3000 (only used by
 *                          Better Auth internals; doesn't affect insertion)
 */

import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth";
import { db } from "../src/lib/db/client";
import { organizations, users, memberships } from "../src/lib/db/schema";

const ORG_ID = "advertout";
const ORG_NAME = "AdvertOut";

interface DemoUser {
  email: string;
  password: string;
  name: string;
  role: "owner" | "accountant" | "viewer";
}

const DEMO_USERS: DemoUser[] = [
  {
    email: "demo1@finai.app",
    password: "Demo!2026Pro",
    name: "Demo User 1",
    role: "owner",
  },
  {
    email: "demo2@finai.app",
    password: "Demo!2026Pro",
    name: "Demo User 2",
    role: "accountant",
  },
];

async function ensureOrg() {
  const [existing] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.id, ORG_ID))
    .limit(1);

  if (existing) {
    console.log(`✓ Org "${ORG_ID}" already exists`);
    return;
  }

  await db.insert(organizations).values({
    id: ORG_ID,
    name: ORG_NAME,
    gstin: "29AABCA1234R1Z5",
    state: "Karnataka",
    stateCode: "29",
    currency: "INR",
    fiscalYearStart: "04-01",
  });
  console.log(`+ Created org "${ORG_ID}"`);
}

async function ensureUser(u: DemoUser) {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, u.email))
    .limit(1);

  let userId: string;

  if (existing) {
    userId = existing.id;
    console.log(`✓ User ${u.email} already exists (${userId})`);
  } else {
    // Better Auth handles password hashing + account row creation.
    const result = await auth.api.signUpEmail({
      body: {
        email: u.email,
        password: u.password,
        name: u.name,
      },
      // No request headers — script context. Better Auth tolerates this for
      // signUpEmail since it doesn't require an existing session.
      headers: new Headers(),
    });

    if (!result?.user?.id) {
      throw new Error(`signUpEmail returned no user for ${u.email}`);
    }
    userId = result.user.id;
    console.log(`+ Created user ${u.email} (${userId})`);
  }

  // Ensure membership of AdvertOut org
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (membership) {
    console.log(`  ✓ Membership already exists`);
  } else {
    await db.insert(memberships).values({
      orgId: ORG_ID,
      userId,
      role: u.role,
    });
    console.log(`  + Linked to org "${ORG_ID}" as ${u.role}`);
  }
}

async function main() {
  // Soft-skip when env is missing — keeps Vercel preview builds happy if
  // they don't have prod DB creds. Run with explicit env to actually seed.
  if (!process.env.DATABASE_URL) {
    console.warn("⊘ DATABASE_URL not set — skipping demo seed.");
    return;
  }
  if (!process.env.BETTER_AUTH_SECRET) {
    console.warn("⊘ BETTER_AUTH_SECRET not set — skipping demo seed.");
    return;
  }
  // Allow opting out entirely via SKIP_DEMO_SEED=1 (e.g. for ephemeral envs).
  if (process.env.SKIP_DEMO_SEED === "1") {
    console.warn("⊘ SKIP_DEMO_SEED=1 — skipping demo seed.");
    return;
  }

  console.log(`\nSeeding demo data into ${process.env.DATABASE_URL.replace(/:[^:@]*@/, ":****@")}\n`);

  await ensureOrg();
  for (const u of DEMO_USERS) {
    await ensureUser(u);
  }

  console.log("\n────────────────────────────────────────");
  console.log("✅ Demo accounts ready. Share these creds:");
  console.log("────────────────────────────────────────");
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email.padEnd(20)}  ${u.password}`);
  }
  console.log("────────────────────────────────────────\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n✗ Seed failed:");
    console.error(err);
    process.exit(1);
  });
