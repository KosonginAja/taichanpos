import { db } from "./src/db";
import { orders } from "./src/db/schema";
import { sql } from "drizzle-orm";

async function run() {
  try {
    await db.update(orders).set({
      grandTotal: sql`revenue_total`
    }).where(sql`grand_total = 0`);
    console.log("Migration successful");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
