/**
 * Post-build orchestration: schema push → demo seed.
 *
 * Runs after `next build` from the package.json build script. Handles:
 *   1. Skip entirely if DB env is missing (Vercel preview without DB).
 *   2. Apply latest Drizzle schema to the target DB (drizzle-kit push --force).
 *   3. Seed demo users (tsx scripts/seed-demo-users.ts).
 *
 * Each step inherits stdio so logs surface in the build log. Any non-zero
 * exit kills the deploy — we don't want partial state in prod.
 */

import { spawnSync } from "node:child_process";

function step(label: string, cmd: string, args: string[]) {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status}).`);
    process.exit(r.status ?? 1);
  }
}

function main() {
  if (process.env.SKIP_POST_BUILD === "1") {
    console.log("⊘ SKIP_POST_BUILD=1 — skipping schema push + seed.");
    return;
  }
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET) {
    console.log(
      "⊘ DATABASE_URL or BETTER_AUTH_SECRET not set — skipping schema push + seed.",
    );
    return;
  }

  step("Pushing latest schema to DB", "pnpm", ["exec", "drizzle-kit", "push", "--force"]);
  step("Seeding demo users", "pnpm", ["exec", "tsx", "scripts/seed-demo-users.ts"]);

  console.log("\n✅ Post-build complete.\n");
}

main();
