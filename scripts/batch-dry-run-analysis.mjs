#!/usr/bin/env node
/**
 * Batch Dry-Run Analysis for Config-Table Enrichment
 * 
 * Analyzes all vehicles needing enrichment and produces detailed report
 * for review before promotion.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Vehicles identified as needing enrichment from batch analysis
const NEEDS_ENRICHMENT_VEHICLES = [
  { year: 2024, make: "Acura", model: "mdx" },
  { year: 2024, make: "Chevrolet", model: "tahoe" },
  { year: 2024, make: "Chevrolet", model: "traverse" },
  { year: 2024, make: "GMC", model: "Sierra 1500" },
  { year: 2024, make: "Kia", model: "sportage" },
  { year: 2024, make: "Nissan", model: "pathfinder" },
  { year: 2024, make: "Toyota", model: "Tacoma" },
  { year: 2024, make: "Volkswagen", model: "atlas" },
  { year: 2025, make: "Acura", model: "mdx" },
  { year: 2026, make: "Acura", model: "mdx" },
];

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function analyzeVehicle(vehicle) {
  const { year, make, model } = vehicle;
  const params = new URLSearchParams({ year: String(year), make, model });
  
  const analysis = await fetchJson(`${BASE_URL}/api/admin/fitment/config-enrichment?${params}`);
  
  // Filter candidates by promotion criteria
  const promotable = analysis.missingInConfig.filter(c => 
    c.confidence === 100 &&
    !c.autoRejectReason
  );
  
  const needsReview = analysis.missingInConfig.filter(c =>
    c.confidence < 100 && c.confidence >= 70 && !c.autoRejectReason
  );
  
  const rejected = analysis.missingInConfig.filter(c => c.autoRejectReason);
  
  // Check for staggered ambiguity
  const hasStaggeredSetup = analysis.existingConfigSizes.some(s => 
    s.axlePosition === 'front' || s.axlePosition === 'rear'
  );
  
  // Check for HD/LT ambiguity
  const hasLTSizes = analysis.missingInConfig.some(c => c.tireSize.startsWith('LT'));
  const existingHasNonLT = analysis.existingConfigSizes.some(c => !c.tireSize.startsWith('LT'));
  const hdAmbiguity = hasLTSizes && existingHasNonLT;
  
  // Determine if chooser changes
  const currentDiameters = [...new Set(analysis.existingConfigSizes.map(s => s.wheelDiameter))].sort((a,b) => a-b);
  const newDiameters = [...new Set(promotable.map(s => s.wheelDiameter))];
  const addedDiameters = newDiameters.filter(d => !currentDiameters.includes(d));
  const chooserChanges = addedDiameters.length > 0;
  
  // DB fields that would be updated
  const dbFieldsUpdated = promotable.length > 0 
    ? ['vehicle_fitment_configurations.tire_size', 'vehicle_fitment_configurations.wheel_diameter']
    : [];
  
  return {
    vehicle: `${year} ${make} ${model}`,
    year, make, model,
    
    // Current state
    currentConfigSizes: analysis.existingConfigSizes.map(s => ({
      size: s.tireSize,
      diameter: s.wheelDiameter,
      axle: s.axlePosition
    })),
    currentDiameters: currentDiameters.map(d => `${d}"`).join(', '),
    
    // Proposed additions
    proposedNewSizes: promotable.map(c => ({
      size: c.tireSize,
      diameter: c.wheelDiameter,
      confidence: c.confidence,
      reasons: c.reasons
    })),
    
    // All candidates with scores
    allCandidates: analysis.missingInConfig.map(c => ({
      size: c.tireSize,
      diameter: c.wheelDiameter,
      confidence: c.confidence,
      status: c.autoRejectReason ? 'REJECTED' : c.confidence === 100 ? 'PROMOTABLE' : 'NEEDS_REVIEW',
      reason: c.autoRejectReason || c.reasons.join('; ')
    })),
    
    // Summary counts
    promotableCount: promotable.length,
    needsReviewCount: needsReview.length,
    rejectedCount: rejected.length,
    
    // Risk assessment
    regressionRisk: analysis.dryRunPreview.regressionRisk,
    regressionDetails: analysis.dryRunPreview.regressionDetails,
    
    // Chooser impact
    chooserChanges,
    addedDiameters: addedDiameters.map(d => `${d}"`),
    currentChooser: analysis.dryRunPreview.currentChooserBehavior,
    proposedChooser: analysis.dryRunPreview.proposedChooserBehavior,
    
    // Ambiguity flags
    hasStaggeredSetup,
    hdAmbiguity,
    
    // Trim/config grouping
    trimGroupingChanges: false, // Config additions don't change trim grouping
    
    // DB impact
    dbFieldsUpdated,
    rowsToInsert: promotable.length,
    
    // Final promotion eligibility
    eligibleForAutoPromotion: 
      promotable.length > 0 &&
      analysis.dryRunPreview.regressionRisk === 'none' &&
      !hasStaggeredSetup &&
      !hdAmbiguity &&
      promotable.every(c => c.confidence === 100)
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('BATCH DRY-RUN ANALYSIS: Config-Table Enrichment');
  console.log('═'.repeat(80));
  console.log(`\nAnalyzing ${NEEDS_ENRICHMENT_VEHICLES.length} vehicles...\n`);
  
  const results = [];
  const summary = {
    totalVehicles: NEEDS_ENRICHMENT_VEHICLES.length,
    eligibleForAutoPromotion: 0,
    needsManualReview: 0,
    noAction: 0,
    totalPromotableSizes: 0,
    totalNeedsReviewSizes: 0,
    totalRejectedSizes: 0
  };
  
  for (const vehicle of NEEDS_ENRICHMENT_VEHICLES) {
    try {
      const result = await analyzeVehicle(vehicle);
      results.push(result);
      
      // Update summary
      if (result.eligibleForAutoPromotion) {
        summary.eligibleForAutoPromotion++;
      } else if (result.promotableCount > 0 || result.needsReviewCount > 0) {
        summary.needsManualReview++;
      } else {
        summary.noAction++;
      }
      summary.totalPromotableSizes += result.promotableCount;
      summary.totalNeedsReviewSizes += result.needsReviewCount;
      summary.totalRejectedSizes += result.rejectedCount;
      
      // Print vehicle analysis
      console.log('─'.repeat(80));
      console.log(`📋 ${result.vehicle}`);
      console.log('─'.repeat(80));
      
      console.log('\n  CURRENT CONFIG SIZES:');
      if (result.currentConfigSizes.length === 0) {
        console.log('    (none)');
      } else {
        for (const s of result.currentConfigSizes) {
          console.log(`    • ${s.size} (${s.diameter}" ${s.axle})`);
        }
      }
      console.log(`    Diameters: ${result.currentDiameters || '(none)'}`);
      
      console.log('\n  CANDIDATE ANALYSIS:');
      for (const c of result.allCandidates) {
        const statusIcon = c.status === 'PROMOTABLE' ? '✅' : c.status === 'REJECTED' ? '❌' : '⚠️';
        console.log(`    ${statusIcon} ${c.size} (${c.diameter}") - ${c.confidence}% - ${c.status}`);
        console.log(`       ${c.reason}`);
      }
      
      console.log('\n  CHOOSER IMPACT:');
      console.log(`    Current: ${result.currentChooser}`);
      console.log(`    Proposed: ${result.proposedChooser}`);
      console.log(`    Changes: ${result.chooserChanges ? `Yes - adds ${result.addedDiameters.join(', ')}` : 'No'}`);
      
      console.log('\n  RISK ASSESSMENT:');
      console.log(`    Regression Risk: ${result.regressionRisk.toUpperCase()}`);
      console.log(`    Staggered Setup: ${result.hasStaggeredSetup ? 'YES ⚠️' : 'No'}`);
      console.log(`    HD/LT Ambiguity: ${result.hdAmbiguity ? 'YES ⚠️' : 'No'}`);
      
      console.log('\n  DB IMPACT:');
      console.log(`    Rows to insert: ${result.rowsToInsert}`);
      console.log(`    Fields: ${result.dbFieldsUpdated.join(', ') || '(none)'}`);
      
      const promoStatus = result.eligibleForAutoPromotion 
        ? '✅ ELIGIBLE FOR AUTO-PROMOTION'
        : result.promotableCount > 0 
          ? '⚠️ NEEDS MANUAL REVIEW'
          : '❌ NO ACTION';
      console.log(`\n  STATUS: ${promoStatus}`);
      console.log('');
      
    } catch (err) {
      console.log(`\n❌ Error analyzing ${vehicle.year} ${vehicle.make} ${vehicle.model}: ${err.message}\n`);
      results.push({
        vehicle: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
        error: err.message
      });
    }
  }
  
  // Print summary
  console.log('═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\n  Total vehicles analyzed: ${summary.totalVehicles}`);
  console.log(`  ✅ Eligible for auto-promotion: ${summary.eligibleForAutoPromotion}`);
  console.log(`  ⚠️ Needs manual review: ${summary.needsManualReview}`);
  console.log(`  ❌ No action needed: ${summary.noAction}`);
  console.log(`\n  Total promotable sizes (100% confidence): ${summary.totalPromotableSizes}`);
  console.log(`  Total needs-review sizes (70-99%): ${summary.totalNeedsReviewSizes}`);
  console.log(`  Total rejected sizes: ${summary.totalRejectedSizes}`);
  
  // List eligible vehicles
  const eligible = results.filter(r => r.eligibleForAutoPromotion);
  if (eligible.length > 0) {
    console.log('\n  VEHICLES ELIGIBLE FOR AUTO-PROMOTION:');
    for (const r of eligible) {
      console.log(`    • ${r.vehicle}: ${r.promotableCount} sizes`);
      for (const s of r.proposedNewSizes) {
        console.log(`      + ${s.size} (${s.diameter}")`);
      }
    }
  }
  
  // Output JSON for programmatic use
  const outputPath = 'scripts/usaf-audit-results/batch-dry-run-results.json';
  const fs = await import('fs');
  fs.writeFileSync(outputPath, JSON.stringify({ summary, results }, null, 2));
  console.log(`\n📁 Full results saved to: ${outputPath}`);
  
  console.log('\n' + '═'.repeat(80));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
