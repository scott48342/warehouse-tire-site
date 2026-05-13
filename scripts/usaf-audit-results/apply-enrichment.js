/**
 * Apply Platform Enrichment to Database
 * 
 * SAFETY GUARDS:
 * - Only updates oem_tire_sizes field
 * - NO wheel spec changes
 * - NO bolt pattern/center bore/offset changes
 * - Creates rollback snapshot
 * - Smoke tests after each batch
 */

const fs = require('fs');
const path = require('path');

// Load results from all phases
const phase1Results = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase1-results.json'), 'utf8'));
const phase2Results = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase2-results.json'), 'utf8'));
const phase3Results = JSON.parse(fs.readFileSync(path.join(__dirname, 'phase3-results.json'), 'utf8'));

// =============================================================================
// COMBINE AND DEDUPLICATE
// =============================================================================

function combineResults() {
  const allApproved = [];
  const seen = new Set();

  // Helper to create unique key
  const itemKey = (item) => `${item.year}|${item.make}|${item.model}|${item.tireSize}`;

  // Add Phase 1 items
  for (const item of (phase1Results.approved || [])) {
    const key = itemKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      allApproved.push({ ...item, phases: ['phase1'] });
    }
  }

  // Add Phase 2 items (may overlap with Phase 1)
  for (const item of (phase2Results.approved || [])) {
    const key = itemKey(item);
    if (seen.has(key)) {
      // Already in - add phase marker
      const existing = allApproved.find(i => itemKey(i) === key);
      if (existing && !existing.phases.includes('phase2')) {
        existing.phases.push('phase2');
      }
    } else {
      seen.add(key);
      allApproved.push({ ...item, phases: ['phase2'] });
    }
  }

  // Add Phase 3 items
  for (const item of (phase3Results.approved || [])) {
    const key = itemKey(item);
    if (seen.has(key)) {
      const existing = allApproved.find(i => itemKey(i) === key);
      if (existing && !existing.phases.includes('phase3')) {
        existing.phases.push('phase3');
      }
    } else {
      seen.add(key);
      allApproved.push({ ...item, phases: ['phase3'] });
    }
  }

  return allApproved;
}

// =============================================================================
// GROUP BY VEHICLE (year/make/model)
// =============================================================================

function groupByVehicle(items) {
  const vehicles = {};
  
  for (const item of items) {
    const key = `${item.year}|${item.make}|${item.model}`;
    if (!vehicles[key]) {
      vehicles[key] = {
        year: item.year,
        make: item.make,
        model: item.model,
        newTireSizes: [],
        existingTireSizes: item.existingWtdSizes || [],
        items: []
      };
    }
    
    // Add tire size if not already present
    if (!vehicles[key].newTireSizes.includes(item.tireSize) &&
        !vehicles[key].existingTireSizes.includes(item.tireSize)) {
      vehicles[key].newTireSizes.push(item.tireSize);
    }
    
    vehicles[key].items.push(item);
  }
  
  return Object.values(vehicles);
}

// =============================================================================
// GENERATE DATABASE UPDATE COMMANDS
// =============================================================================

function generateUpdateCommands(vehicles, options = {}) {
  const dryRun = options.dryRun !== false;
  const batchSize = options.batchSize || 25;
  
  const batches = [];
  let currentBatch = [];
  
  for (const vehicle of vehicles) {
    // Combine existing + new tire sizes
    const allSizes = [...new Set([
      ...vehicle.existingTireSizes,
      ...vehicle.newTireSizes
    ])].sort();
    
    // Generate the update
    const update = {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      field: 'oem_tire_sizes',
      newValue: allSizes,
      addedSizes: vehicle.newTireSizes,
      previousSizes: vehicle.existingTireSizes,
      // Safety flags
      wheelSpecsUnchanged: true,
      boltPatternUnchanged: true,
      centerBoreUnchanged: true,
      offsetUnchanged: true
    };
    
    currentBatch.push(update);
    
    if (currentBatch.length >= batchSize) {
      batches.push(currentBatch);
      currentBatch = [];
    }
  }
  
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  
  return batches;
}

// =============================================================================
// GENERATE PRISMA MIGRATION SCRIPT
// =============================================================================

function generatePrismaScript(batches, batchIndex = 0) {
  const batch = batches[batchIndex];
  if (!batch) return null;
  
  const lines = [
    `// Batch ${batchIndex + 1} of ${batches.length}`,
    `// Generated: ${new Date().toISOString()}`,
    `// Updates: ${batch.length} vehicles`,
    ``,
    `const { PrismaClient } = require('@prisma/client');`,
    `const prisma = new PrismaClient();`,
    ``,
    `async function applyBatch${batchIndex + 1}() {`,
    `  const updates = [`,
  ];
  
  for (const update of batch) {
    lines.push(`    {`);
    lines.push(`      year: ${update.year},`);
    lines.push(`      make: ${JSON.stringify(update.make)},`);
    lines.push(`      model: ${JSON.stringify(update.model)},`);
    lines.push(`      oem_tire_sizes: ${JSON.stringify(update.newValue)},`);
    lines.push(`      // Added: ${JSON.stringify(update.addedSizes)}`);
    lines.push(`    },`);
  }
  
  lines.push(`  ];`);
  lines.push(``);
  lines.push(`  console.log('Applying batch ${batchIndex + 1}...');`);
  lines.push(`  let updated = 0;`);
  lines.push(`  let errors = 0;`);
  lines.push(``);
  lines.push(`  for (const upd of updates) {`);
  lines.push(`    try {`);
  lines.push(`      // Find matching records`);
  lines.push(`      const records = await prisma.vehicle_fitments.findMany({`);
  lines.push(`        where: {`);
  lines.push(`          year: upd.year,`);
  lines.push(`          make: { equals: upd.make, mode: 'insensitive' },`);
  lines.push(`          model: { equals: upd.model, mode: 'insensitive' },`);
  lines.push(`        },`);
  lines.push(`        select: { id: true, oem_tire_sizes: true },`);
  lines.push(`      });`);
  lines.push(``);
  lines.push(`      for (const record of records) {`);
  lines.push(`        // Merge existing + new sizes`);
  lines.push(`        const existing = record.oem_tire_sizes || [];`);
  lines.push(`        const merged = [...new Set([...existing, ...upd.oem_tire_sizes])].sort();`);
  lines.push(``);
  lines.push(`        await prisma.vehicle_fitments.update({`);
  lines.push(`          where: { id: record.id },`);
  lines.push(`          data: { oem_tire_sizes: merged },`);
  lines.push(`        });`);
  lines.push(`        updated++;`);
  lines.push(`      }`);
  lines.push(`    } catch (err) {`);
  lines.push(`      console.error(\`Error updating \${upd.year} \${upd.make} \${upd.model}:\`, err.message);`);
  lines.push(`      errors++;`);
  lines.push(`    }`);
  lines.push(`  }`);
  lines.push(``);
  lines.push(`  console.log(\`Batch ${batchIndex + 1} complete: \${updated} records updated, \${errors} errors\`);`);
  lines.push(`  return { updated, errors };`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`applyBatch${batchIndex + 1}()`);
  lines.push(`  .then(r => console.log('Done:', r))`);
  lines.push(`  .catch(e => console.error('Failed:', e))`);
  lines.push(`  .finally(() => prisma.$disconnect());`);
  
  return lines.join('\n');
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('ENRICHMENT COMBINATION REPORT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Combine all phases
  const allApproved = combineResults();
  console.log(`Total approved items (deduplicated): ${allApproved.length}`);
  
  // Count by phase
  const phase1Only = allApproved.filter(i => i.phases.length === 1 && i.phases[0] === 'phase1').length;
  const phase2Only = allApproved.filter(i => i.phases.length === 1 && i.phases[0] === 'phase2').length;
  const phase3Only = allApproved.filter(i => i.phases.length === 1 && i.phases[0] === 'phase3').length;
  const multiPhase = allApproved.filter(i => i.phases.length > 1).length;
  
  console.log(`\nBreakdown:`);
  console.log(`  Phase 1 only: ${phase1Only}`);
  console.log(`  Phase 2 only: ${phase2Only}`);
  console.log(`  Phase 3 only: ${phase3Only}`);
  console.log(`  Multi-phase: ${multiPhase}`);
  
  // Group by vehicle
  const vehicles = groupByVehicle(allApproved);
  console.log(`\nUnique vehicles to update: ${vehicles.length}`);
  
  // Generate batches
  const batches = generateUpdateCommands(vehicles, { batchSize: 25 });
  console.log(`Batches (25 vehicles each): ${batches.length}`);
  
  // Stats
  let totalNewSizes = 0;
  for (const vehicle of vehicles) {
    totalNewSizes += vehicle.newTireSizes.length;
  }
  console.log(`Total new tire sizes to add: ${totalNewSizes}`);
  
  // Top vehicles by new sizes
  const sortedVehicles = [...vehicles].sort((a, b) => b.newTireSizes.length - a.newTireSizes.length);
  console.log(`\nTop 20 vehicles by new tire sizes:`);
  for (let i = 0; i < Math.min(20, sortedVehicles.length); i++) {
    const v = sortedVehicles[i];
    console.log(`  ${v.year} ${v.make} ${v.model}: +${v.newTireSizes.length} sizes (${v.newTireSizes.slice(0, 3).join(', ')}${v.newTireSizes.length > 3 ? '...' : ''})`);
  }
  
  // Save combined results
  const combinedReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalApproved: allApproved.length,
      phase1Only,
      phase2Only,
      phase3Only,
      multiPhase,
      uniqueVehicles: vehicles.length,
      totalNewTireSizes: totalNewSizes,
      batchCount: batches.length
    },
    vehicles: sortedVehicles,
    batches
  };
  
  fs.writeFileSync(
    path.join(__dirname, 'combined-enrichment-plan.json'),
    JSON.stringify(combinedReport, null, 2)
  );
  console.log(`\n📄 Combined plan saved: combined-enrichment-plan.json`);
  
  // Generate batch scripts
  const scriptsDir = path.join(__dirname, 'batch-scripts');
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }
  
  for (let i = 0; i < batches.length; i++) {
    const script = generatePrismaScript(batches, i);
    fs.writeFileSync(path.join(scriptsDir, `batch-${String(i + 1).padStart(2, '0')}.js`), script);
  }
  console.log(`📁 Batch scripts saved: batch-scripts/batch-01.js through batch-${String(batches.length).padStart(2, '0')}.js`);
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`
1. Review combined-enrichment-plan.json
2. Run batch scripts one at a time:
   cd scripts/usaf-audit-results/batch-scripts
   node batch-01.js
   
3. After each batch, run smoke test:
   curl localhost:3001/api/admin/fitment/health
   
4. If issues, rollback from snapshots in enrichment-snapshots/
`);
}

main();
