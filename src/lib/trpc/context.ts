import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { auth } from "@/lib/auth";

export type Context = {
  orgId: string;
  userId: string | null;
};

export async function createContext({ req }: FetchCreateContextFnOptions): Promise<Context> {
  let userId: string | null = null;

  try {
    const session = await auth.api.getSession({ headers: req.headers });
    userId = session?.user?.id ?? null;
  } catch {}

  return {
    orgId: "advertout",
    userId,
  };
}
