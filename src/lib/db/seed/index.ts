import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { chartOfAccounts, memberships, organizations, taxRates, vendorCategories } from "@/lib/db/schema";
import { createId } from "@/lib/db/utils";
import { DEFAULT_COA, VENDOR_CATEGORY_RULES } from "./coa";
import { GST_RATES } from "./tax-rates";
import { auth } from "@/lib/auth";

/**
 * Seeds the database for a new organization with:
 * - Chart of Accounts (India service business)
 * - GST tax rates
 * - Default vendor → category rules
 */
export async function seedOrg(orgId: string) {
  // Build CoA with resolved parent IDs
  const codeToId = new Map<string, string>();

  const coaInserts = DEFAULT_COA.map((entry) => {
    const id = createId();
    codeToId.set(entry.code, id);
    return {
      id,
      orgId,
      code: entry.code,
      name: entry.name,
      type: entry.type as "asset" | "liability" | "income" | "expense" | "equity",
      isSystem: entry.isSystem,
      parentId: entry.parentCode ? undefined : undefined,
    };
  });

  // Second pass to set parent IDs (can't do in first pass because ids aren't assigned yet)
  const coaWithParents = DEFAULT_COA.map((entry, i) => ({
    ...coaInserts[i],
    parentId: entry.parentCode ? codeToId.get(entry.parentCode) ?? null : null,
  }));

  await db.insert(chartOfAccounts).values(coaWithParents);

  // Insert tax rates
  await db.insert(taxRates).values(
    GST_RATES.map((rate) => ({
      orgId,
      name: rate.name,
      rate: rate.rate,
      type: rate.type,
    })),
  );

  // Insert vendor category rules
  const vendorInserts = VENDOR_CATEGORY_RULES.map((rule) => ({
    orgId,
    vendorPattern: rule.pattern,
    accountId: codeToId.get(rule.accountCode) ?? null,
    accountName: DEFAULT_COA.find((c) => c.code === rule.accountCode)?.name ?? null,
  }));

  if (vendorInserts.length > 0) {
    await db.insert(vendorCategories).values(vendorInserts);
  }

  return { codeToId };
}

/**
 * Idempotent guarantee that `orgId` exists and has a chart of accounts.
 * Safe to run on every deploy: it creates the org if missing and seeds the
 * chart ONLY when the org has zero accounts, so it never duplicates the CoA
 * (unlike seedOrg, which inserts unconditionally). When the chart is empty the
 * tax rates and vendor rules are necessarily empty too — AI vendor-learning
 * can't write rows without existing accounts — so seedOrg is safe to call.
 */
export async function ensureOrgSeeded(orgId = "advertout") {
  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: "AdvertOut",
      gstin: "",
      currency: "INR",
      fiscalYearStart: "04-01",
    })
    .onConflictDoNothing();

  const existing = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.orgId, orgId))
    .limit(1);

  if (existing.length === 0) {
    await seedOrg(orgId);
    console.log(`✓ ensureOrgSeeded: seeded chart of accounts for "${orgId}"`);
  } else {
    console.log(`✓ ensureOrgSeeded: "${orgId}" already has a chart — skipping`);
  }
}

/**
 * Seeds the AdvertOut organization for Phase 1.
 * Run once manually after first deployment.
 */
export async function seedAdvertOut() {
  const orgId = "advertout";

  await db
    .insert(organizations)
    .values({
      id: orgId,
      name: "AdvertOut",
      gstin: "",
      currency: "INR",
      fiscalYearStart: "04-01",
    })
    .onConflictDoNothing();

  await seedOrg(orgId);
  console.log("✓ AdvertOut seeded");
}

/**
 * Creates the initial admin user and links them to AdvertOut org.
 * Safe to call multiple times — skips if email already exists.
 */
export async function seedAdminUser({
  name,
  email,
  password,
}: {
  name: string;
  email: string;
  password: string;
}) {
  const ctx = await auth.api.signUpEmail({
    body: { name, email, password },
    asResponse: false,
  }).catch((err: unknown) => {
    // Better Auth throws when user already exists
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exist")) {
      console.log(`  user ${email} already exists, skipping`);
      return null;
    }
    throw err;
  });

  if (!ctx) return;

  // Link the new user to the AdvertOut org as owner
  const userId = (ctx as { user?: { id: string } }).user?.id;
  if (userId) {
    await db
      .insert(memberships)
      .values({ orgId: "advertout", userId, role: "owner" })
      .onConflictDoNothing();
  }

  console.log(`✓ Admin user ${email} created`);
}
