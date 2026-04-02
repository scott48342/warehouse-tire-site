/**
 * Create the fitment_gap_alerts table
 * 
 * Run: node scripts/create-gap-alerts-table.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const createTableSQL = `
-- Fitment Gap Alerts Table
-- Tracks alerts sent for unresolved fitment searches
-- Used for deduplication and audit trail

CREATE TABLE IF NOT EXISTS fitment_gap_alerts (
  id SERIAL PRIMARY KEY,
  
  -- Vehicle identification (matches unresolved_fitment_searches)
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  search_type TEXT NOT NULL,
  
  -- Alert tracking
  alert_type TEXT NOT NULL,  -- 'new_vehicle' | 'threshold_crossed' | 'high_priority' | 'daily_summary'
  alert_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Context at time of alert
  occurrence_count_at_alert INTEGER NOT NULL,
  priority_score_at_alert INTEGER,
  
  -- Email tracking
  email_id TEXT,       -- Resend email ID for tracking
  email_status TEXT    -- 'sent' | 'failed' | 'pending'
);

-- Query indexes
CREATE INDEX IF NOT EXISTS gap_alerts_vehicle_idx 
  ON fitment_gap_alerts (year, make, model, search_type);

CREATE INDEX IF NOT EXISTS gap_alerts_sent_at_idx 
  ON fitment_gap_alerts (alert_sent_at DESC);

CREATE INDEX IF NOT EXISTS gap_alerts_type_idx 
  ON fitment_gap_alerts (alert_type);

-- Comments
COMMENT ON TABLE fitment_gap_alerts IS 
  'Tracks email alerts sent for unresolved fitment searches. Used for deduplication and audit.';

COMMENT ON COLUMN fitment_gap_alerts.alert_type IS 
  'Type of alert: new_vehicle, threshold_crossed, high_priority, or daily_summary';

COMMENT ON COLUMN fitment_gap_alerts.email_id IS 
  'Resend email ID for delivery tracking';
`;

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('Missing POSTGRES_URL or DATABASE_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('Creating fitment_gap_alerts table...');
    await pool.query(createTableSQL);
    console.log('✅ Table created successfully');
    
    // Verify table exists
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fitment_gap_alerts'
      ORDER BY ordinal_position
    `);
    
    console.log('\nTable columns:');
    for (const row of result.rows) {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    }
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'fitment_gap_alerts'
    `);
    
    console.log('\nIndexes:');
    for (const row of indexes.rows) {
      console.log(`  - ${row.indexname}`);
    }
    
  } catch (err) {
    console.error('Error creating table:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
