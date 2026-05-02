#!/usr/bin/env node
/**
 * Add May 2026 manufacturer rebates
 * Run: node scripts/add-rebates-may-2026.mjs
 */

import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env.local") });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const rebates = [
  // Goodyear $80 rebate (specific models)
  {
    id: "manual:goodyear-80",
    source: "manual",
    brand: "Goodyear",
    headline: "Save $80 on select Goodyear tires - March 1 - June 30, 2026",
    rebate_amount: "$80",
    rebate_type: "mail-in",
    form_url: "https://www.goodyearrebates.com",
    ends_text: "March 1 - June 30, 2026",
    start_date: new Date("2026-03-01"),
    expires_at: new Date("2026-06-30T23:59:59"),
    requirements: "Set of 4 tires required",
    eligible_models: ["Assurance WeatherReady", "Wrangler DuraTrac", "Wrangler Steadfast"],
    eligible_skus: null,
    eligible_sizes: null,
    brand_wide: false,
    enabled: true,
  },
  // Goodyear $60 rebate (specific models)
  {
    id: "manual:goodyear-60",
    source: "manual",
    brand: "Goodyear",
    headline: "Save $60 on select Goodyear tires - March 1 - June 30, 2026",
    rebate_amount: "$60",
    rebate_type: "mail-in",
    form_url: "https://www.goodyearrebates.com",
    ends_text: "March 1 - June 30, 2026",
    start_date: new Date("2026-03-01"),
    expires_at: new Date("2026-06-30T23:59:59"),
    requirements: "Set of 4 tires required",
    eligible_models: ["Assurance MaxLife", "Assurance ComfortDrive"],
    eligible_skus: null,
    eligible_sizes: null,
    brand_wide: false,
    enabled: true,
  },
  // Cooper $70 rebate
  {
    id: "manual:cooper",
    source: "manual",
    brand: "Cooper",
    headline: "Save $70 on select Cooper tires - March 1 - June 30, 2026",
    rebate_amount: "$70",
    rebate_type: "mail-in",
    form_url: "https://www.coopertirespromos.com",
    ends_text: "March 1 - June 30, 2026",
    start_date: new Date("2026-03-01"),
    expires_at: new Date("2026-06-30T23:59:59"),
    requirements: "Set of 4 tires required",
    eligible_models: ["Discoverer Stronghold", "ProControl", "Discoverer Road+Trail"],
    eligible_skus: null,
    eligible_sizes: null,
    brand_wide: false,
    enabled: true,
  },
  // Michelin $80 rebate (brand-wide)
  {
    id: "manual:michelin",
    source: "manual",
    brand: "Michelin",
    headline: "Get $80 back via Visa Reward Card on Michelin tires - March 26 - May 23, 2026",
    rebate_amount: "$80",
    rebate_type: "mail-in",
    form_url: "https://michelin.tirerewardcenter.com",
    ends_text: "March 26 - May 23, 2026",
    start_date: new Date("2026-03-26"),
    expires_at: new Date("2026-05-23T23:59:59"),
    requirements: "Set of 4 tires required",
    eligible_models: null,
    eligible_skus: null,
    eligible_sizes: null,
    brand_wide: true,
    enabled: true,
  },
];

async function main() {
  console.log("Adding/updating rebates...\n");

  // Ensure table has all columns
  await pool.query(`
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS rebate_amount TEXT;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS rebate_type TEXT;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS eligible_skus TEXT[];
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS eligible_models TEXT[];
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS eligible_sizes TEXT[];
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS brand_wide BOOLEAN DEFAULT TRUE;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS requirements TEXT;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
    ALTER TABLE site_rebates ADD COLUMN IF NOT EXISTS internal_notes TEXT;
  `);

  for (const r of rebates) {
    try {
      await pool.query({
        text: `
          INSERT INTO site_rebates (
            id, source, brand, headline, form_url, ends_text, expires_at, enabled,
            rebate_amount, rebate_type, eligible_models, eligible_skus, eligible_sizes,
            brand_wide, requirements, start_date, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
          ON CONFLICT (id) DO UPDATE SET
            brand = EXCLUDED.brand,
            headline = EXCLUDED.headline,
            form_url = EXCLUDED.form_url,
            ends_text = EXCLUDED.ends_text,
            expires_at = EXCLUDED.expires_at,
            enabled = EXCLUDED.enabled,
            rebate_amount = EXCLUDED.rebate_amount,
            rebate_type = EXCLUDED.rebate_type,
            eligible_models = EXCLUDED.eligible_models,
            eligible_skus = EXCLUDED.eligible_skus,
            eligible_sizes = EXCLUDED.eligible_sizes,
            brand_wide = EXCLUDED.brand_wide,
            requirements = EXCLUDED.requirements,
            start_date = EXCLUDED.start_date,
            updated_at = NOW()
        `,
        values: [
          r.id,
          r.source,
          r.brand,
          r.headline,
          r.form_url,
          r.ends_text,
          r.expires_at,
          r.enabled,
          r.rebate_amount,
          r.rebate_type,
          r.eligible_models,
          r.eligible_skus,
          r.eligible_sizes,
          r.brand_wide,
          r.requirements,
          r.start_date,
        ],
      });
      console.log(`✅ ${r.brand}: ${r.rebate_amount} rebate`);
      if (r.eligible_models) {
        console.log(`   Models: ${r.eligible_models.join(", ")}`);
      } else if (r.brand_wide) {
        console.log(`   Brand-wide (all ${r.brand} tires)`);
      }
    } catch (err) {
      console.error(`❌ ${r.brand}:`, err.message);
    }
  }

  console.log("\n✅ Done! Rebates active and will show on matching tire SRP cards and PDP pages.");

  await pool.end();
}

main().catch(console.error);
