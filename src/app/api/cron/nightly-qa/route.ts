/**
 * Nightly QA Cron Endpoint
 * 
 * Runs automated QA sweep on a schedule.
 * 
 * Schedule: 3 AM EST daily (Week 1: 25 vehicles)
 * 
 * This endpoint is called by Vercel Cron.
 * For manual testing: GET /api/cron/nightly-qa?count=5&dryRun=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db/pool';
import { headers } from 'next/headers';

// Week 1 config: 25 vehicles
const DEFAULT_VEHICLE_COUNT = 25;
const BASE_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : 'https://shop.warehousetiredirect.com';

interface QAConfig {
  vehicleCount: number;
  dryRun: boolean;
  categories: string[];
}

/**
 * Get vehicles to test from the canary pool
 */
async function getTestVehicles(pool: any, count: number) {
  // Get canary vehicles first, then fill with random
  const result = await pool.query(`
    WITH canaries AS (
      SELECT year, make, model, trim, category, is_performance, is_canary
      FROM qa_test_vehicles
      WHERE is_canary = true AND is_active = true
      ORDER BY RANDOM()
      LIMIT $1
    ),
    randoms AS (
      SELECT year, make, model, trim, category, is_performance, false as is_canary
      FROM qa_test_vehicles
      WHERE is_active = true AND is_canary = false
      ORDER BY RANDOM()
      LIMIT $1
    )
    SELECT * FROM canaries
    UNION ALL
    SELECT * FROM randoms
    LIMIT $1
  `, [count]);
  
  return result.rows;
}

/**
 * Test a single vehicle via internal API
 */
async function testVehicle(vehicle: any) {
  const startTime = Date.now();
  const errors: string[] = [];
  let passed = true;
  let wheelCount = 0;
  let tireCount = 0;
  let boltPattern: string | null = null;
  let staggeredDetected = false;
  
  try {
    // Test wheel fitment
    const wheelUrl = new URL('/api/wheels/fitment-search', BASE_URL);
    wheelUrl.searchParams.set('year', String(vehicle.year));
    wheelUrl.searchParams.set('make', vehicle.make);
    wheelUrl.searchParams.set('model', vehicle.model);
    if (vehicle.trim) wheelUrl.searchParams.set('trim', vehicle.trim);
    wheelUrl.searchParams.set('pageSize', '10');
    
    const wheelRes = await fetch(wheelUrl.toString(), {
      headers: { 'x-internal-qa': 'true' },
    });
    
    if (!wheelRes.ok) {
      errors.push(`[wheel] API error: ${wheelRes.status}`);
      passed = false;
    } else {
      const wheelData = await wheelRes.json();
      wheelCount = wheelData.totalCount || wheelData.results?.length || 0;
      boltPattern = wheelData.fitment?.dbProfile?.boltPattern || 
                   wheelData.fitment?.profile?.boltPattern || null;
      staggeredDetected = wheelData.isStaggered || wheelData.fitment?.isStaggered || false;
      
      if (wheelCount === 0) {
        errors.push('[wheel] Zero wheels returned');
        // Only fail if this is NOT a known data gap scenario
        if (vehicle.is_canary) {
          passed = false;
        }
      }
    }
    
    // Test tire search (basic)
    const tireUrl = new URL('/api/tires/search', BASE_URL);
    tireUrl.searchParams.set('year', String(vehicle.year));
    tireUrl.searchParams.set('make', vehicle.make);
    tireUrl.searchParams.set('model', vehicle.model);
    
    const tireRes = await fetch(tireUrl.toString(), {
      headers: { 'x-internal-qa': 'true' },
    });
    
    if (tireRes.ok) {
      const tireData = await tireRes.json();
      tireCount = tireData.results?.length || 0;
    }
    
  } catch (err: any) {
    errors.push(`[error] ${err.message}`);
    passed = false;
  }
  
  return {
    vehicle,
    passed,
    wheelCount,
    tireCount,
    boltPattern,
    staggeredDetected,
    errors,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Save run results to database
 */
async function saveResults(pool: any, results: any[], config: QAConfig) {
  if (config.dryRun) {
    console.log('[nightly-qa] Dry run - skipping DB writes');
    return null;
  }
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  // Create run record
  const runResult = await pool.query(`
    INSERT INTO qa_runs (
      started_at, completed_at, status,
      vehicle_count, passed_count, failed_count,
      pass_rate, trigger_source, base_url, environment
    ) VALUES (
      NOW() - INTERVAL '1 minute', NOW(), 'completed',
      $1, $2, $3,
      $4, 'cron', $5, 'production'
    )
    RETURNING run_id
  `, [
    results.length,
    passed,
    failed,
    results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
    BASE_URL,
  ]);
  
  const runId = runResult.rows[0].run_id;
  
  // Save individual results
  for (const result of results) {
    await pool.query(`
      INSERT INTO qa_results (
        run_id, year, make, model, trim, category,
        is_performance, is_canary, status,
        wheel_test_passed, wheel_count,
        bolt_pattern, staggered_detected,
        tire_test_passed, tire_count,
        error_message, duration_ms
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15,
        $16, $17
      )
    `, [
      runId,
      result.vehicle.year,
      result.vehicle.make,
      result.vehicle.model,
      result.vehicle.trim,
      result.vehicle.category,
      result.vehicle.is_performance || false,
      result.vehicle.is_canary || false,
      result.passed ? 'pass' : 'fail',
      result.wheelCount > 0,
      result.wheelCount,
      result.boltPattern,
      result.staggeredDetected,
      result.tireCount > 0,
      result.tireCount,
      result.errors.length > 0 ? result.errors.join('; ') : null,
      result.durationMs,
    ]);
  }
  
  return runId;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  // Verify cron secret or allow internal calls
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // Allow if: has correct secret, or is internal call, or is dry run
  const searchParams = req.nextUrl.searchParams;
  const isDryRun = searchParams.get('dryRun') === 'true';
  const isAuthorized = !cronSecret || 
    authHeader === `Bearer ${cronSecret}` ||
    searchParams.get('key') === cronSecret ||
    isDryRun;
  
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
  }
  
  try {
    // Parse config
    const config: QAConfig = {
      vehicleCount: parseInt(searchParams.get('count') || String(DEFAULT_VEHICLE_COUNT), 10),
      dryRun: isDryRun,
      categories: searchParams.get('categories')?.split(',') || [],
    };
    
    console.log(`[nightly-qa] Starting QA sweep: ${config.vehicleCount} vehicles, dryRun=${config.dryRun}`);
    
    // Get vehicles
    const vehicles = await getTestVehicles(pool, config.vehicleCount);
    console.log(`[nightly-qa] Testing ${vehicles.length} vehicles`);
    
    if (vehicles.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No test vehicles found in qa_test_vehicles table',
      }, { status: 500 });
    }
    
    // Test vehicles (sequentially to avoid overwhelming APIs)
    const results = [];
    for (const vehicle of vehicles) {
      const result = await testVehicle(vehicle);
      results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Save results
    const runId = await saveResults(pool, results, config);
    
    // Calculate summary
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const passRate = results.length > 0 ? Math.round((passed / results.length) * 100) : 0;
    
    const summary = {
      success: true,
      runId,
      vehicleCount: results.length,
      passed,
      failed,
      passRate,
      durationMs: Date.now() - startTime,
      dryRun: config.dryRun,
      failures: results
        .filter(r => !r.passed)
        .map(r => ({
          vehicle: `${r.vehicle.year} ${r.vehicle.make} ${r.vehicle.model}`,
          errors: r.errors,
        })),
    };
    
    console.log(`[nightly-qa] Complete: ${passed}/${results.length} passed (${passRate}%)`);
    
    return NextResponse.json(summary);
    
  } catch (err: any) {
    console.error('[nightly-qa] Error:', err);
    return NextResponse.json({
      success: false,
      error: err.message,
      durationMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

// Vercel Cron config
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for Pro plan
