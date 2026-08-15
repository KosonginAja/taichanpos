import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL env variable is not set.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL || "" });

export const db = drizzle(pool, { schema });
