import "server-only";
import { createCallerFactory } from "./init";
import { appRouter } from "./root";
import type { Context } from "./context";

const createCaller = createCallerFactory(appRouter);

export function createServerCaller(ctx: Context = { orgId: "advertout", userId: null }) {
  return createCaller(ctx);
}
