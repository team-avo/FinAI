import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null as unknown as ReturnType<typeof drizzle>;
  }
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}

export const db = getDb();
export type DB = typeof db;
