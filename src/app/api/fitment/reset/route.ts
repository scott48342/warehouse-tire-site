import { NextResponse } from "next/server";
import { getPool } from "@/lib/vehicleFitment";

export const runtime = "nodejs";

/**
 * POST /api/fitment/reset
 * Drop and recreate fitment tables (use with caution!)
 */
export async function POST(req: Request) {
  try {
    const db = getPool();
    
    // Drop existing tables
    await db.query(`
      DROP TABLE IF EXISTS vehicle_wheel_specs CASCADE;
      DROP TABLE IF EXISTS vehicle_fitment CASCADE;
      DROP TABLE IF EXISTS vehicles CASCADE;
    `);
    
    // Recreate tables with correct schema
    await db.query(`
      CREATE TABLE vehicles (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        trim VARCHAR(100),
        slug VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(year, make, model, trim)
      );

      CREATE TABLE vehicle_fitment (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        bolt_pattern VARCHAR(20) NOT NULL,
        center_bore DECIMAL(6,2) NOT NULL,
        stud_holes INTEGER NOT NULL,
        pcd DECIMAL(6,2) NOT NULL,
        thread_size VARCHAR(20),
        fastener_type VARCHAR(20),
        torque_nm INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(vehicle_id)
      );

      CREATE TABLE vehicle_wheel_specs (
        id SERIAL PRIMARY KEY,
        vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
        rim_diameter DECIMAL(4,1) NOT NULL,
        rim_width DECIMAL(4,2) NOT NULL,
        "offset" INTEGER NOT NULL,
        tire_size VARCHAR(30),
        is_stock BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_vehicles_year_make_model ON vehicles(year, make, model);
      CREATE INDEX idx_vehicle_wheel_specs_vehicle_id ON vehicle_wheel_specs(vehicle_id);
    `);

    return NextResponse.json({ success: true, message: "Fitment tables recreated" });
  } catch (err: any) {
    console.error("[fitment/reset] Error:", err);
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
