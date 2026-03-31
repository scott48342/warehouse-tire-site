import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function main() {
  const result = await db.execute(
    sql`SELECT indexname FROM pg_indexes WHERE tablename = 'classic_fitments'`
  );
  console.log("Indexes on classic_fitments:");
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
}

main();
