import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null as unknown as ReturnType<typeof drizzle>;
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

export const db = getDb();
export type DB = typeof db;
