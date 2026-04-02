import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";

async function check() {
  // Check what's in DB for 2008 Chrysler 300
  const result = await db.execute(sql`
    SELECT id, year, make, model, trim, modification_id, bolt_pattern, center_bore
    FROM vehicle_fitments 
    WHERE year = 2008 
      AND LOWER(make) = 'chrysler' 
      AND LOWER(model) LIKE '%300%'
    ORDER BY trim
  `);
  
  console.log('DB records for 2008 Chrysler 300:');
  console.log(JSON.stringify(result.rows, null, 2));
  
  // Also check what modification IDs look like
  const mods = await db.execute(sql`
    SELECT DISTINCT year, modification_id, trim, model
    FROM vehicle_fitments 
    WHERE LOWER(make) = 'chrysler' 
      AND LOWER(model) LIKE '%300%'
      AND year BETWEEN 2006 AND 2010
    ORDER BY year, trim
    LIMIT 30
  `);
  console.log('\nModification IDs for Chrysler 300 (2006-2010):');
  console.log(JSON.stringify(mods.rows, null, 2));
  
  // Check specifically for modification s_9400581b
  const specific = await db.execute(sql`
    SELECT * FROM vehicle_fitments 
    WHERE modification_id = 's_9400581b'
    LIMIT 1
  `);
  console.log('\nRecord with modification_id s_9400581b:');
  console.log(JSON.stringify(specific.rows, null, 2));
  
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});
