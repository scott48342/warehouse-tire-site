/**
 * POST /api/admin/classic-normalize
 * 
 * One-time migration to normalize classic diameter ranges to 15-20"
 */

import { NextResponse } from "next/server";
import { Pool } from "pg";

export const runtime = "nodejs";

const TARGET_MIN = 15;
const TARGET_MAX = 20;

async function getPool() {
  return new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });
}

export async function POST() {
  const pool = await getPool();
  
  try {
    // Get before state
    const beforeResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments 
      WHERE is_active = true
    `);

    // Update all classic platforms to 15-20"
    await pool.query(`
      UPDATE classic_fitments 
      SET 
        rec_wheel_diameter_min = $1,
        rec_wheel_diameter_max = $2,
        updated_at = NOW()
      WHERE platform_code IN (
        'ford-mustang-1gen',
        'gm-a-body-2',
        'mopar-e-body',
        'mopar-b-body',
        'gm-f-body-2',
        'gm-f-body-1'
      ) AND is_active = true
    `, [TARGET_MIN, TARGET_MAX]);

    // Get after state
    const afterResult = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments 
      WHERE is_active = true
    `);

    await pool.end();

    return NextResponse.json({
      success: true,
      targetRange: `${TARGET_MIN}-${TARGET_MAX}`,
      before: beforeResult.rows,
      after: afterResult.rows,
    });
  } catch (err: any) {
    await pool.end();
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  const pool = await getPool();
  
  try {
    const result = await pool.query(`
      SELECT DISTINCT platform_code, platform_name, rec_wheel_diameter_min, rec_wheel_diameter_max 
      FROM classic_fitments 
      WHERE is_active = true
      ORDER BY platform_name
    `);

    await pool.end();

    return NextResponse.json({
      targetRange: `${TARGET_MIN}-${TARGET_MAX}`,
      platforms: result.rows.map(r => ({
        ...r,
        needsUpdate: r.rec_wheel_diameter_min !== TARGET_MIN || r.rec_wheel_diameter_max !== TARGET_MAX,
      })),
    });
  } catch (err: any) {
    await pool.end();
    return NextResponse.json(
      { error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
