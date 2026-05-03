import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Delete the old combined Goodyear rebate - keep only the specific $80/$60 entries
const result = await pool.query(`DELETE FROM site_rebates WHERE id = 'manual:goodyear'`);
console.log(`Deleted ${result.rowCount} old Goodyear rebate(s)`);

// Verify remaining rebates
const { rows } = await pool.query(`
  SELECT id, brand, rebate_amount, eligible_models 
  FROM site_rebates 
  WHERE brand ILIKE '%goodyear%' OR brand ILIKE '%cooper%' OR brand ILIKE '%michelin%'
  ORDER BY brand, rebate_amount
`);
console.log("\nRemaining rebates:");
for (const r of rows) {
  console.log(`  ${r.id}: ${r.brand} ${r.rebate_amount} → ${r.eligible_models?.join(", ") || "brand-wide"}`);
}

await pool.end();
