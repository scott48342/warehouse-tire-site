/**
 * WSI Wholesale — Create wsi_wheels table
 *
 * Run from project root:
 *   node scripts/wsi-create-table.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('Creating wsi_wheels table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS wsi_wheels (
        sku            TEXT PRIMARY KEY,
        brand          TEXT NOT NULL,
        style          TEXT,
        finish         TEXT,
        diameter       NUMERIC NOT NULL,
        width          NUMERIC NOT NULL,
        bp1            TEXT,          -- first bolt pattern, normalized "6x139.7"
        bp2            TEXT,          -- second bolt pattern (multi-fit), normalized
        offset_mm      NUMERIC,
        centerbore     NUMERIC,
        wsi_stock      INTEGER DEFAULT 0,
        alt_stock      INTEGER DEFAULT 0,
        catalog_price  NUMERIC,
        dealer_cost    NUMERIC,
        load_rating    NUMERIC,
        image_url      TEXT,
        logo_url       TEXT,
        synced_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS wsi_wheels_bp1_idx ON wsi_wheels(bp1)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS wsi_wheels_bp2_idx ON wsi_wheels(bp2)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS wsi_wheels_brand_idx ON wsi_wheels(brand)
    `);

    console.log('✅ wsi_wheels table ready.');

    // Quick count
    const { rows } = await client.query('SELECT COUNT(*) FROM wsi_wheels');
    console.log(`Current row count: ${rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
