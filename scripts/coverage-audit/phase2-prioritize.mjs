/**
 * Phase 2: Revenue-Based Prioritization
 * 
 * Uses fitment gap alerts (search attempts for missing vehicles)
 * to prioritize which vehicles to add first.
 * 
 * @created 2026-06-12
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';
const OUTPUT_DIR = './scripts/coverage-audit/reports';

async function fetchFitmentGaps() {
  // This endpoint returns vehicles people searched for but we don't have
  const url = `${BASE_URL}/api/admin/fitment-gaps/alerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch gaps: ${res.status}`);
  return await res.json();
}

async function fetchJakeAnalytics() {
  // Jake AI conversation analytics - shows what vehicles people ask about
  try {
    const url = `${BASE_URL}/api/admin/jake-analytics`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function aggregateByVehicle(alerts) {
  const byVehicle = new Map();
  
  for (const alert of alerts) {
    // Parse "2023 mazda mazda6" format
    const match = alert.vehicle?.match(/^(\d{4})\s+(\w+)\s+(.+)$/i);
    if (!match) continue;
    
    const [, year, make, model] = match;
    const key = `${make.toLowerCase()}:${model.toLowerCase()}`;
    
    if (!byVehicle.has(key)) {
      byVehicle.set(key, {
        make: make.charAt(0).toUpperCase() + make.slice(1).toLowerCase(),
        model: model.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
        years: new Set(),
        totalHits: 0,
        maxPriority: 0,
        alerts: [],
      });
    }
    
    const v = byVehicle.get(key);
    v.years.add(parseInt(year));
    v.totalHits += alert.occurrenceCount || 1;
    v.maxPriority = Math.max(v.maxPriority, alert.priorityScore || 0);
    v.alerts.push(alert);
  }
  
  return byVehicle;
}

function calculatePriorityScore(vehicle) {
  // Priority = (total search hits) × (number of missing years) × (recency bonus)
  const yearCount = vehicle.years.size;
  const recentYears = [...vehicle.years].filter(y => y >= 2020).length;
  const recencyBonus = 1 + (recentYears * 0.2);
  
  return Math.round(vehicle.totalHits * yearCount * recencyBonus);
}

async function runPrioritization() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('WTD COVERAGE PRIORITIZATION - Phase 2');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`Started: ${new Date().toISOString()}`);
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Fetch gap alerts
  console.log('\nFetching fitment gap alerts...');
  const gapsData = await fetchFitmentGaps();
  
  console.log(`Total alerts: ${gapsData.stats?.totalAlerts || 0}`);
  console.log(`High priority: ${gapsData.stats?.highPriorityAlerts || 0}`);
  
  // Aggregate by vehicle
  const allAlerts = gapsData.recentAlerts || [];
  const byVehicle = aggregateByVehicle(allAlerts);
  
  // Calculate priority scores
  const prioritized = [];
  for (const [key, vehicle] of byVehicle) {
    vehicle.priorityScore = calculatePriorityScore(vehicle);
    vehicle.yearsList = [...vehicle.years].sort((a, b) => b - a);
    prioritized.push(vehicle);
  }
  
  // Sort by priority score descending
  prioritized.sort((a, b) => b.priorityScore - a.priorityScore);
  
  // Tier assignment
  const tier1 = prioritized.slice(0, 20);
  const tier2 = prioritized.slice(20, 70);
  const tier3 = prioritized.slice(70);
  
  // Output
  const results = {
    timestamp: new Date().toISOString(),
    stats: gapsData.stats,
    tier1: tier1.map(v => ({
      make: v.make,
      model: v.model,
      years: v.yearsList.join(', '),
      searchHits: v.totalHits,
      priorityScore: v.priorityScore,
    })),
    tier2: tier2.map(v => ({
      make: v.make,
      model: v.model,
      years: v.yearsList.join(', '),
      searchHits: v.totalHits,
      priorityScore: v.priorityScore,
    })),
    tier3Count: tier3.length,
    allVehicles: prioritized.map(v => ({
      make: v.make,
      model: v.model,
      years: v.yearsList.join(', '),
      searchHits: v.totalHits,
      priorityScore: v.priorityScore,
    })),
  };
  
  // Save JSON
  const jsonPath = path.join(OUTPUT_DIR, 'prioritized-vehicles.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  
  // Save CSV
  const csvLines = [
    'Priority,Make,Model,Years,SearchHits,Score',
    ...prioritized.map((v, i) => 
      `${i + 1},${v.make},${v.model},"${v.yearsList.join(', ')}",${v.totalHits},${v.priorityScore}`
    ),
  ];
  const csvPath = path.join(OUTPUT_DIR, 'prioritized-vehicles.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  
  // Print summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TIER 1 - HIGHEST ROI (Top 20)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const v of tier1) {
    console.log(`  ${v.make} ${v.model}`);
    console.log(`    Years: ${v.yearsList.join(', ')}`);
    console.log(`    Search hits: ${v.totalHits} | Priority: ${v.priorityScore}`);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('TIER 2 - HIGH DEMAND (Next 50)');
  console.log('═══════════════════════════════════════════════════════════════');
  for (const v of tier2.slice(0, 10)) {
    console.log(`  ${v.make} ${v.model} (${v.yearsList.join(', ')}) - ${v.totalHits} hits`);
  }
  if (tier2.length > 10) {
    console.log(`  ... and ${tier2.length - 10} more`);
  }
  
  console.log(`\nTier 3 (long-tail): ${tier3.length} vehicles`);
  console.log(`\nReports saved to: ${OUTPUT_DIR}`);
  
  return results;
}

runPrioritization().catch(err => {
  console.error('Prioritization failed:', err);
  process.exit(1);
});
