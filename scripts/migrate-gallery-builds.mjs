/**
 * Migration: Create gallery_builds table
 * 
 * Run with: node scripts/migrate-gallery-builds.mjs
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("❌ POSTGRES_URL not set");
  process.exit(1);
}

const queryClient = postgres(connectionString, { max: 1 });
const db = drizzle(queryClient);

async function migrate() {
  console.log("🚀 Creating gallery_builds table...\n");
  
  try {
    // Create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS gallery_builds (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(500) NOT NULL UNIQUE,
        title VARCHAR(200),
        description TEXT,
        
        -- Vehicle Info
        vehicle_year INTEGER NOT NULL,
        vehicle_make VARCHAR(100) NOT NULL,
        vehicle_model VARCHAR(100) NOT NULL,
        vehicle_trim VARCHAR(100),
        
        -- Build Specs
        build_style VARCHAR(50) NOT NULL,
        lift_level VARCHAR(50),
        
        -- Wheel Info
        wheel_brand VARCHAR(100) NOT NULL,
        wheel_model VARCHAR(100) NOT NULL,
        wheel_size VARCHAR(50) NOT NULL,
        wheel_finish VARCHAR(100),
        wheel_offset VARCHAR(20),
        wheel_bolt_pattern VARCHAR(50),
        wheel_sku VARCHAR(100),
        
        -- Tire Info
        tire_brand VARCHAR(100) NOT NULL,
        tire_model VARCHAR(100) NOT NULL,
        tire_size VARCHAR(50) NOT NULL,
        tire_sku VARCHAR(100),
        
        -- Images
        hero_image_url TEXT NOT NULL,
        additional_images JSONB DEFAULT '[]',
        
        -- Metadata & Flags
        tags JSONB DEFAULT '[]',
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_popular BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        display_order INTEGER DEFAULT 1000,
        
        -- Source Attribution
        source_type VARCHAR(50),
        source_attribution VARCHAR(200),
        
        -- Timestamps
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log("✅ Created gallery_builds table");
    
    // Create indexes
    console.log("\n📊 Creating indexes...");
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS gb_slug_idx ON gallery_builds(slug)
    `);
    console.log("  ✅ gb_slug_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_active_idx ON gallery_builds(is_active)
    `);
    console.log("  ✅ gb_active_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_featured_idx ON gallery_builds(is_featured, is_active)
    `);
    console.log("  ✅ gb_featured_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_popular_idx ON gallery_builds(is_popular, is_active)
    `);
    console.log("  ✅ gb_popular_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_vehicle_make_idx ON gallery_builds(vehicle_make)
    `);
    console.log("  ✅ gb_vehicle_make_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_vehicle_model_idx ON gallery_builds(vehicle_make, vehicle_model)
    `);
    console.log("  ✅ gb_vehicle_model_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_build_style_idx ON gallery_builds(build_style)
    `);
    console.log("  ✅ gb_build_style_idx");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS gb_display_order_idx ON gallery_builds(display_order, created_at)
    `);
    console.log("  ✅ gb_display_order_idx");
    
    console.log("\n✅ Migration complete!");
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

migrate();
