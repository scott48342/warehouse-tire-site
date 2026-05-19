const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const sql = `
CREATE TABLE IF NOT EXISTS wheel_style_assets (
  style_key VARCHAR(100) PRIMARY KEY,
  brand_code VARCHAR(20),
  brand VARCHAR(100),
  model VARCHAR(255),
  image_url VARCHAR(500),
  normalized_image_url VARCHAR(500),
  is_front_facing BOOLEAN,
  classification_confidence INTEGER,
  visualizer_status VARCHAR(30) DEFAULT 'pending',
  classified_at TIMESTAMP,
  classified_by VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wheel_style_assets_front_facing_idx ON wheel_style_assets (is_front_facing);
CREATE INDEX IF NOT EXISTS wheel_style_assets_status_idx ON wheel_style_assets (visualizer_status);
CREATE INDEX IF NOT EXISTS wheel_style_assets_visualizer_ready_idx ON wheel_style_assets (style_key) WHERE is_front_facing = true AND visualizer_status = 'usable';
`;

async function run() {
  try {
    await pool.query(sql);
    console.log('✅ Migration complete: wheel_style_assets table created');
    
    const res = await pool.query('SELECT COUNT(*) FROM wheel_style_assets');
    console.log('Table row count:', res.rows[0].count);
    
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  } finally {
    await pool.end();
  }
}

run();
