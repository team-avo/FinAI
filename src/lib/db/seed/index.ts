import { db } from "@/lib/db/client";
import { chartOfAccounts, organizations, taxRates, vendorCategories } from "@/lib/db/schema";
import { createId } from "@/lib/db/utils";
import { DEFAULT_COA, VENDOR_CATEGORY_RULES } from "./coa";
import { GST_RATES } from "./tax-rates";

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
