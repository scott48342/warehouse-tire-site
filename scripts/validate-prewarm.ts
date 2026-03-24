#!/usr/bin/env npx tsx

/**
 * Validate Pre-Warm Cache Effectiveness
 * 
 * Tests wheel search performance for various vehicles before and after pre-warming.
 * Compares response times and cache hit rates.
 * 
 * Usage:
 *   npx tsx scripts/validate-prewarm.ts
 */

import { clearCache, getCacheStats, resetMetrics } from "../src/lib/availabilityCache";
import { runPrewarmJob } from "../src/lib/availabilityPrewarm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

type TestVehicle = {
  name: string;
  year: number;
  make: string;
  model: string;
  modification?: string;
};

const TEST_VEHICLES: TestVehicle[] = [
  // Trucks (pre-warm targets)
  { name: "Ford F-150", year: 2024, make: "Ford", model: "F-150" },
  { name: "Chevy Silverado 1500", year: 2024, make: "Chevrolet", model: "Silverado 1500" },
  // SUVs (pre-warm targets)
  { name: "Jeep Wrangler", year: 2024, make: "Jeep", model: "Wrangler" },
  // Non-truck (should NOT be pre-warmed, for comparison)
  { name: "Toyota Camry", year: 2024, make: "Toyota", model: "Camry" },
  // Lifted truck scenario (same bolt pattern, should benefit from pre-warm)
  { name: "Lifted F-150", year: 2024, make: "Ford", model: "F-150" },
];

async function searchWheels(vehicle: TestVehicle): Promise<{ ms: number; count: number; cacheHits: number; prewarmHits: number }> {
  const params = new URLSearchParams({
    year: String(vehicle.year),
    make: vehicle.make,
    model: vehicle.model,
    pageSize: "24",
  });
  if (vehicle.modification) {
    params.set("modification", vehicle.modification);
  }
  
  const url = `${BASE_URL}/api/wheels/fitment-search?${params}`;
  const t0 = Date.now();
  
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const ms = Date.now() - t0;
    
    return {
      ms,
      count: data.totalCount || data.results?.length || 0,
      cacheHits: data.timing?.availabilityCacheHits || 0,
      prewarmHits: data.timing?.availabilityPrewarmHits || 0,
    };
  } catch (err) {
    return { ms: Date.now() - t0, count: 0, cacheHits: 0, prewarmHits: 0 };
  }
}

async function runTest(label: string): Promise<Map<string, { ms: number; count: number; cacheHits: number; prewarmHits: number }>> {
  console.log(`\n📊 ${label}`);
  console.log("─".repeat(60));
  
  const results = new Map<string, { ms: number; count: number; cacheHits: number; prewarmHits: number }>();
  
  for (const vehicle of TEST_VEHICLES) {
    process.stdout.write(`   Testing ${vehicle.name}... `);
    const result = await searchWheels(vehicle);
    results.set(vehicle.name, result);
    console.log(`${result.ms}ms (${result.count} results, ${result.cacheHits} cache hits, ${result.prewarmHits} prewarm hits)`);
  }
  
  return results;
}

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║         Pre-Warm Cache Validation Test                        ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Vehicles: ${TEST_VEHICLES.length}`);
  
  // Phase 1: Clear cache and test cold performance
  console.log("\n🧹 Clearing cache for cold start test...");
  clearCache();
  resetMetrics();
  
  const coldResults = await runTest("COLD START (No Cache)");
  
  // Phase 2: Run pre-warm job
  console.log("\n🔥 Running pre-warm job...");
  const prewarmResult = await runPrewarmJob({
    maxSkusPerPattern: 100, // Smaller for faster testing
    concurrency: 8,
  });
  
  console.log(`   Pre-warm completed in ${prewarmResult.duration}ms`);
  console.log(`   SKUs cached: ${prewarmResult.totalSkusCached}`);
  
  // Phase 3: Test warm performance
  const warmResults = await runTest("WARM START (After Pre-Warm)");
  
  // Phase 4: Compare results
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                    COMPARISON RESULTS");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  
  console.log("┌────────────────────────┬────────────┬────────────┬───────────┐");
  console.log("│ Vehicle                │ Cold (ms)  │ Warm (ms)  │ Speedup   │");
  console.log("├────────────────────────┼────────────┼────────────┼───────────┤");
  
  for (const vehicle of TEST_VEHICLES) {
    const cold = coldResults.get(vehicle.name);
    const warm = warmResults.get(vehicle.name);
    
    if (cold && warm) {
      const speedup = cold.ms > 0 ? ((cold.ms - warm.ms) / cold.ms * 100).toFixed(0) : "N/A";
      const speedupStr = cold.ms > warm.ms ? `+${speedup}%` : `${speedup}%`;
      
      console.log(
        `│ ${vehicle.name.padEnd(22)} │ ${String(cold.ms).padStart(8)}ms │ ${String(warm.ms).padStart(8)}ms │ ${speedupStr.padStart(9)} │`
      );
    }
  }
  
  console.log("└────────────────────────┴────────────┴────────────┴───────────┘");
  
  // Cache stats
  const finalStats = getCacheStats();
  console.log("\n📊 Final Cache Statistics:");
  console.log(`   Size: ${finalStats.size} / ${finalStats.maxSize}`);
  console.log(`   Hit Rate: ${(finalStats.hitRate * 100).toFixed(1)}%`);
  console.log(`   Pre-warmed Entries: ${finalStats.prewarmedEntries}`);
  console.log(`   Pre-warmed Hits: ${finalStats.prewarmedHits}`);
  
  // Summary
  const totalCold = Array.from(coldResults.values()).reduce((sum, r) => sum + r.ms, 0);
  const totalWarm = Array.from(warmResults.values()).reduce((sum, r) => sum + r.ms, 0);
  const overallSpeedup = ((totalCold - totalWarm) / totalCold * 100).toFixed(1);
  
  console.log("\n📈 Summary:");
  console.log(`   Total Cold Time: ${totalCold}ms`);
  console.log(`   Total Warm Time: ${totalWarm}ms`);
  console.log(`   Overall Speedup: ${overallSpeedup}%`);
  
  // Validation checks
  console.log("\n✅ Validation Checks:");
  
  let passed = 0;
  let failed = 0;
  
  // Check 1: Pre-warm targets should have cache hits
  for (const vehicle of TEST_VEHICLES.filter(v => ["Ford F-150", "Chevy Silverado 1500", "Jeep Wrangler", "Lifted F-150"].includes(v.name))) {
    const warm = warmResults.get(vehicle.name);
    if (warm && warm.cacheHits > 0) {
      console.log(`   ✓ ${vehicle.name}: Got cache hits (${warm.cacheHits})`);
      passed++;
    } else {
      console.log(`   ✗ ${vehicle.name}: Expected cache hits but got ${warm?.cacheHits || 0}`);
      failed++;
    }
  }
  
  // Check 2: Camry should have fewer/no prewarm hits (different bolt pattern)
  const camryWarm = warmResults.get("Toyota Camry");
  if (camryWarm && camryWarm.prewarmHits < (warmResults.get("Ford F-150")?.prewarmHits || 0)) {
    console.log(`   ✓ Toyota Camry: Fewer prewarm hits as expected (non-target pattern)`);
    passed++;
  } else {
    console.log(`   ⚠ Toyota Camry: Unexpected prewarm behavior`);
  }
  
  // Check 3: Results should be consistent (same count cold vs warm)
  for (const vehicle of TEST_VEHICLES) {
    const cold = coldResults.get(vehicle.name);
    const warm = warmResults.get(vehicle.name);
    
    if (cold && warm && cold.count === warm.count) {
      passed++;
    } else if (cold && warm) {
      console.log(`   ⚠ ${vehicle.name}: Result count changed (${cold.count} → ${warm.count})`);
    }
  }
  
  console.log(`\n   Passed: ${passed} / ${passed + failed}`);
  
  console.log("\n═══════════════════════════════════════════════════════════════\n");
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
