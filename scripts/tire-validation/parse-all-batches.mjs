/**
 * Parse All Tire Validation Batches
 * 
 * Consolidates all batch-*.json files and extracts:
 * - Invalid year entries (vehicles that never existed)
 * - Non-US market vehicles
 * - Generational mismatches
 * - Wrong tire sizes
 * - Missing data
 * - Duplicate models
 */

import fs from 'fs';
import path from 'path';

const RESULTS_DIR = path.join(process.cwd(), 'results');
const OUTPUT_FILE = path.join(process.cwd(), 'consolidated-issues.json');

// Known invalid year ranges (vehicles that didn't exist in certain years)
const KNOWN_INVALID_YEARS = {
  'nissan': {
    '350z': { validYears: [2003, 2004, 2005, 2006, 2007, 2008, 2009], reason: '350Z production 2003-2009' },
    '370z': { validYears: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020], reason: '370Z production 2009-2020' },
    'z': { validYears: [2023, 2024, 2025, 2026], reason: 'Nissan Z production 2023+' },
  },
  'jeep': {
    'cherokee': { validYears: Array.from({length: 2024-1974+1}, (_, i) => 1974+i).filter(y => y <= 2023), reason: 'Cherokee discontinued after 2023' },
  },
  'scion': {
    'fr-s': { validYears: [2013, 2014, 2015, 2016], reason: 'FR-S only 2013-2016 (became Toyota 86)' },
    'tc': { validYears: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016], reason: 'tC 2005-2016' },
    'xb': { validYears: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015], reason: 'xB 2004-2015' },
    'xa': { validYears: [2004, 2005, 2006], reason: 'xA 2004-2006' },
  },
  'pontiac': {
    // Pontiac discontinued 2010
    'g8': { validYears: [2008, 2009], reason: 'G8 only 2008-2009' },
    'solstice': { validYears: [2006, 2007, 2008, 2009, 2010], reason: 'Solstice 2006-2010' },
  },
  'saturn': {
    // Saturn discontinued 2010
    'sky': { validYears: [2007, 2008, 2009, 2010], reason: 'Sky 2007-2010' },
  },
  'plymouth': {
    // Plymouth discontinued 2001
    'prowler': { validYears: [1997, 1999, 2000, 2001, 2002], reason: 'Prowler 1997, 1999-2002' },
  },
  'mercury': {
    // Mercury discontinued 2011
    'mariner': { validYears: [2005, 2006, 2007, 2008, 2009, 2010, 2011], reason: 'Mariner 2005-2011' },
  },
  'hummer': {
    // Hummer discontinued 2010
    'h2': { validYears: [2003, 2004, 2005, 2006, 2007, 2008, 2009], reason: 'H2 2003-2009' },
    'h3': { validYears: [2006, 2007, 2008, 2009, 2010], reason: 'H3 2006-2010' },
  },
};

// Non-US market vehicles (JDM, Europe-only, etc.)
const NON_US_VEHICLES = [
  { make: 'toyota', model: 'alphard', reason: 'JDM-only' },
  { make: 'toyota', model: 'vellfire', reason: 'JDM-only' },
  { make: 'toyota', model: 'harrier', reason: 'JDM-only (Venza in US)' },
  { make: 'toyota', model: 'crown', reason: 'JDM-only until 2023' },
  { make: 'toyota', model: 'mark-x', reason: 'JDM-only' },
  { make: 'toyota', model: 'century', reason: 'JDM-only' },
  { make: 'nissan', model: 'skyline', reason: 'JDM-only (different from GT-R)' },
  { make: 'nissan', model: 'silvia', reason: 'JDM-only' },
  { make: 'nissan', model: 'elgrand', reason: 'JDM-only' },
  { make: 'nissan', model: 'serena', reason: 'JDM-only' },
  { make: 'honda', model: 'n-box', reason: 'JDM kei car' },
  { make: 'honda', model: 'freed', reason: 'JDM-only' },
  { make: 'honda', model: 'fit-shuttle', reason: 'JDM-only' },
  { make: 'honda', model: 'stepwgn', reason: 'JDM-only' },
  { make: 'honda', model: 'jade', reason: 'JDM/China-only' },
  { make: 'subaru', model: 'levorg', reason: 'JDM-only' },
  { make: 'mitsubishi', model: 'delica', reason: 'JDM-only' },
  { make: 'mitsubishi', model: 'pajero', reason: 'Not sold in US (Montero in some markets)' },
  { make: 'mazda', model: 'atenza', reason: 'JDM name for Mazda6' },
  { make: 'mazda', model: 'axela', reason: 'JDM name for Mazda3' },
  { make: 'mazda', model: 'demio', reason: 'JDM name for Mazda2' },
  { make: 'suzuki', model: 'swift', reason: 'Not sold in US since 2014' },
  { make: 'suzuki', model: 'jimny', reason: 'Not officially sold in US' },
  { make: 'volkswagen', model: 'polo', reason: 'Not sold in US' },
  { make: 'volkswagen', model: 'up', reason: 'Not sold in US' },
  { make: 'volkswagen', model: 'scirocco', reason: 'Not sold in US' },
  { make: 'audi', model: 'a1', reason: 'Not sold in US' },
  { make: 'audi', model: 'a7l', reason: 'China-only' },
  { make: 'bmw', model: '1-series', reason: 'Limited US availability' },
  { make: 'bmw', model: '2-series-active-tourer', reason: 'Not sold in US' },
  { make: 'mercedes-benz', model: 'a-class', reason: 'Limited US (sedan only, no hatch)' },
  { make: 'mercedes-benz', model: 'b-class', reason: 'Not sold in US' },
  { make: 'renault', model: '*', reason: 'Renault not sold in US' },
  { make: 'peugeot', model: '*', reason: 'Peugeot not sold in US' },
  { make: 'citroen', model: '*', reason: 'Citroen not sold in US' },
  { make: 'seat', model: '*', reason: 'SEAT not sold in US' },
  { make: 'skoda', model: '*', reason: 'Skoda not sold in US' },
  { make: 'opel', model: '*', reason: 'Opel not sold in US' },
  { make: 'vauxhall', model: '*', reason: 'Vauxhall not sold in US' },
  { make: 'holden', model: '*', reason: 'Holden not sold in US' },
  { make: 'dacia', model: '*', reason: 'Dacia not sold in US' },
  { make: 'lada', model: '*', reason: 'Lada not sold in US' },
];

// Models that should be merged into their parent
const MERGE_CANDIDATES = [
  { make: 'subaru', from: 'impreza-sport', to: 'impreza', reason: 'Sport is a trim of Impreza' },
  { make: 'subaru', from: 'impreza-premium', to: 'impreza', reason: 'Premium is a trim of Impreza' },
  { make: 'honda', from: 'civic-si', to: 'civic', reason: 'Si is a trim of Civic' },
  { make: 'honda', from: 'civic-type-r', to: 'civic', reason: 'Type R is a trim of Civic' },
  { make: 'honda', from: 'accord-sport', to: 'accord', reason: 'Sport is a trim of Accord' },
  { make: 'volkswagen', from: 'gti', to: 'golf', reason: 'GTI is a trim of Golf' },
  { make: 'volkswagen', from: 'golf-r', to: 'golf', reason: 'R is a trim of Golf' },
  { make: 'bmw', from: 'm3', to: '3-series', reason: 'M3 could be a trim (debatable)' },
  { make: 'bmw', from: 'm5', to: '5-series', reason: 'M5 could be a trim (debatable)' },
];

// Issue categories
const issues = {
  deletes: {
    invalidYears: [],      // Vehicles that didn't exist in those years
    nonUsMarket: [],       // JDM, Europe-only, etc.
  },
  updates: {
    generationalMismatch: [], // Wrong sizes for wrong years
    wrongTireSizes: [],       // Incorrect sizes
    wrongWheelSizes: [],      // Incorrect wheel specs
  },
  inserts: {
    missingData: [],        // Empty tire data
    missingRearSizes: [],   // Staggered without rear
  },
  merges: {
    duplicateModels: [],    // Models that should be trims
  },
  warnings: [],              // Non-critical issues
};

// Stats
const stats = {
  totalBatches: 0,
  totalVehicles: 0,
  issuesFound: 0,
};

/**
 * Parse a single batch file
 */
function parseBatch(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const batch = JSON.parse(content);
  
  stats.totalBatches++;
  
  if (!batch.results || !Array.isArray(batch.results)) {
    console.warn(`Batch ${batch.batchId || filePath} has no results array`);
    return;
  }
  
  stats.totalVehicles += batch.results.length;
  
  for (const vehicle of batch.results) {
    processVehicle(vehicle, batch.batchId);
  }
  
  // Process validation summary issues
  if (batch.validationSummary?.dataIssuesFound) {
    for (const issue of batch.validationSummary.dataIssuesFound) {
      processValidationIssue(issue, batch.batchId);
    }
  }
}

/**
 * Process a single vehicle entry
 * Handles two batch formats:
 * - Format A: trims is array of {trim, tireSize, wheelSize, ...}
 * - Format B: trims is object {trimName: [tireSizes]} with validatedTireSizes
 */
function processVehicle(vehicle, batchId) {
  const { year, make, model, trims, isStaggered, notes, confidence, validatedTireSizes } = vehicle;
  const makeLower = make?.toLowerCase();
  const modelLower = model?.toLowerCase();
  
  // Check for invalid years
  if (KNOWN_INVALID_YEARS[makeLower]?.[modelLower]) {
    const valid = KNOWN_INVALID_YEARS[makeLower][modelLower];
    if (!valid.validYears.includes(year)) {
      issues.deletes.invalidYears.push({
        year,
        make: makeLower,
        model: modelLower,
        reason: valid.reason,
        batchId,
      });
      stats.issuesFound++;
    }
  }
  
  // Check for non-US market vehicles
  const nonUs = NON_US_VEHICLES.find(v => 
    v.make === makeLower && (v.model === '*' || v.model === modelLower)
  );
  if (nonUs) {
    issues.deletes.nonUsMarket.push({
      year,
      make: makeLower,
      model: modelLower,
      reason: nonUs.reason,
      batchId,
    });
    stats.issuesFound++;
  }
  
  // Check for merge candidates
  const mergeCandidate = MERGE_CANDIDATES.find(m => 
    m.make === makeLower && m.from === modelLower
  );
  if (mergeCandidate) {
    issues.merges.duplicateModels.push({
      year,
      make: makeLower,
      fromModel: modelLower,
      toModel: mergeCandidate.to,
      reason: mergeCandidate.reason,
      batchId,
    });
    stats.issuesFound++;
  }
  
  // Detect format and normalize trims
  let normalizedTrims = [];
  
  if (Array.isArray(trims)) {
    // Format A: trims is array of objects
    normalizedTrims = trims;
  } else if (trims && typeof trims === 'object') {
    // Format B: trims is object {trimName: [tireSizes]}
    for (const [trimName, tireSizes] of Object.entries(trims)) {
      if (Array.isArray(tireSizes) && tireSizes.length > 0) {
        normalizedTrims.push({
          trim: trimName,
          tireSize: tireSizes[0], // Primary size
          additionalSizes: tireSizes.slice(1),
        });
      } else {
        normalizedTrims.push({
          trim: trimName,
          tireSize: null,
        });
      }
    }
  }
  
  // Check for missing data (no trims at all)
  if (normalizedTrims.length === 0) {
    // Only flag as missing if validatedTireSizes is also empty
    if (!validatedTireSizes || validatedTireSizes.length === 0) {
      issues.inserts.missingData.push({
        year,
        make: makeLower,
        model: modelLower,
        reason: 'No trim data and no validated sizes',
        batchId,
      });
      stats.issuesFound++;
    }
    // Don't return early if we have validatedTireSizes - still valid data
  }
  
  // Check each trim for issues
  for (const trim of normalizedTrims) {
    // Missing tire size
    if (!trim.tireSize && !trim.frontTireSize) {
      issues.inserts.missingData.push({
        year,
        make: makeLower,
        model: modelLower,
        trim: trim.trim,
        reason: 'Missing tire size',
        batchId,
      });
      stats.issuesFound++;
    }
    
    // Staggered without rear size
    if (isStaggered && trim.tireSize && !trim.tireSizeRear && !trim.rearTireSize) {
      issues.inserts.missingRearSizes.push({
        year,
        make: makeLower,
        model: modelLower,
        trim: trim.trim,
        frontSize: trim.tireSize || trim.frontTireSize,
        reason: 'Staggered vehicle missing rear tire size',
        batchId,
      });
      stats.issuesFound++;
    }
  }
  
  // Check notes for issues
  if (notes) {
    processNotes(notes, vehicle, batchId);
  }
  
  // Low confidence entries might need review
  if (confidence === 'low') {
    issues.warnings.push({
      year,
      make: makeLower,
      model: modelLower,
      reason: 'Low confidence data - needs verification',
      notes,
      batchId,
    });
  }
  
  // Check for "INVALID MODEL" in notes - these are definite deletes
  if (notes && notes.includes('INVALID MODEL')) {
    issues.deletes.invalidYears.push({
      year,
      make: makeLower,
      model: modelLower,
      reason: notes,
      batchId,
    });
    stats.issuesFound++;
  }
}

/**
 * Process notes field for additional issues
 */
function processNotes(notes, vehicle, batchId) {
  const notesLower = notes.toLowerCase();
  const { year, make, model } = vehicle;
  const makeLower = make?.toLowerCase();
  const modelLower = model?.toLowerCase();
  
  // Look for patterns indicating issues
  const issuePatterns = [
    { pattern: /not (sold|available|offered) in (us|usa|america)/i, type: 'nonUsMarket' },
    { pattern: /jdm(-| )only/i, type: 'nonUsMarket' },
    { pattern: /europe(-| )only/i, type: 'nonUsMarket' },
    { pattern: /china(-| )only/i, type: 'nonUsMarket' },
    { pattern: /wrong size/i, type: 'wrongTireSizes' },
    { pattern: /incorrect/i, type: 'wrongTireSizes' },
    { pattern: /should be/i, type: 'wrongTireSizes' },
    { pattern: /generational mismatch/i, type: 'generationalMismatch' },
    { pattern: /pre-production/i, type: 'invalidYears' },
    { pattern: /not available/i, type: 'warnings' },
    { pattern: /discontinued/i, type: 'warnings' },
  ];
  
  for (const { pattern, type } of issuePatterns) {
    if (pattern.test(notes)) {
      const issueEntry = {
        year,
        make: makeLower,
        model: modelLower,
        reason: notes,
        batchId,
      };
      
      switch (type) {
        case 'nonUsMarket':
          // Check if not already added
          if (!issues.deletes.nonUsMarket.find(e => 
            e.year === year && e.make === makeLower && e.model === modelLower
          )) {
            issues.deletes.nonUsMarket.push(issueEntry);
            stats.issuesFound++;
          }
          break;
        case 'wrongTireSizes':
          issues.updates.wrongTireSizes.push(issueEntry);
          stats.issuesFound++;
          break;
        case 'generationalMismatch':
          issues.updates.generationalMismatch.push(issueEntry);
          stats.issuesFound++;
          break;
        case 'invalidYears':
          issues.deletes.invalidYears.push(issueEntry);
          stats.issuesFound++;
          break;
        case 'warnings':
          issues.warnings.push(issueEntry);
          break;
      }
    }
  }
}

/**
 * Process validation summary issues
 */
function processValidationIssue(issue, batchId) {
  // Parse the issue text for actionable items
  const issueLower = issue.toLowerCase();
  
  if (issueLower.includes('incorrect') || issueLower.includes('wrong')) {
    issues.updates.wrongTireSizes.push({
      description: issue,
      batchId,
    });
    stats.issuesFound++;
  } else if (issueLower.includes('missing')) {
    issues.inserts.missingData.push({
      description: issue,
      batchId,
    });
    stats.issuesFound++;
  } else if (issueLower.includes('truck sizes') || issueLower.includes('aftermarket')) {
    issues.updates.wrongTireSizes.push({
      description: issue,
      type: 'aftermarket_contamination',
      batchId,
    });
    stats.issuesFound++;
  }
}

/**
 * Deduplicate issues
 */
function deduplicateIssues() {
  // Dedupe invalid years
  const seenInvalidYears = new Set();
  issues.deletes.invalidYears = issues.deletes.invalidYears.filter(item => {
    const key = `${item.year}-${item.make}-${item.model}`;
    if (seenInvalidYears.has(key)) return false;
    seenInvalidYears.add(key);
    return true;
  });
  
  // Dedupe non-US market
  const seenNonUs = new Set();
  issues.deletes.nonUsMarket = issues.deletes.nonUsMarket.filter(item => {
    const key = `${item.year}-${item.make}-${item.model}`;
    if (seenNonUs.has(key)) return false;
    seenNonUs.add(key);
    return true;
  });
  
  // Dedupe merge candidates
  const seenMerge = new Set();
  issues.merges.duplicateModels = issues.merges.duplicateModels.filter(item => {
    const key = `${item.year}-${item.make}-${item.fromModel}`;
    if (seenMerge.has(key)) return false;
    seenMerge.add(key);
    return true;
  });
}

/**
 * Main execution
 */
function main() {
  console.log('Parsing all batch results...\n');
  
  // Find all batch files
  const batchFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('batch-') && f.endsWith('-results.json'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/batch-(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/batch-(\d+)/)?.[1] || '0');
      return numA - numB;
    });
  
  console.log(`Found ${batchFiles.length} batch files\n`);
  
  // Process each batch
  for (const file of batchFiles) {
    const filePath = path.join(RESULTS_DIR, file);
    try {
      parseBatch(filePath);
      process.stdout.write('.');
    } catch (err) {
      console.error(`\nError parsing ${file}: ${err.message}`);
    }
  }
  
  console.log('\n\nDeduplicating issues...');
  deduplicateIssues();
  
  // Write consolidated output
  const output = {
    stats,
    issues,
    generatedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  
  // Print summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total batches processed: ${stats.totalBatches}`);
  console.log(`Total vehicles processed: ${stats.totalVehicles}`);
  console.log(`Total issues found: ${stats.issuesFound}`);
  console.log('\nIssue breakdown:');
  console.log(`  DELETES - Invalid Years: ${issues.deletes.invalidYears.length}`);
  console.log(`  DELETES - Non-US Market: ${issues.deletes.nonUsMarket.length}`);
  console.log(`  UPDATES - Generational Mismatch: ${issues.updates.generationalMismatch.length}`);
  console.log(`  UPDATES - Wrong Tire Sizes: ${issues.updates.wrongTireSizes.length}`);
  console.log(`  UPDATES - Wrong Wheel Sizes: ${issues.updates.wrongWheelSizes.length}`);
  console.log(`  INSERTS - Missing Data: ${issues.inserts.missingData.length}`);
  console.log(`  INSERTS - Missing Rear Sizes: ${issues.inserts.missingRearSizes.length}`);
  console.log(`  MERGES - Duplicate Models: ${issues.merges.duplicateModels.length}`);
  console.log(`  WARNINGS: ${issues.warnings.length}`);
  console.log(`\nOutput written to: ${OUTPUT_FILE}`);
}

main();
