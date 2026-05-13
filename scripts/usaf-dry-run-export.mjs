#!/usr/bin/env node
/**
 * USAF Dry-Run Export Script
 * 
 * Processes audit results and classifies enrichment candidates.
 * NO DB writes - exports for review only.
 * 
 * Usage:
 *   node scripts/usaf-dry-run-export.mjs                    # Process all recent audits
 *   node scripts/usaf-dry-run-export.mjs --years=2024,2025,2026
 *   node scripts/usaf-dry-run-export.mjs --min-confidence=95
 */

import fs from 'fs';
import path from 'path';

const AUDIT_DIR = path.join(process.cwd(), 'scripts/usaf-audit-results');

// ============================================================================
// INLINE CLASSIFIER (to avoid ESM import issues)
// ============================================================================

const COMPLEX_STAGGERED_PATTERNS = [
  { make: /porsche/i, model: /911|cayenne|panamera|macan|taycan|boxster|cayman/i },
  { make: /bmw/i, model: /m[2-8]|z4|i[48]/i },
  { make: /ford/i, model: /mustang/i },
  { make: /chevrolet|chevy/i, model: /corvette|camaro/i },
  { make: /dodge/i, model: /challenger|charger/i },
  { make: /lamborghini/i, model: /urus|huracan|aventador/i },
  { make: /ferrari/i, model: /.*/i },  // All Ferrari models
  { make: /mclaren/i, model: /.*/i },
  { make: /aston martin/i, model: /.*/i },
  { make: /bentley/i, model: /.*/i },
  { make: /rolls-royce/i, model: /.*/i },
];

const HD_TRUCK_PATTERNS = [
  { make: /ford/i, model: /f-?250|f-?350|f-?450|super duty/i },
  { make: /chevrolet|chevy|gmc/i, model: /silverado\s*(2500|3500)|sierra\s*(2500|3500)/i },
  { make: /ram/i, model: /2500|3500/i },
];

function isComplexStaggeredVehicle(make, model) {
  if (!make || !model) return false;
  return COMPLEX_STAGGERED_PATTERNS.some(p => p.make.test(make) && p.model.test(model));
}

function isHDTruck(make, model) {
  if (!make || !model) return false;
  return HD_TRUCK_PATTERNS.some(p => p.make.test(make) && p.model.test(model));
}

function isFlotationSize(size) {
  return /^\d{2,3}x\d/.test(size);
}

function hasJsonArtifacts(sizes) {
  return sizes.some(s => 
    /^\[/.test(s) || /^"/.test(s) || s.length === 1 || /^[,\[\]"]$/.test(s)
  );
}

function normalizeTireSize(size) {
  if (!size || typeof size !== "string") return null;
  const original = size.trim();
  const s = original.toUpperCase();
  
  // Flotation format
  const flotMatch = s.match(/^(\d{2,3})x(\d{1,2}\.?\d*)R?(\d{2})(LT)?(?:\/([A-Z]))?$/i);
  if (flotMatch) {
    const [, diameter, width, rim, lt, loadRange] = flotMatch;
    return {
      original,
      normalized: `${diameter}x${width}R${rim}`,
      rim: parseInt(rim),
      isFlotation: true,
      loadRange: loadRange || null,
    };
  }
  
  // Standard format
  const stdMatch = s.match(/^(P)?(LT)?(\d{3})\/(\d{2,3})(ZR|RF|R)?(\d{2})(?:\/([A-Z]))?/i);
  if (stdMatch) {
    const [, pPrefix, ltPrefix, width, aspect, construction, rim, loadRange] = stdMatch;
    const ltStr = ltPrefix || "";
    return {
      original,
      normalized: `${ltStr}${width}/${aspect}R${rim}`,
      rim: parseInt(rim),
      isFlotation: false,
      loadRange: loadRange || null,
      isRunFlat: construction === "RF",
      isZR: construction === "ZR",
      isP: !!pPrefix,
      isLT: !!ltPrefix,
    };
  }
  
  // Simple fallback
  const simpleMatch = s.match(/^(P)?(LT)?(\d{3})\/(\d{2,3})R?(\d{2})/i);
  if (simpleMatch) {
    const [, pPrefix, ltPrefix, width, aspect, rim] = simpleMatch;
    const ltStr = ltPrefix || "";
    return {
      original,
      normalized: `${ltStr}${width}/${aspect}R${rim}`,
      rim: parseInt(rim),
      isFlotation: false,
      loadRange: null,
    };
  }
  
  return null;
}

function isNotationOnlyDifference(size1, size2) {
  const n1 = normalizeTireSize(size1);
  const n2 = normalizeTireSize(size2);
  if (!n1 || !n2) return false;
  return n1.normalized === n2.normalized;
}

function findEquivalentSizes(wtdSizes, usafSizes) {
  const wtdNormalized = wtdSizes.map(s => ({ original: s, parsed: normalizeTireSize(s) }));
  const usafNormalized = usafSizes.map(s => ({ original: s, parsed: normalizeTireSize(s) }));
  
  const common = [];
  const matchedWtd = new Set();
  const matchedUsaf = new Set();
  
  for (let i = 0; i < wtdNormalized.length; i++) {
    const wtd = wtdNormalized[i];
    if (!wtd.parsed) continue;
    
    for (let j = 0; j < usafNormalized.length; j++) {
      if (matchedUsaf.has(j)) continue;
      const usaf = usafNormalized[j];
      if (!usaf.parsed) continue;
      
      if (wtd.parsed.normalized === usaf.parsed.normalized) {
        common.push({ wtd: wtd.original, usaf: usaf.original, normalized: wtd.parsed.normalized });
        matchedWtd.add(i);
        matchedUsaf.add(j);
        break;
      }
    }
  }
  
  const wtdOnly = wtdNormalized.filter((_, i) => !matchedWtd.has(i)).map(w => w.original);
  const usafOnly = usafNormalized.filter((_, j) => !matchedUsaf.has(j)).map(u => u.original);
  
  return { common, wtdOnly, usafOnly };
}

function extractDiameters(sizes) {
  const diameters = new Set();
  for (const size of sizes) {
    const parsed = normalizeTireSize(size);
    if (parsed?.rim) diameters.add(parsed.rim);
  }
  return [...diameters].sort((a, b) => a - b);
}

function isLoadRangeChange(wtdSizes, usafSize) {
  const usafParsed = normalizeTireSize(usafSize);
  if (!usafParsed?.loadRange) return false;
  
  for (const wtdSize of wtdSizes) {
    const wtdParsed = normalizeTireSize(wtdSize);
    if (!wtdParsed) continue;
    if (wtdParsed.normalized === usafParsed.normalized && 
        wtdParsed.loadRange && wtdParsed.loadRange !== usafParsed.loadRange) {
      return true;
    }
  }
  return false;
}

function classifyEnrichment(year, make, model, wtdSizes, usafSizes) {
  const reasons = [];
  
  // Clean data
  const cleanWtdSizes = wtdSizes.filter(s => 
    s && typeof s === "string" && s.length > 3 && !/^[\[\]",]/.test(s)
  );
  const cleanUsafSizes = [...new Set(usafSizes)];
  
  const comparison = findEquivalentSizes(cleanWtdSizes, cleanUsafSizes);
  const wtdDiameters = extractDiameters(cleanWtdSizes);
  const usafDiameters = extractDiameters(cleanUsafSizes);
  const newDiameters = usafDiameters.filter(d => !wtdDiameters.includes(d));
  
  // Flags
  const isComplex = isComplexStaggeredVehicle(make, model);
  const isHD = isHDTruck(make, model);
  const hasFlotation = cleanUsafSizes.some(isFlotationSize) || cleanWtdSizes.some(isFlotationSize);
  const jsonArtifacts = hasJsonArtifacts(wtdSizes);
  const hasLoadChange = comparison.usafOnly.some(s => isLoadRangeChange(cleanWtdSizes, s));
  
  // Check notation-only differences
  let notationOnlyCount = 0;
  for (const usafSize of comparison.usafOnly) {
    for (const wtdSize of cleanWtdSizes) {
      if (isNotationOnlyDifference(usafSize, wtdSize)) {
        notationOnlyCount++;
        break;
      }
    }
  }
  const allNotationOnly = notationOnlyCount === comparison.usafOnly.length && comparison.usafOnly.length > 0;
  
  // Calculate confidence
  let confidence = 50;
  
  if (comparison.common.length > 0) {
    confidence += 20;
    reasons.push(`${comparison.common.length} common sizes`);
  }
  
  if (comparison.usafOnly.length > 0 && newDiameters.length === 0) {
    confidence += 15;
    reasons.push("New sizes use existing wheel diameters");
  }
  
  if (allNotationOnly) {
    confidence += 25;
    reasons.push("Notation-only differences (P/ZR/RF)");
  }
  
  if (cleanUsafSizes.length >= 3 && comparison.usafOnly.length <= 3) {
    confidence += 10;
    reasons.push("USAF has multiple OEM options");
  }
  
  if (isComplex) { confidence -= 20; reasons.push("Complex staggered vehicle"); }
  if (isHD) { confidence -= 15; reasons.push("HD truck (SRW/DRW ambiguity)"); }
  if (hasFlotation) { confidence -= 10; reasons.push("Has flotation sizes"); }
  if (hasLoadChange) { confidence -= 15; reasons.push("Load range class change"); }
  if (newDiameters.length > 0) { confidence -= 10; reasons.push(`New wheel diameters: ${newDiameters.join(", ")}`); }
  if (comparison.wtdOnly.length > comparison.usafOnly.length && cleanUsafSizes.length > 0) {
    confidence -= 15;
    reasons.push(`WTD has ${comparison.wtdOnly.length} sizes USAF doesn't`);
  }
  if (jsonArtifacts) reasons.push("JSON artifacts in WTD data");
  
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Filter proposed additions
  const proposedAdditions = comparison.usafOnly.filter(s => {
    for (const wtdSize of cleanWtdSizes) {
      if (isNotationOnlyDifference(s, wtdSize)) return false;
    }
    return true;
  });
  
  // Determine category
  let category;
  
  if (proposedAdditions.length === 0) {
    category = "ignore";
    reasons.push("No new physical sizes to add");
  } else if (cleanUsafSizes.length === 0) {
    category = "ignore";
    reasons.push("USAF has no data");
  } else if (confidence >= 95 && !isComplex && !isHD && !hasFlotation && !hasLoadChange && newDiameters.length === 0) {
    category = "auto_approve";
  } else if (confidence >= 80 && !isComplex && !isHD) {
    category = "bulk_review";
  } else {
    category = "manual_review";
  }
  
  // Force manual for risky cases
  if ((isComplex || isHD || hasFlotation || hasLoadChange) && category !== "ignore") {
    category = "manual_review";
  }
  
  return {
    year, make, model,
    wtdSizes: cleanWtdSizes,
    usafSizes: cleanUsafSizes,
    missingFromWtd: comparison.usafOnly,
    extraInWtd: comparison.wtdOnly,
    category,
    confidence,
    reasons,
    proposedAdditions,
    isComplex, isHD, hasFlotation, jsonArtifacts, hasLoadChange,
    allNotationOnly,
    wtdDiameters, usafDiameters, newDiameters,
  };
}

// ============================================================================
// MAIN
// ============================================================================

function loadAuditFiles(years) {
  const files = fs.readdirSync(AUDIT_DIR)
    .filter(f => f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));  // Newest first
  
  const vehicles = [];
  const seenVehicles = new Set();
  
  for (const file of files) {
    const content = JSON.parse(fs.readFileSync(path.join(AUDIT_DIR, file), 'utf-8'));
    const fileYear = content.filters?.year;
    
    if (years.length > 0 && fileYear && !years.includes(parseInt(fileYear))) {
      continue;
    }
    
    for (const v of content.vehicles) {
      if (v.error) continue;
      
      const key = `${v.year}-${v.make.toLowerCase()}-${v.model.toLowerCase()}`;
      if (seenVehicles.has(key)) continue;
      seenVehicles.add(key);
      
      if (years.length > 0 && !years.includes(v.year)) continue;
      
      vehicles.push({
        year: v.year,
        make: v.make,
        model: v.model,
        wtdSizes: v.wtd?.sizes || [],
        usafSizes: v.usaf?.sizes || [],
        wtdTrims: v.wtd?.trims || [],
      });
    }
  }
  
  return vehicles;
}

function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, '').split('=');
    flags[key] = value || true;
  }
  
  const years = flags.years ? flags.years.split(',').map(Number) : [2024, 2025, 2026];
  const minConfidence = parseInt(flags['min-confidence']) || 0;
  
  console.log('🔍 USAF Dry-Run Export');
  console.log('='.repeat(60));
  console.log(`Years: ${years.join(', ')}`);
  console.log(`Min confidence filter: ${minConfidence}`);
  console.log('');
  
  // Load audit data
  const vehicles = loadAuditFiles(years);
  console.log(`📊 Loaded ${vehicles.length} unique vehicles`);
  
  // Classify all vehicles
  const results = {
    autoApprove: [],
    bulkReview: [],
    manualReview: [],
    ignore: [],
  };
  
  for (const v of vehicles) {
    const classified = classifyEnrichment(v.year, v.make, v.model, v.wtdSizes, v.usafSizes);
    
    if (classified.confidence < minConfidence) continue;
    
    results[classified.category === 'auto_approve' ? 'autoApprove' : 
            classified.category === 'bulk_review' ? 'bulkReview' :
            classified.category === 'manual_review' ? 'manualReview' : 'ignore'].push(classified);
  }
  
  // Sort by confidence
  results.autoApprove.sort((a, b) => b.confidence - a.confidence);
  results.bulkReview.sort((a, b) => b.confidence - a.confidence);
  results.manualReview.sort((a, b) => b.confidence - a.confidence);
  
  // Print summary
  console.log('');
  console.log('='.repeat(60));
  console.log('📊 CLASSIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`  ✅ Auto-approvable (confidence ≥95):  ${results.autoApprove.length}`);
  console.log(`  📋 Bulk review (confidence 80-94):    ${results.bulkReview.length}`);
  console.log(`  ⚠️  Manual review required:           ${results.manualReview.length}`);
  console.log(`  ⏭️  Ignored (no changes needed):      ${results.ignore.length}`);
  
  // Count total proposed additions
  const totalAutoAdditions = results.autoApprove.reduce((sum, c) => sum + c.proposedAdditions.length, 0);
  const totalBulkAdditions = results.bulkReview.reduce((sum, c) => sum + c.proposedAdditions.length, 0);
  
  console.log('');
  console.log(`  📦 Total auto-approve tire sizes:     ${totalAutoAdditions}`);
  console.log(`  📦 Total bulk-review tire sizes:      ${totalBulkAdditions}`);
  
  // Show top 50 auto-approve candidates
  if (results.autoApprove.length > 0) {
    console.log('');
    console.log('='.repeat(60));
    console.log('🏆 TOP 50 AUTO-APPROVE CANDIDATES (confidence ≥95)');
    console.log('='.repeat(60));
    
    for (const c of results.autoApprove.slice(0, 50)) {
      console.log(`  ${c.year} ${c.make} ${c.model} (${c.confidence}%)`);
      console.log(`    + Add: ${c.proposedAdditions.join(', ')}`);
      console.log(`    Reasons: ${c.reasons.slice(0, 3).join('; ')}`);
      console.log('');
    }
  }
  
  // Show manual review breakdown
  console.log('');
  console.log('='.repeat(60));
  console.log('⚠️  MANUAL REVIEW BREAKDOWN');
  console.log('='.repeat(60));
  
  const manualByReason = {
    complex: results.manualReview.filter(c => c.isComplex).length,
    hdTruck: results.manualReview.filter(c => c.isHD).length,
    flotation: results.manualReview.filter(c => c.hasFlotation).length,
    loadRange: results.manualReview.filter(c => c.hasLoadChange).length,
    jsonArtifacts: results.manualReview.filter(c => c.jsonArtifacts).length,
    newDiameters: results.manualReview.filter(c => c.newDiameters?.length > 0).length,
    wtdExtras: results.manualReview.filter(c => c.extraInWtd?.length > c.missingFromWtd?.length).length,
  };
  
  console.log(`  Complex staggered (Porsche/BMW/Mustang/etc): ${manualByReason.complex}`);
  console.log(`  HD trucks (SRW/DRW ambiguity):               ${manualByReason.hdTruck}`);
  console.log(`  Flotation sizes:                             ${manualByReason.flotation}`);
  console.log(`  Load range changes:                          ${manualByReason.loadRange}`);
  console.log(`  JSON artifacts in WTD:                       ${manualByReason.jsonArtifacts}`);
  console.log(`  New wheel diameters:                         ${manualByReason.newDiameters}`);
  console.log(`  WTD has many extras:                         ${manualByReason.wtdExtras}`);
  
  // Save export
  const exportData = {
    timestamp: new Date().toISOString(),
    type: 'usaf_dry_run_export',
    years,
    stats: {
      totalVehicles: vehicles.length,
      autoApproveCount: results.autoApprove.length,
      bulkReviewCount: results.bulkReview.length,
      manualReviewCount: results.manualReview.length,
      ignoreCount: results.ignore.length,
      totalAutoAdditions,
      totalBulkAdditions,
    },
    autoApproveProposals: results.autoApprove.map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      addSizes: c.proposedAdditions,
      confidence: c.confidence,
      reasons: c.reasons,
      existingDiameters: c.wtdDiameters,
    })),
    bulkReviewProposals: results.bulkReview.slice(0, 100).map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      addSizes: c.proposedAdditions,
      confidence: c.confidence,
      reasons: c.reasons,
      newDiameters: c.newDiameters,
    })),
    manualReviewItems: results.manualReview.slice(0, 100).map(c => ({
      year: c.year,
      make: c.make,
      model: c.model,
      proposedAdditions: c.proposedAdditions,
      confidence: c.confidence,
      reasons: c.reasons,
      flags: {
        isComplex: c.isComplex,
        isHD: c.isHD,
        hasFlotation: c.hasFlotation,
        hasLoadChange: c.hasLoadChange,
        jsonArtifacts: c.jsonArtifacts,
        newDiameters: c.newDiameters,
      },
    })),
  };
  
  const exportPath = path.join(AUDIT_DIR, `dry-run-export-${Date.now()}.json`);
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log('');
  console.log(`💾 Export saved to: ${exportPath}`);
  
  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ZERO DB WRITES - This is a dry-run export only');
  console.log('='.repeat(60));
}

main();
