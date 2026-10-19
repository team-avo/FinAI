import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { memberships, users } from "@/lib/db/schema";
import { router, protectedProcedure } from "../init";
import { logActivity } from "./activity";

const roleInput = z.enum(["owner", "accountant", "viewer"]);

/** Member management is owner-only (accountants/viewers can't change the team). */
function requireOwner(role: string | null) {
  if (role !== "owner") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Only an owner can manage team members." });
  }
}

async function ownerCount(orgId: string): Promise<number> {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  return rows.length;
}

export const membersRouter = router({
  // Any member (incl. a read-only CA) can see the team.
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        userId: memberships.userId,
        role: memberships.role,
        name: users.name,
        email: users.email,
        joinedAt: memberships.createdAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.orgId, ctx.orgId))
      .orderBy(memberships.createdAt);
    return rows.map((r) => ({ ...r, isSelf: r.userId === ctx.userId }));
  }),

  // Add an existing FinAI user to this org (e.g. invite your CA as "viewer").
  // A full email-invite-to-signup flow is a follow-up; this covers users who
  // already have a login.
  add: protectedProcedure
    .input(z.object({ email: z.string().email(), role: roleInput.default("viewer") }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.role);
      const email = input.email.trim().toLowerCase();

      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No FinAI account for ${input.email}. Ask them to sign up first, then add them.`,
        });
      }

      const [existing] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, user.id)))
        .limit(1);
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "That person is already on the team." });
      }

      const [row] = await db
        .insert(memberships)
        .values({ orgId: ctx.orgId, userId: user.id, role: input.role })
        .returning();

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: "member:add",
        entityType: "membership",
        entityRef: user.id,
        input: { email, role: input.role },
        output: { ok: true },
      }).catch(() => {});

      return row;
    }),

  setRole: protectedProcedure
    .input(z.object({ userId: z.string(), role: roleInput }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.role);

      const [target] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, input.userId)))
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

      if (target.role === "owner" && input.role !== "owner" && (await ownerCount(ctx.orgId)) <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can't demote the last owner — promote someone else first.",
        });
      }

      await db
        .update(memberships)
        .set({ role: input.role })
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, input.userId)));

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: "member:setRole",
        entityType: "membership",
        entityRef: input.userId,
        input: { role: input.role },
        output: { ok: true },
      }).catch(() => {});

      return { ok: true };
    }),

  remove: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.role);

      const [target] = await db
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, input.userId)))
        .limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });

      if (target.role === "owner" && (await ownerCount(ctx.orgId)) <= 1) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "You can't remove the last owner." });
      }

      await db
        .delete(memberships)
        .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, input.userId)));

      await logActivity({
        orgId: ctx.orgId,
        actor: `user:${ctx.userId}`,
        action: "member:remove",
        entityType: "membership",
        entityRef: input.userId,
        output: { ok: true },
      }).catch(() => {});

      return { ok: true };
    }),
});
