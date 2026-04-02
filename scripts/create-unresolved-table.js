/**
 * Create the unresolved_fitment_searches table
 * 
 * Run: node scripts/create-unresolved-table.js
 */

const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const createTableSQL = `
-- Unresolved Fitment Searches Table
-- Tracks vehicles searched by users that cannot be resolved in the fitment DB
-- Used for prioritizing which vehicles to add to the database

CREATE TABLE IF NOT EXISTS unresolved_fitment_searches (
  id SERIAL PRIMARY KEY,
  
  -- Vehicle identification (normalized lowercase)
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT,
  
  -- Search context
  search_type TEXT NOT NULL,  -- 'wheel' | 'tire' | 'fitment' | 'unknown'
  source TEXT NOT NULL,       -- 'selector' | 'direct_url' | 'api' | 'unknown'
  
  -- Aggregation counters
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  
  -- Timestamps
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Metadata (sample paths, user agents, resolution attempts)
  metadata JSONB
);

-- Unique constraint for aggregation (upsert logic)
CREATE UNIQUE INDEX IF NOT EXISTS unresolved_vehicle_unique_idx 
  ON unresolved_fitment_searches (year, make, model, COALESCE(trim, ''), search_type);

-- Query optimization indexes
CREATE INDEX IF NOT EXISTS unresolved_make_idx 
  ON unresolved_fitment_searches (make);

CREATE INDEX IF NOT EXISTS unresolved_model_idx 
  ON unresolved_fitment_searches (model);

CREATE INDEX IF NOT EXISTS unresolved_count_idx 
  ON unresolved_fitment_searches (occurrence_count DESC);

CREATE INDEX IF NOT EXISTS unresolved_last_seen_idx 
  ON unresolved_fitment_searches (last_seen DESC);

-- Compound index for make+model queries
CREATE INDEX IF NOT EXISTS unresolved_make_model_idx 
  ON unresolved_fitment_searches (make, model);

-- Comments for documentation
COMMENT ON TABLE unresolved_fitment_searches IS 
  'Tracks vehicle searches that cannot be resolved in the fitment DB. Used for prioritizing data entry.';

COMMENT ON COLUMN unresolved_fitment_searches.search_type IS 
  'Type of search: wheel, tire, fitment, or unknown';

COMMENT ON COLUMN unresolved_fitment_searches.source IS 
  'Source of the request: selector (vehicle picker), direct_url, api, or unknown';

COMMENT ON COLUMN unresolved_fitment_searches.occurrence_count IS 
  'Number of times this Y/M/M/trim has been searched';

COMMENT ON COLUMN unresolved_fitment_searches.metadata IS 
  'JSON with samplePaths, sampleUserAgents, lastModificationId, resolutionAttempts';
`;

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('Missing POSTGRES_URL or DATABASE_URL environment variable');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  
  try {
    console.log('Creating unresolved_fitment_searches table...');
    await pool.query(createTableSQL);
    console.log('✅ Table created successfully');
    
    // Verify table exists
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'unresolved_fitment_searches'
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
      WHERE tablename = 'unresolved_fitment_searches'
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
