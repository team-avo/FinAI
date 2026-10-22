import { randomBytes } from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invites, memberships, organizations, users } from "@/lib/db/schema";
import { router, protectedProcedure, publicProcedure } from "../init";
import { logActivity } from "./activity";
import { sendInviteEmail } from "@/lib/email/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://finai-avo.vercel.app";

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

  // Invite by email. If they already have an account, add them now; otherwise
  // create a pending invite and email a link to join when they sign up.
  invite: protectedProcedure
    .input(z.object({ email: z.string().email(), role: roleInput.default("viewer") }))
    .mutation(async ({ ctx, input }) => {
      requireOwner(ctx.role);
      const email = input.email.trim().toLowerCase();

      const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (user) {
        const [existing] = await db
          .select({ id: memberships.id })
          .from(memberships)
          .where(and(eq(memberships.orgId, ctx.orgId), eq(memberships.userId, user.id)))
          .limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "That person is already on the team." });
        await db.insert(memberships).values({ orgId: ctx.orgId, userId: user.id, role: input.role });
        await logActivity({ orgId: ctx.orgId, actor: `user:${ctx.userId}`, action: "member:add", entityType: "membership", entityRef: user.id, input: { email, role: input.role }, output: { ok: true } }).catch(() => {});
        return { status: "added" as const, email, url: null as string | null };
      }

      const token = randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.insert(invites).values({ orgId: ctx.orgId, email, role: input.role, token, invitedBy: ctx.userId, expiresAt });

      const url = `${APP_URL}/invite/${token}`;
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1);
      const [inviter] = await db.select({ name: users.name }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      try {
        await sendInviteEmail({ to: email, orgName: org?.name ?? "FinAI", inviterName: inviter?.name ?? undefined, role: input.role, url });
      } catch {
        // Email is best-effort — the owner can still copy and share the link.
      }
      await logActivity({ orgId: ctx.orgId, actor: `user:${ctx.userId}`, action: "member:invite", entityType: "invite", entityRef: email, input: { email, role: input.role }, output: { ok: true } }).catch(() => {});
      return { status: "invited" as const, email, url };
    }),

  // Public: show an invite so the (not-yet-logged-in) person can decide.
  inviteInfo: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const [inv] = await db.select().from(invites).where(eq(invites.token, input.token)).limit(1);
      if (!inv) return null;
      const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, inv.orgId)).limit(1);
      return {
        orgName: org?.name ?? "FinAI",
        email: inv.email,
        role: inv.role,
        status: inv.status,
        expired: inv.expiresAt.getTime() < Date.now(),
      };
    }),

  // Accept an invite — the logged-in user whose email matches joins the org.
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [inv] = await db.select().from(invites).where(eq(invites.token, input.token)).limit(1);
      if (!inv || inv.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "This invite is no longer valid." });
      if (inv.expiresAt.getTime() < Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "This invite has expired." });

      const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      if (!me || me.email.toLowerCase() !== inv.email.toLowerCase()) {
        throw new TRPCError({ code: "FORBIDDEN", message: `This invite is for ${inv.email}. Sign in with that email to accept.` });
      }

      const [existing] = await db
        .select({ id: memberships.id })
        .from(memberships)
        .where(and(eq(memberships.orgId, inv.orgId), eq(memberships.userId, ctx.userId)))
        .limit(1);
      if (!existing) await db.insert(memberships).values({ orgId: inv.orgId, userId: ctx.userId, role: inv.role });
      await db.update(invites).set({ status: "accepted" }).where(eq(invites.id, inv.id));
      await logActivity({ orgId: inv.orgId, actor: `user:${ctx.userId}`, action: "invite:accepted", entityType: "membership", entityRef: ctx.userId, output: { role: inv.role } }).catch(() => {});
      return { ok: true };
    }),
});
