import pg from "pg";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const { rows } = await pool.query(`
  SELECT id, brand, rebate_amount, eligible_models, brand_wide, enabled, expires_at
  FROM site_rebates
  WHERE enabled = true
  ORDER BY brand, rebate_amount DESC
`);

console.log("Active rebates:\n");
for (const r of rows) {
  const models = r.eligible_models?.join(", ") || (r.brand_wide ? "ALL (brand-wide)" : "none");
  console.log(`  ${r.brand}: ${r.rebate_amount} → ${models}`);
  console.log(`    Expires: ${r.expires_at?.toISOString() || "never"}\n`);
}

await pool.end();
