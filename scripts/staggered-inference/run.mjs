#!/usr/bin/env node
/**
 * Staggered Front/Rear Inference Review Pipeline
 * 
 * Purpose: Analyze WTD fitment data to propose front/rear staggered mappings
 * Output: Reviewable proposals ONLY - NO DB writes
 * 
 * Usage: node run.mjs [--dry-run] [--platform=corvette]
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

// Known performance platforms with staggered setups
const TARGET_PLATFORMS = [
  // Chevrolet
  { make: 'Chevrolet', model: 'Corvette' },
  { make: 'Chevrolet', model: 'Camaro' },
  // Ford
  { make: 'Ford', model: 'Mustang' },
  // BMW
  { make: 'BMW', model: 'M3' },
  { make: 'BMW', model: 'M4' },
  { make: 'BMW', model: 'M5' },
  // Nissan
  { make: 'Nissan', model: 'GT-R' },
  // Porsche
  { make: 'Porsche', model: '911' },
  { make: 'Porsche', model: 'Boxster' },
  { make: 'Porsche', model: 'Cayman' },
  { make: 'Porsche', model: '718 Boxster' },
  { make: 'Porsche', model: '718 Cayman' },
];

// Pre-approved performance platforms (99% confidence when pattern matches)
const TIER_A_PLATFORMS = new Set([
  'Chevrolet Corvette',
  'Chevrolet Camaro',
  'Ford Mustang',
  'BMW M3',
  'BMW M4',
  'BMW M5',
  'Nissan GT-R',
  'Porsche 911',
  'Porsche Boxster',
  'Porsche Cayman',
  'Porsche 718 Boxster',
  'Porsche 718 Cayman',
]);

// Known staggered trims (highest confidence)
const KNOWN_STAGGERED_TRIMS = new Set([
  // Mustang
  'Shelby GT350',
  'Shelby GT500',
  'GT Performance Pack',
  'Dark Horse',
  // Camaro
  'SS 1LE',
  'ZL1',
  'ZL1 1LE',
  // Corvette
  'Z06',
  'ZR1',
  'Grand Sport',
  'Stingray',
  // BMW
  'Competition',
  'CS',
  // Porsche
  'Carrera S',
  'Carrera 4S',
  'Turbo',
  'Turbo S',
  'GT3',
  'GT3 RS',
]);

/**
 * Parse a tire size string into components
 * Examples: "245/40R18", "P245/40ZR18", "285/30ZR19"
 */
function parseTireSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== 'string') return null;
  
  // Clean up the string
  const clean = sizeStr.trim().toUpperCase();
  
  // Match patterns like: P?245/40Z?R18, 285/30ZR19, 315/35R20
  const match = clean.match(/^P?(\d{2,3})\/(\d{2,3})Z?R(\d{2})$/);
  if (!match) return null;
  
  return {
    original: sizeStr,
    width: parseInt(match[1], 10),
    aspectRatio: parseInt(match[2], 10),
    rimDiameter: parseInt(match[3], 10),
  };
}

/**
 * Infer front/rear assignment from a set of tire sizes
 * Returns: { front, rear, confidence, reason, needsReview }
 */
function inferStaggeredAssignment(sizes, platform, trimName = '') {
  // Ensure sizes is an array of strings
  const sizeStrings = Array.isArray(sizes) 
    ? sizes.filter(s => typeof s === 'string')
    : [];
  
  const parsed = sizeStrings.map(parseTireSize).filter(Boolean);
  
  if (parsed.length < 2) {
    return { front: null, rear: null, confidence: 0, reason: 'Insufficient sizes', needsReview: true };
  }
  
  // Dedupe by original string
  const unique = [...new Map(parsed.map(p => [p.original, p])).values()];
  
  if (unique.length < 2) {
    return { front: null, rear: null, confidence: 0, reason: 'All sizes identical - not staggered', needsReview: false, isSquare: true };
  }
  
  const isTierA = TIER_A_PLATFORMS.has(platform);
  const isKnownStaggeredTrim = [...KNOWN_STAGGERED_TRIMS].some(t => 
    trimName.toLowerCase().includes(t.toLowerCase())
  );
  
  // Case 1: Two sizes, same rim diameter, different widths
  if (unique.length === 2) {
    const [a, b] = unique.sort((x, y) => x.width - y.width);
    
    if (a.rimDiameter === b.rimDiameter && a.width !== b.width) {
      // Clear case: narrower front, wider rear
      let confidence = 95;
      if (isTierA) confidence = 97;
      if (isKnownStaggeredTrim) confidence = 99;
      
      return {
        front: a.original,
        rear: b.original,
        confidence,
        reason: `Same rim (${a.rimDiameter}"), width diff: ${a.width}mm front / ${b.width}mm rear`,
        needsReview: false,
      };
    }
    
    // Case 2: Different rim diameters
    if (a.rimDiameter !== b.rimDiameter) {
      const smaller = a.rimDiameter < b.rimDiameter ? a : b;
      const larger = a.rimDiameter < b.rimDiameter ? b : a;
      
      // Typical: smaller/narrower = front, larger/wider = rear
      if (smaller.width <= larger.width) {
        let confidence = 90;
        if (isTierA) confidence = 93;
        if (isKnownStaggeredTrim) confidence = 97;
        
        return {
          front: smaller.original,
          rear: larger.original,
          confidence,
          reason: `Diff rim: ${smaller.rimDiameter}" front (${smaller.width}mm) / ${larger.rimDiameter}" rear (${larger.width}mm)`,
          needsReview: false,
        };
      }
      
      // Unusual: smaller rim but wider - needs review
      return {
        front: smaller.original,
        rear: larger.original,
        confidence: 70,
        reason: `Unusual: smaller rim (${smaller.rimDiameter}") is wider (${smaller.width}mm) - verify`,
        needsReview: true,
      };
    }
    
    // Same width, same diameter but different aspect ratios
    if (a.width === b.width && a.aspectRatio !== b.aspectRatio) {
      return {
        front: null,
        rear: null,
        confidence: 0,
        reason: `Same width (${a.width}mm), diff aspect ratio - unusual, needs manual review`,
        needsReview: true,
      };
    }
  }
  
  // Case 3: Four sizes - try to find two obvious pairs
  if (unique.length >= 3) {
    // Group by rim diameter
    const byDiameter = {};
    for (const s of unique) {
      if (!byDiameter[s.rimDiameter]) byDiameter[s.rimDiameter] = [];
      byDiameter[s.rimDiameter].push(s);
    }
    
    const diameters = Object.keys(byDiameter).map(Number).sort((a, b) => a - b);
    
    // Find the largest diameter pair with width difference
    for (let i = diameters.length - 1; i >= 0; i--) {
      const diamSizes = byDiameter[diameters[i]];
      if (diamSizes.length >= 2) {
        const sorted = diamSizes.sort((x, y) => x.width - y.width);
        if (sorted[0].width !== sorted[sorted.length - 1].width) {
          const front = sorted[0];
          const rear = sorted[sorted.length - 1];
          
          let confidence = 85;
          if (isTierA) confidence = 88;
          if (isKnownStaggeredTrim) confidence = 92;
          
          return {
            front: front.original,
            rear: rear.original,
            confidence,
            reason: `${unique.length} sizes, using ${diameters[i]}" pair: ${front.width}mm front / ${rear.width}mm rear`,
            needsReview: true, // Still review since we're picking one package
            allSizes: unique.map(u => u.original),
            selectedPackage: `${diameters[i]}" option`,
          };
        }
      }
    }
    
    return {
      front: null,
      rear: null,
      confidence: 0,
      reason: `${unique.length} unique sizes, complex pattern - manual review required`,
      needsReview: true,
      allSizes: unique.map(u => u.original),
    };
  }
  
  return {
    front: null,
    rear: null,
    confidence: 0,
    reason: `Unknown pattern`,
    needsReview: true,
  };
}

/**
 * Main pipeline
 */
async function runPipeline() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   STAGGERED FRONT/REAR INFERENCE REVIEW PIPELINE            ║');
  console.log('║   Mode: REVIEW ONLY - NO DB WRITES                          ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Connect to database
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not configured');
    process.exit(1);
  }
  
  console.log('📡 Connecting to database...');
  const sql = postgres(connectionString);
  
  const proposals = [];
  const stats = {
    totalRecords: 0,
    totalProposals: 0,
    approveCount: 0,
    reviewCount: 0,
    rejectCount: 0,
    squareSetups: 0,
    noTireSizes: 0,
  };
  
  try {
    for (const platform of TARGET_PLATFORMS) {
      console.log(`\n📊 Processing: ${platform.make} ${platform.model}`);
      console.log('─'.repeat(60));
      
      // Query WTD database for this platform
      const fitments = await sql`
        SELECT 
          id,
          year,
          make,
          model,
          display_trim as "displayTrim",
          submodel,
          modification_id as "modificationId",
          oem_tire_sizes as "oemTireSizes",
          oem_wheel_sizes as "oemWheelSizes",
          bolt_pattern as "boltPattern",
          source,
          quality_tier as "qualityTier"
        FROM vehicle_fitments
        WHERE make = ${platform.make}
          AND model = ${platform.model}
          AND year >= 2010
        ORDER BY year DESC, display_trim
      `;
      
      console.log(`  Found ${fitments.length} fitment records`);
      
      for (const fitment of fitments) {
        stats.totalRecords++;
        
        const tireSizes = fitment.oemTireSizes;
        
        // Skip if no tire sizes
        if (!tireSizes || !Array.isArray(tireSizes) || tireSizes.length === 0) {
          stats.noTireSizes++;
          continue;
        }
        
        // Flatten if nested arrays
        const flatSizes = tireSizes.flat().filter(s => typeof s === 'string');
        
        if (flatSizes.length < 2) {
          stats.noTireSizes++;
          continue;
        }
        
        // Run inference
        const platformKey = `${platform.make} ${platform.model}`;
        const inference = inferStaggeredAssignment(flatSizes, platformKey, fitment.displayTrim || '');
        
        if (inference.isSquare) {
          stats.squareSetups++;
          continue;
        }
        
        if (!inference.front || !inference.rear) {
          if (inference.needsReview && flatSizes.length >= 2) {
            // Complex case - still propose for review
            const proposal = {
              id: fitment.id,
              year: fitment.year,
              make: fitment.make,
              model: fitment.model,
              trim: fitment.displayTrim,
              submodel: fitment.submodel,
              modificationId: fitment.modificationId,
              allTireSizes: flatSizes,
              proposedFront: null,
              proposedRear: null,
              confidence: 0,
              inferenceReason: inference.reason,
              oemWheelSizes: fitment.oemWheelSizes,
              boltPattern: fitment.boltPattern,
              source: fitment.source,
              recommendation: 'review',
              needsManualReview: true,
            };
            proposals.push(proposal);
            stats.reviewCount++;
          }
          continue;
        }
        
        // Determine recommendation
        let recommendation;
        if (inference.confidence >= 95 && !inference.needsReview) {
          recommendation = 'approve';
          stats.approveCount++;
        } else if (inference.confidence >= 85) {
          recommendation = 'review';
          stats.reviewCount++;
        } else {
          recommendation = 'reject';
          stats.rejectCount++;
        }
        
        const proposal = {
          id: fitment.id,
          year: fitment.year,
          make: fitment.make,
          model: fitment.model,
          trim: fitment.displayTrim,
          submodel: fitment.submodel,
          modificationId: fitment.modificationId,
          allTireSizes: flatSizes,
          proposedFront: inference.front,
          proposedRear: inference.rear,
          confidence: inference.confidence,
          inferenceReason: inference.reason,
          oemWheelSizes: fitment.oemWheelSizes,
          boltPattern: fitment.boltPattern,
          source: fitment.source,
          recommendation,
          needsManualReview: inference.needsReview,
        };
        
        proposals.push(proposal);
        stats.totalProposals++;
        
        // Log high-confidence finds
        if (inference.confidence >= 95) {
          console.log(`  ✅ ${fitment.year} ${fitment.displayTrim}: ${inference.confidence}% - F:${inference.front} R:${inference.rear}`);
        }
      }
    }
    
    // Also query for ANY vehicle with multiple tire sizes
    console.log('\n📊 Scanning ALL vehicles for staggered patterns...');
    console.log('─'.repeat(60));
    
    let allMultiSize = [];
    try {
      // Use safer query that handles mixed JSON types
      allMultiSize = await sql`
        SELECT 
          id,
          year,
          make,
          model,
          display_trim as "displayTrim",
          submodel,
          modification_id as "modificationId",
          oem_tire_sizes as "oemTireSizes",
          oem_wheel_sizes as "oemWheelSizes",
          bolt_pattern as "boltPattern",
          source
        FROM vehicle_fitments
        WHERE oem_tire_sizes IS NOT NULL
          AND oem_tire_sizes::text LIKE '[%'
          AND year >= 2010
        ORDER BY make, model, year DESC
        LIMIT 5000
      `;
    } catch (err) {
      console.log(`  ⚠️  Secondary query failed: ${err.message}`);
      console.log(`  Continuing with target platforms only...`);
    }
    
    console.log(`  Found ${allMultiSize.length} vehicles with tire size data`);
    
    const additionalPlatforms = new Set();
    
    for (const fitment of allMultiSize) {
      // Skip already processed platforms
      const platformKey = `${fitment.make} ${fitment.model}`;
      if (TARGET_PLATFORMS.some(p => p.make === fitment.make && p.model === fitment.model)) {
        continue;
      }
      
      stats.totalRecords++;
      
      const tireSizes = fitment.oemTireSizes;
      if (!tireSizes || !Array.isArray(tireSizes)) continue;
      
      const flatSizes = tireSizes.flat().filter(s => typeof s === 'string');
      if (flatSizes.length < 2) continue;
      
      // Check if sizes are actually different
      const uniqueSizes = [...new Set(flatSizes)];
      if (uniqueSizes.length < 2) {
        stats.squareSetups++;
        continue;
      }
      
      // Run inference (no Tier A boost)
      const inference = inferStaggeredAssignment(flatSizes, platformKey, fitment.displayTrim || '');
      
      if (inference.isSquare) {
        stats.squareSetups++;
        continue;
      }
      
      if (!inference.front || !inference.rear) continue;
      if (inference.confidence < 85) continue;
      
      additionalPlatforms.add(platformKey);
      
      let recommendation;
      if (inference.confidence >= 95 && !inference.needsReview) {
        recommendation = 'approve';
        stats.approveCount++;
      } else if (inference.confidence >= 85) {
        recommendation = 'review';
        stats.reviewCount++;
      } else {
        recommendation = 'reject';
        stats.rejectCount++;
      }
      
      const proposal = {
        id: fitment.id,
        year: fitment.year,
        make: fitment.make,
        model: fitment.model,
        trim: fitment.displayTrim,
        submodel: fitment.submodel,
        modificationId: fitment.modificationId,
        allTireSizes: flatSizes,
        proposedFront: inference.front,
        proposedRear: inference.rear,
        confidence: inference.confidence,
        inferenceReason: inference.reason,
        oemWheelSizes: fitment.oemWheelSizes,
        boltPattern: fitment.boltPattern,
        source: fitment.source,
        recommendation,
        needsManualReview: inference.needsReview,
      };
      
      proposals.push(proposal);
      stats.totalProposals++;
    }
    
    console.log(`  Found ${additionalPlatforms.size} additional staggered platforms:`);
    for (const p of [...additionalPlatforms].slice(0, 20)) {
      console.log(`    • ${p}`);
    }
    if (additionalPlatforms.size > 20) {
      console.log(`    ... and ${additionalPlatforms.size - 20} more`);
    }
    
  } finally {
    await sql.end();
  }
  
  // Sort proposals by confidence
  proposals.sort((a, b) => b.confidence - a.confidence);
  
  // Generate output
  const output = {
    generatedAt: new Date().toISOString(),
    mode: 'REVIEW_ONLY',
    dbWritesEnabled: false,
    summary: {
      totalRecordsAnalyzed: stats.totalRecords,
      totalProposals: stats.totalProposals,
      approveCandidates: stats.approveCount,
      reviewCandidates: stats.reviewCount,
      rejectCandidates: stats.rejectCount,
      squareSetups: stats.squareSetups,
      noTireSizeData: stats.noTireSizes,
    },
    highConfidenceMappings: proposals.filter(p => p.confidence >= 95).slice(0, 100),
    allProposals: proposals,
  };
  
  // Write output
  const outputDir = resolve(__dirname, 'output');
  mkdirSync(outputDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = resolve(outputDir, `staggered-proposals-${timestamp}.json`);
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  
  // Print summary
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                        SUMMARY                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`
  📊 Total Records Analyzed:    ${stats.totalRecords}
  📝 Total Proposals:           ${stats.totalProposals}
  ✅ Approve Candidates:        ${stats.approveCount}
  🔍 Review Candidates:         ${stats.reviewCount}
  ❌ Reject Candidates:         ${stats.rejectCount}
  ⬜ Square Setups (skipped):   ${stats.squareSetups}
  📭 No Tire Data:              ${stats.noTireSizes}
  
  📁 Output: ${outputPath}
  `);
  
  // Print top 20 high-confidence mappings
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              TOP 20 HIGH-CONFIDENCE MAPPINGS                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const top20 = proposals.filter(p => p.confidence >= 90).slice(0, 20);
  for (const p of top20) {
    console.log(`  ${p.year} ${p.make} ${p.model} ${p.trim || ''}`);
    console.log(`    Front: ${p.proposedFront}`);
    console.log(`    Rear:  ${p.proposedRear}`);
    console.log(`    Confidence: ${p.confidence}% - ${p.recommendation.toUpperCase()}`);
    console.log(`    Reason: ${p.inferenceReason}`);
    console.log('');
  }
  
  console.log('⚠️  REMINDER: This is REVIEW ONLY. No database changes were made.');
  console.log('    Review the JSON output and apply changes manually after verification.\n');
  
  return output;
}

// Run
runPipeline().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
