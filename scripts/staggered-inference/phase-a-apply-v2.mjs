#!/usr/bin/env node
/**
 * Staggered Front/Rear Inference - PHASE A APPLY v2
 * 
 * FIXED: Uses canonical {front, rear} format, NOT [{size, axle}] objects.
 * 
 * Target platforms ONLY:
 * - Chevrolet Corvette
 * - Chevrolet Camaro
 * - Ford Mustang
 * - BMW M3
 * - BMW M4
 * - BMW M5
 * 
 * Rules:
 * - Only ≥95% confidence
 * - Snapshot before write
 * - Preserve all existing specs
 * - Use canonical staggered format: { front: "...", rear: "..." }
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

// Phase A platforms ONLY
const PHASE_A_PLATFORMS = [
  { make: 'Chevrolet', model: 'Corvette' },
  { make: 'Chevrolet', model: 'Camaro' },
  { make: 'Ford', model: 'Mustang' },
  { make: 'BMW', model: 'M3' },
  { make: 'BMW', model: 'M4' },
  { make: 'BMW', model: 'M5' },
];

// Excluded trims (dual-axle, exotic, ambiguous)
const EXCLUDED_TRIM_PATTERNS = [
  /dual/i,
  /dually/i,
  /drw/i,
  /hd$/i,
  /3500/i,
];

function isPhaseAPlatform(make, model) {
  return PHASE_A_PLATFORMS.some(p => 
    p.make.toLowerCase() === make.toLowerCase() && 
    p.model.toLowerCase() === model.toLowerCase()
  );
}

function isExcludedTrim(trim) {
  if (!trim) return false;
  return EXCLUDED_TRIM_PATTERNS.some(pattern => pattern.test(trim));
}

function isSameWidthAmbiguity(proposal) {
  // Check if front and rear have same width - ambiguous
  const frontMatch = proposal.proposedFront?.match(/^P?(\d{3})/);
  const rearMatch = proposal.proposedRear?.match(/^P?(\d{3})/);
  if (frontMatch && rearMatch) {
    return frontMatch[1] === rearMatch[1];
  }
  return false;
}

/**
 * Create canonical staggered format for DB storage.
 * 
 * CANONICAL FORMAT: { front: "245/40R19", rear: "275/35R19" }
 * 
 * This format is already supported by:
 * - normalizeOemTireSizes() in tire-sizes API
 * - extractFromStaggered() in tireSizeUtils.ts
 */
function createCanonicalStaggeredFormat(front, rear) {
  return { front, rear };
}

async function runPhaseAApplyV2(dryRun = false) {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   STAGGERED INFERENCE - PHASE A APPLY v2                     ║');
  console.log('║   Format: { front: "...", rear: "..." }                      ║');
  console.log(`║   Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE APPLY'}                              ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Load proposals from latest run
  const outputDir = resolve(__dirname, 'output');
  const files = readdirSync(outputDir).filter(f => f.startsWith('staggered-proposals-') && f.endsWith('.json'));
  if (files.length === 0) {
    console.error('❌ No proposal files found. Run inference pipeline first.');
    process.exit(1);
  }
  
  const latestFile = files.sort().pop();
  const proposalsPath = resolve(outputDir, latestFile);
  console.log(`📂 Loading proposals from: ${latestFile}`);
  
  const data = JSON.parse(readFileSync(proposalsPath, 'utf8'));
  const allProposals = data.allProposals;
  
  // Filter to Phase A candidates
  const phaseACandidates = allProposals.filter(p => {
    // Must be Phase A platform
    if (!isPhaseAPlatform(p.make, p.model)) return false;
    
    // Must have ≥95% confidence
    if (p.confidence < 95) return false;
    
    // Must have valid front/rear proposals
    if (!p.proposedFront || !p.proposedRear) return false;
    
    // Exclude dual-axle/exotic trims
    if (isExcludedTrim(p.trim)) return false;
    
    // Exclude same-width ambiguity
    if (isSameWidthAmbiguity(p)) return false;
    
    // Must not need manual review
    if (p.needsManualReview) return false;
    
    return true;
  });
  
  console.log(`\n📊 Phase A Candidates: ${phaseACandidates.length} records`);
  
  // Group by platform for reporting
  const byPlatform = {};
  for (const p of phaseACandidates) {
    const key = `${p.make} ${p.model}`;
    if (!byPlatform[key]) byPlatform[key] = [];
    byPlatform[key].push(p);
  }
  
  console.log('\n📋 Breakdown by platform:');
  for (const [platform, records] of Object.entries(byPlatform)) {
    console.log(`   ${platform}: ${records.length} records`);
  }
  
  if (dryRun) {
    console.log('\n🔍 DRY RUN - Showing sample transformations:\n');
    const samples = phaseACandidates.slice(0, 5);
    for (const p of samples) {
      const staggeredFormat = createCanonicalStaggeredFormat(p.proposedFront, p.proposedRear);
      console.log(`${p.year} ${p.make} ${p.model} ${p.trim || ''}`);
      console.log(`  Current: ${JSON.stringify(p.allTireSizes)}`);
      console.log(`  New:     ${JSON.stringify(staggeredFormat)}`);
      console.log('');
    }
    console.log('✅ Dry run complete. No changes made.');
    return { dryRun: true, candidates: phaseACandidates.length };
  }
  
  // Connect to database
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not configured');
    process.exit(1);
  }
  
  console.log('\n📡 Connecting to database...');
  const sql = postgres(connectionString);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const snapshotDir = resolve(outputDir, 'snapshots');
  mkdirSync(snapshotDir, { recursive: true });
  const snapshotPath = resolve(snapshotDir, `phase-a-v2-snapshot-${timestamp}.json`);
  
  const results = {
    timestamp,
    version: 2,
    format: '{ front, rear }',
    phaseACandidates: phaseACandidates.length,
    appliedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    applied: [],
    skipped: [],
    errors: [],
    snapshotPath,
  };
  
  try {
    // STEP 1: Snapshot all affected records BEFORE any writes
    console.log('\n📸 Creating snapshot of affected records...');
    
    const recordIds = phaseACandidates.map(p => p.id);
    const snapshot = await sql`
      SELECT *
      FROM vehicle_fitments
      WHERE id = ANY(${recordIds}::uuid[])
    `;
    
    console.log(`   Snapshotted ${snapshot.length} records`);
    
    const snapshotData = {
      timestamp,
      version: 2,
      format: '{ front, rear }',
      recordCount: snapshot.length,
      records: snapshot,
      proposalsApplied: phaseACandidates,
    };
    
    writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2));
    console.log(`   Saved to: ${snapshotPath}`);
    
    // STEP 2: Apply updates using CANONICAL format
    console.log('\n✏️  Applying staggered mappings (canonical format)...');
    
    for (const proposal of phaseACandidates) {
      try {
        // Build the CANONICAL staggered format: { front: "...", rear: "..." }
        const staggeredFormat = createCanonicalStaggeredFormat(
          proposal.proposedFront,
          proposal.proposedRear
        );
        
        // Update the record - ONLY the tire size field
        // Preserve all other fields (bolt_pattern, center_bore_mm, thread_size, seat_type, oem_wheel_sizes)
        await sql`
          UPDATE vehicle_fitments
          SET 
            oem_tire_sizes = ${sql.json(staggeredFormat)},
            updated_at = NOW()
          WHERE id = ${proposal.id}::uuid
        `;
        
        results.appliedCount++;
        results.applied.push({
          id: proposal.id,
          year: proposal.year,
          make: proposal.make,
          model: proposal.model,
          trim: proposal.trim,
          front: proposal.proposedFront,
          rear: proposal.proposedRear,
          confidence: proposal.confidence,
          format: '{ front, rear }',
        });
        
        if (results.appliedCount % 20 === 0) {
          console.log(`   Applied ${results.appliedCount}/${phaseACandidates.length}...`);
        }
        
      } catch (err) {
        results.errorCount++;
        results.errors.push({
          id: proposal.id,
          error: err.message,
        });
        console.error(`   ❌ Error on ${proposal.id}: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Applied ${results.appliedCount} records`);
    if (results.errorCount > 0) {
      console.log(`⚠️  ${results.errorCount} errors occurred`);
    }
    
  } finally {
    await sql.end();
  }
  
  // Save results
  const resultsPath = resolve(outputDir, `phase-a-v2-results-${timestamp}.json`);
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Results saved to: ${resultsPath}`);
  
  return results;
}

// Parse CLI args
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Run
runPhaseAApplyV2(dryRun).then(results => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                     PHASE A v2 COMPLETE                      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  if (results.dryRun) {
    console.log(`\n  🔍 DRY RUN: ${results.candidates} candidates would be updated`);
    console.log('  Run without --dry-run to apply changes.\n');
  } else {
    console.log(`
  ✅ Applied:  ${results.appliedCount}
  ⏭️  Skipped:  ${results.skippedCount}
  ❌ Errors:   ${results.errorCount}
  
  📸 Snapshot: ${results.snapshotPath}
  `);
  }
}).catch(err => {
  console.error('Phase A v2 failed:', err);
  process.exit(1);
});
