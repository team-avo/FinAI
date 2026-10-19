import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(async ({ ctx, type, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  // CA / reviewer access is read-only: viewers may run queries but never
  // mutate. Enforced centrally here so every mutation is covered.
  if (type === "mutation" && ctx.role === "viewer") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has read-only (reviewer) access and can't make changes.",
    });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
