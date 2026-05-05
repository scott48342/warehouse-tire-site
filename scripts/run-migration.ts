/**
 * Run migration for wheel_size_trim_mappings table
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/lib/fitment-db/db";

const migration = `
-- Wheel-Size Trim Mappings
CREATE TABLE IF NOT EXISTS wheel_size_trim_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  make VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  our_trim VARCHAR(255) NOT NULL,
  our_modification_id VARCHAR(255),
  vehicle_fitment_id UUID REFERENCES vehicle_fitments(id) ON DELETE SET NULL,
  ws_slug VARCHAR(255) NOT NULL,
  ws_generation VARCHAR(100),
  ws_modification_name VARCHAR(255),
  ws_submodel VARCHAR(255),
  ws_trim VARCHAR(255),
  ws_engine VARCHAR(255),
  ws_body VARCHAR(100),
  match_method VARCHAR(50) NOT NULL DEFAULT 'unknown',
  match_confidence VARCHAR(20) NOT NULL DEFAULT 'low',
  match_score DECIMAL(5, 4),
  config_count INTEGER NOT NULL DEFAULT 0,
  has_single_config BOOLEAN NOT NULL DEFAULT false,
  default_config_id UUID REFERENCES vehicle_fitment_configurations(id) ON DELETE SET NULL,
  default_wheel_diameter INTEGER,
  default_tire_size VARCHAR(50),
  all_wheel_diameters JSONB DEFAULT '[]',
  all_tire_sizes JSONB DEFAULT '[]',
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_reason VARCHAR(255),
  review_priority INTEGER DEFAULT 0,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT wheel_size_trim_mappings_unique UNIQUE(year, make, model, our_trim)
);

CREATE INDEX IF NOT EXISTS ws_trim_mappings_ymm_idx ON wheel_size_trim_mappings(year, make, model);
CREATE INDEX IF NOT EXISTS ws_trim_mappings_status_idx ON wheel_size_trim_mappings(status);
CREATE INDEX IF NOT EXISTS ws_trim_mappings_needs_review_idx ON wheel_size_trim_mappings(needs_review, review_priority DESC);
CREATE INDEX IF NOT EXISTS ws_trim_mappings_confidence_idx ON wheel_size_trim_mappings(match_confidence);
CREATE INDEX IF NOT EXISTS ws_trim_mappings_single_config_idx ON wheel_size_trim_mappings(has_single_config) WHERE has_single_config = true;
`;

async function main() {
  console.log("Running wheel_size_trim_mappings migration...");
  
  try {
    // Split into individual statements and run each
    const statements = migration.split(';').filter(s => s.trim().length > 0);
    
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) {
        console.log("Executing:", trimmed.substring(0, 60) + "...");
        await db.execute(sql.raw(trimmed));
      }
    }
    
    console.log("✅ Migration completed successfully!");
    
    // Verify table exists
    const result = await db.execute(sql`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'wheel_size_trim_mappings'
    `);
    console.log("Table exists:", result);
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Fatal:", err);
    process.exit(1);
  });
