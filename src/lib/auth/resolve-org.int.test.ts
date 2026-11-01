import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { memberships, organizations, users } from "@/lib/db/schema";
import { resolvePrimaryOrg } from "./resolve-org";

const PREFIX = "test_resolve_";
const userId = `${PREFIX}user`;
const orgOwner = `${PREFIX}org_owner`;
const orgViewer = `${PREFIX}org_viewer`;

describe.skipIf(!process.env.DATABASE_URL)("resolvePrimaryOrg", () => {
  afterAll(async () => {
    await db.delete(users).where(eq(users.id, userId)); // cascades memberships
    await db.delete(organizations).where(inArray(organizations.id, [orgOwner, orgViewer]));
  });

  it("deterministically prefers the owned org and never flips across calls", async () => {
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(organizations).where(inArray(organizations.id, [orgOwner, orgViewer]));

    await db.insert(organizations).values([
      { id: orgOwner, name: "Owned Co" },
      { id: orgViewer, name: "Viewer Co" },
    ]);
    await db.insert(users).values({ id: userId, name: "T", email: `${PREFIX}@t.test` });

    // The user is a VIEWER of the OLDER org and an OWNER of the NEWER org. The
    // previous createdAt-only resolver would have picked the (older) viewer org
    // — and worse, could return either org from one request to the next. The new
    // resolver must consistently pick the OWNED org.
    await db.insert(memberships).values([
      { orgId: orgViewer, userId, role: "viewer", createdAt: new Date("2020-01-01T00:00:00Z") },
      { orgId: orgOwner, userId, role: "owner", createdAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    const first = await resolvePrimaryOrg(userId);
    expect(first).toMatchObject({ orgId: orgOwner, role: "owner" });
    // Stable across repeated calls — no random flip between the two orgs.
    for (let i = 0; i < 5; i++) {
      expect((await resolvePrimaryOrg(userId))?.orgId).toBe(orgOwner);
    }
  });

  it("returns null for a user with no memberships", async () => {
    expect(await resolvePrimaryOrg(`${PREFIX}nobody`)).toBeNull();
  });
});
