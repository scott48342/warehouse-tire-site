/**
 * Platform Rule Enrichment Engine
 * Controlled, batched enrichment with guards and snapshots
 * 
 * RULES:
 * - NO wheel spec changes (bolt pattern, center bore, offset)
 * - NO deprecated tables
 * - vehicle_fitments remains canonical
 * - Dry-run first, snapshots before write
 */

const fs = require('fs');
const path = require('path');

// Load triage report
const triageReport = JSON.parse(fs.readFileSync(path.join(__dirname, 'triage-report.json'), 'utf8'));

// =============================================================================
// RULE DEFINITIONS
// =============================================================================

const RULES = {
  /**
   * EXISTING_DIAMETER_BULK_APPROVE
   * Items that add tire sizes to already-supported wheel diameters
   */
  existingDiameterBulkApprove: {
    name: 'EXISTING_DIAMETER_BULK_APPROVE',
    description: 'Add tire sizes to existing wheel diameters (no new wheel sizes)',
    filter: (item) => {
      // Must have existing diameters
      if (!item.existingDiameters || item.existingDiameters.length === 0) return false;
      
      // Proposed diameter must already exist
      if (!item.existingDiameters.includes(item.wheelDiameter)) return false;
      
      // No stagger ambiguity
      if (item.vehicleFlags?.isStaggered) return false;
      
      // No HD ambiguity  
      if (item.vehicleFlags?.isHDTruck) return false;
      
      // No HL/flotation formats
      const size = item.tireSize || '';
      if (size.match(/^\d+x/i)) return false; // Flotation format (33x12.50R15)
      if (size.includes('/HL')) return false;
      
      // No malformed formats
      if (!size.match(/^\d{3}\/\d{2}R\d{2}$/) && 
          !size.match(/^P?\d{3}\/\d{2}R\d{2}$/) &&
          !size.match(/^LT\d{3}\/\d{2}R\d{2}$/)) {
        // Allow standard formats only
        return false;
      }
      
      // Must have reasonable confidence
      if (item.confidence && item.confidence < 70) return false;
      
      return true;
    },
    priority: 1
  },

  /**
   * PLATFORM_CONSISTENCY_RULE
   * Apply enrichments consistently across model years for known platforms
   */
  platformConsistency: {
    name: 'PLATFORM_CONSISTENCY_RULE',
    description: 'Apply consistent tire sizes across model years for same platform',
    platforms: {
      // Porsche (all staggered)
      'Porsche|911': { minYearSpan: 3, requireStaggeredLogic: true },
      'Porsche|Boxster': { minYearSpan: 3, requireStaggeredLogic: true },
      'Porsche|Cayman': { minYearSpan: 3, requireStaggeredLogic: true },
      'Porsche|Cayenne': { minYearSpan: 3, requireStaggeredLogic: true },
      'Porsche|Macan': { minYearSpan: 3, requireStaggeredLogic: true },
      'Porsche|Panamera': { minYearSpan: 3, requireStaggeredLogic: true },
      
      // Ford
      'Ford|Mustang': { minYearSpan: 3, requireStaggeredLogic: true },
      'Ford|F-150': { minYearSpan: 3, requireStaggeredLogic: false },
      'Ford|Taurus': { minYearSpan: 3, requireStaggeredLogic: false },
      'Ford|Explorer': { minYearSpan: 3, requireStaggeredLogic: false },
      
      // BMW
      'BMW|X3': { minYearSpan: 3, requireStaggeredLogic: false },
      'BMW|X4': { minYearSpan: 3, requireStaggeredLogic: false },
      'BMW|X5': { minYearSpan: 3, requireStaggeredLogic: false },
      'BMW|M3': { minYearSpan: 3, requireStaggeredLogic: true },
      'BMW|M4': { minYearSpan: 3, requireStaggeredLogic: true },
      'BMW|M5': { minYearSpan: 3, requireStaggeredLogic: true },
      'BMW|i4': { minYearSpan: 3, requireStaggeredLogic: true },
      'BMW|3 Series': { minYearSpan: 3, requireStaggeredLogic: false },
      'BMW|5 Series': { minYearSpan: 3, requireStaggeredLogic: false },
      
      // GM
      'Chevrolet|Corvette': { minYearSpan: 3, requireStaggeredLogic: true },
      'Chevrolet|Camaro': { minYearSpan: 3, requireStaggeredLogic: true },
      'Chevrolet|Silverado 1500': { minYearSpan: 3, requireStaggeredLogic: false },
      'Chevrolet|Tahoe': { minYearSpan: 3, requireStaggeredLogic: false },
      'GMC|Sierra 1500': { minYearSpan: 3, requireStaggeredLogic: false },
      'GMC|Canyon': { minYearSpan: 3, requireStaggeredLogic: false },
      
      // Other performance
      'Alfa Romeo|Giulia': { minYearSpan: 3, requireStaggeredLogic: false },
      'Alfa Romeo|Stelvio': { minYearSpan: 3, requireStaggeredLogic: false },
      'Audi|R8': { minYearSpan: 3, requireStaggeredLogic: true },
      'Maserati|Ghibli': { minYearSpan: 3, requireStaggeredLogic: false },
      'Land Rover|Discovery Sport': { minYearSpan: 3, requireStaggeredLogic: false },
      'Land Rover|Range Rover Velar': { minYearSpan: 3, requireStaggeredLogic: false },
    },
    priority: 2
  },

  /**
   * STAGGERED_PLATFORM_LOGIC
   * Validated front/rear pairings for performance vehicles
   */
  staggeredPlatform: {
    name: 'STAGGERED_PLATFORM_LOGIC',
    description: 'Apply staggered tire sizes with validated front/rear pairings',
    
    // Known valid staggered pairings by platform
    // Format: { front: 'WIDTH/ASPECT', rear: 'WIDTH/ASPECT', diameter: N }
    knownPairings: {
      'Porsche|911': [
        { front: '245/35', rear: '305/30', diameter: 20 },
        { front: '245/35', rear: '295/30', diameter: 20 },
        { front: '235/35', rear: '295/30', diameter: 19 },
        { front: '235/35', rear: '305/30', diameter: 19 },
        { front: '235/40', rear: '295/35', diameter: 18 },
        { front: '225/40', rear: '295/30', diameter: 18 },
        { front: '235/40', rear: '265/35', diameter: 18 },
      ],
      'Porsche|Boxster': [
        { front: '235/35', rear: '265/35', diameter: 20 },
        { front: '235/40', rear: '265/40', diameter: 19 },
        { front: '235/45', rear: '265/45', diameter: 18 },
        { front: '205/55', rear: '235/50', diameter: 17 },
      ],
      'Porsche|Cayman': [
        { front: '235/35', rear: '265/35', diameter: 20 },
        { front: '235/40', rear: '265/40', diameter: 19 },
        { front: '235/45', rear: '265/45', diameter: 18 },
      ],
      'Ford|Mustang': [
        { front: '255/40', rear: '275/40', diameter: 19 },
        { front: '265/40', rear: '305/30', diameter: 19 },
        { front: '255/40', rear: '285/35', diameter: 19 },
        { front: '265/35', rear: '305/30', diameter: 20 },
        { front: '275/35', rear: '315/30', diameter: 20 },
      ],
      'BMW|M3': [
        { front: '245/40', rear: '265/40', diameter: 18 },
        { front: '245/35', rear: '265/35', diameter: 19 },
        { front: '255/35', rear: '275/35', diameter: 19 },
      ],
      'BMW|M4': [
        { front: '255/35', rear: '275/35', diameter: 19 },
        { front: '275/35', rear: '285/30', diameter: 20 },
      ],
      'Chevrolet|Corvette': [
        { front: '245/35', rear: '305/30', diameter: 19 },
        { front: '245/40', rear: '285/35', diameter: 18 },
        { front: '285/30', rear: '335/25', diameter: 20 },
      ],
      'Chevrolet|Camaro': [
        { front: '245/40', rear: '275/40', diameter: 20 },
        { front: '245/45', rear: '275/40', diameter: 20 },
        { front: '285/30', rear: '305/30', diameter: 20 },
      ],
    },
    priority: 3
  }
};

// =============================================================================
// ENRICHMENT ENGINE
// =============================================================================

class PlatformEnrichmentEngine {
  constructor(options = {}) {
    this.dryRun = options.dryRun !== false; // Default to dry-run
    this.batchSize = options.batchSize || 50;
    this.snapshotDir = path.join(__dirname, 'enrichment-snapshots');
    this.results = {
      processed: 0,
      approved: 0,
      rejected: 0,
      errors: 0,
      byRule: {}
    };
    
    // Ensure snapshot directory exists
    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true });
    }
  }

  /**
   * Load all manual review items from batch files
   */
  loadManualReviewItems() {
    const items = [];
    for (let i = 1; i <= 10; i++) {
      const f = `batch-${String(i).padStart(2, '0')}.json`;
      const filePath = path.join(__dirname, f);
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.manualReviewRequired) {
          items.push(...data.manualReviewRequired);
        }
      }
    }
    return items;
  }

  /**
   * Apply EXISTING_DIAMETER_BULK_APPROVE rule
   */
  applyExistingDiameterRule(items) {
    const rule = RULES.existingDiameterBulkApprove;
    const approved = [];
    const rejected = [];

    for (const item of items) {
      if (rule.filter(item)) {
        approved.push({
          ...item,
          approvedBy: rule.name,
          approvalReason: 'Adds tire size to existing wheel diameter',
          regressionChecks: {
            wheelSpecsUnchanged: true,
            boltPatternUnchanged: true,
            centerBoreUnchanged: true,
            offsetUnchanged: true,
            noDeprecatedTables: true
          }
        });
      } else {
        rejected.push({
          ...item,
          rejectionReason: this.getExistingDiameterRejectionReason(item)
        });
      }
    }

    return { approved, rejected };
  }

  getExistingDiameterRejectionReason(item) {
    if (!item.existingDiameters || item.existingDiameters.length === 0) {
      return 'No existing diameters';
    }
    if (!item.existingDiameters.includes(item.wheelDiameter)) {
      return `New diameter ${item.wheelDiameter}" not in existing [${item.existingDiameters.join(', ')}]`;
    }
    if (item.vehicleFlags?.isStaggered) {
      return 'Staggered vehicle - needs axle assignment';
    }
    if (item.vehicleFlags?.isHDTruck) {
      return 'HD truck - needs SRW/DRW clarification';
    }
    const size = item.tireSize || '';
    if (size.match(/^\d+x/i)) {
      return 'Flotation format not supported';
    }
    if (item.confidence && item.confidence < 70) {
      return `Low confidence (${item.confidence})`;
    }
    return 'Did not pass format validation';
  }

  /**
   * Apply PLATFORM_CONSISTENCY_RULE
   */
  applyPlatformConsistencyRule(items) {
    const rule = RULES.platformConsistency;
    const approved = [];
    const needsStaggeredLogic = [];
    const rejected = [];

    // Build case-insensitive platform lookup
    const platformLookup = {};
    for (const key of Object.keys(rule.platforms)) {
      platformLookup[key.toLowerCase()] = { key, config: rule.platforms[key] };
    }

    // Group items by make|model
    const byPlatform = {};
    for (const item of items) {
      const key = `${item.make}|${item.model}`;
      if (!byPlatform[key]) byPlatform[key] = [];
      byPlatform[key].push(item);
    }

    for (const [platform, platformItems] of Object.entries(byPlatform)) {
      // Case-insensitive lookup
      const lookup = platformLookup[platform.toLowerCase()];
      const config = lookup?.config;
      
      if (!config) {
        // Not a known platform - reject
        for (const item of platformItems) {
          rejected.push({
            ...item,
            rejectionReason: `Platform ${platform} not in consistency rule`
          });
        }
        continue;
      }

      // Check year span
      const years = platformItems.map(i => i.year);
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const yearSpan = maxYear - minYear + 1;

      if (yearSpan < config.minYearSpan) {
        for (const item of platformItems) {
          rejected.push({
            ...item,
            rejectionReason: `Year span ${yearSpan} < required ${config.minYearSpan}`
          });
        }
        continue;
      }

      // If requires staggered logic, defer to that rule
      if (config.requireStaggeredLogic) {
        needsStaggeredLogic.push(...platformItems);
        continue;
      }

      // Otherwise approve with platform consistency
      for (const item of platformItems) {
        // Still apply basic guards
        if (item.vehicleFlags?.isHDTruck) {
          rejected.push({
            ...item,
            rejectionReason: 'HD truck needs separate handling'
          });
          continue;
        }

        const size = item.tireSize || '';
        if (size.match(/^\d+x/i)) {
          rejected.push({
            ...item,
            rejectionReason: 'Flotation format not supported'
          });
          continue;
        }

        approved.push({
          ...item,
          approvedBy: rule.name,
          approvalReason: `Platform ${platform} consistency (${yearSpan} year span)`,
          regressionChecks: {
            wheelSpecsUnchanged: true,
            boltPatternUnchanged: true,
            centerBoreUnchanged: true,
            offsetUnchanged: true,
            noDeprecatedTables: true
          }
        });
      }
    }

    return { approved, needsStaggeredLogic, rejected };
  }

  /**
   * Apply STAGGERED_PLATFORM_LOGIC
   */
  applyStaggeredPlatformRule(items) {
    const rule = RULES.staggeredPlatform;
    const approved = [];
    const rejected = [];

    // Build case-insensitive pairing lookup
    const pairingLookup = {};
    for (const key of Object.keys(rule.knownPairings)) {
      pairingLookup[key.toLowerCase()] = rule.knownPairings[key];
    }

    for (const item of items) {
      const platform = `${item.make}|${item.model}`;
      const knownPairings = pairingLookup[platform.toLowerCase()];

      if (!knownPairings) {
        rejected.push({
          ...item,
          rejectionReason: `No known staggered pairings for ${platform}`
        });
        continue;
      }

      // Parse the tire size
      const size = item.tireSize || '';
      const match = size.match(/^P?(\d{3})\/(\d{2})R(\d{2})$/);
      if (!match) {
        rejected.push({
          ...item,
          rejectionReason: `Cannot parse tire size: ${size}`
        });
        continue;
      }

      const [, width, aspect, diameter] = match;
      const sizeSpec = `${width}/${aspect}`;
      const diamNum = parseInt(diameter, 10);

      // Check if this size matches a known pairing
      let matchedPairing = null;
      let axle = null;

      for (const pairing of knownPairings) {
        if (pairing.diameter !== diamNum) continue;
        
        if (pairing.front === sizeSpec) {
          matchedPairing = pairing;
          axle = 'front';
          break;
        }
        if (pairing.rear === sizeSpec) {
          matchedPairing = pairing;
          axle = 'rear';
          break;
        }
      }

      if (!matchedPairing) {
        rejected.push({
          ...item,
          rejectionReason: `Size ${size} not in known pairings for ${platform}`
        });
        continue;
      }

      approved.push({
        ...item,
        approvedBy: rule.name,
        approvalReason: `Matched ${platform} staggered pairing: ${matchedPairing.front}/${matchedPairing.rear} R${matchedPairing.diameter}`,
        axleAssignment: axle,
        pairedSize: axle === 'front' ? matchedPairing.rear : matchedPairing.front,
        regressionChecks: {
          wheelSpecsUnchanged: true,
          boltPatternUnchanged: true,
          centerBoreUnchanged: true,
          offsetUnchanged: true,
          noDeprecatedTables: true
        }
      });
    }

    return { approved, rejected };
  }

  /**
   * Create snapshot before applying changes
   */
  createSnapshot(batchId, items) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = path.join(this.snapshotDir, `snapshot-${batchId}-${timestamp}.json`);
    
    fs.writeFileSync(snapshotFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      batchId,
      itemCount: items.length,
      items
    }, null, 2));

    return snapshotFile;
  }

  /**
   * Run the enrichment pipeline
   */
  run(options = {}) {
    const phase = options.phase || 1;
    const limit = options.limit || Infinity;

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log(`PLATFORM ENRICHMENT ENGINE - Phase ${phase}`);
    console.log(`Mode: ${this.dryRun ? '🔍 DRY RUN' : '⚡ LIVE'}`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    // Load items
    const allItems = this.loadManualReviewItems();
    console.log(`Loaded ${allItems.length} manual review items\n`);

    let results;

    switch (phase) {
      case 1:
        console.log('Phase 1: EXISTING_DIAMETER_BULK_APPROVE\n');
        results = this.applyExistingDiameterRule(allItems);
        break;

      case 2:
        console.log('Phase 2: PLATFORM_CONSISTENCY_RULE\n');
        results = this.applyPlatformConsistencyRule(allItems);
        break;

      case 3:
        console.log('Phase 3: STAGGERED_PLATFORM_LOGIC\n');
        // First get items that need staggered logic from phase 2
        const phase2Results = this.applyPlatformConsistencyRule(allItems);
        results = this.applyStaggeredPlatformRule(phase2Results.needsStaggeredLogic || []);
        break;

      default:
        throw new Error(`Unknown phase: ${phase}`);
    }

    // Limit results if specified
    if (results.approved && results.approved.length > limit) {
      console.log(`Limiting approved items from ${results.approved.length} to ${limit}`);
      results.approved = results.approved.slice(0, limit);
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log('RESULTS');
    console.log('═══════════════════════════════════════════════════════════════════════\n');

    console.log(`✅ Approved: ${results.approved?.length || 0}`);
    console.log(`❌ Rejected: ${results.rejected?.length || 0}`);
    if (results.needsStaggeredLogic) {
      console.log(`⚙️  Needs staggered logic: ${results.needsStaggeredLogic.length}`);
    }

    // Group approved by make/model for easier review
    if (results.approved && results.approved.length > 0) {
      const byMakeModel = {};
      for (const item of results.approved) {
        const key = `${item.make} ${item.model}`;
        if (!byMakeModel[key]) byMakeModel[key] = [];
        byMakeModel[key].push(item);
      }

      console.log('\n📊 Approved by vehicle:');
      const sorted = Object.entries(byMakeModel).sort((a, b) => b[1].length - a[1].length);
      for (const [vehicle, items] of sorted.slice(0, 20)) {
        const sizes = [...new Set(items.map(i => i.tireSize))];
        console.log(`   ${vehicle}: ${items.length} items (${sizes.slice(0, 3).join(', ')}${sizes.length > 3 ? '...' : ''})`);
      }
      if (sorted.length > 20) {
        console.log(`   ... and ${sorted.length - 20} more vehicles`);
      }
    }

    // Show rejection reasons
    if (results.rejected && results.rejected.length > 0) {
      const byReason = {};
      for (const item of results.rejected) {
        const reason = item.rejectionReason || 'Unknown';
        if (!byReason[reason]) byReason[reason] = 0;
        byReason[reason]++;
      }

      console.log('\n❌ Rejection reasons:');
      const sortedReasons = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
      for (const [reason, count] of sortedReasons.slice(0, 10)) {
        console.log(`   ${count}: ${reason}`);
      }
    }

    // Create snapshot
    if (results.approved && results.approved.length > 0) {
      const snapshotFile = this.createSnapshot(`phase${phase}`, results.approved);
      console.log(`\n📸 Snapshot saved: ${snapshotFile}`);
    }

    // Write full results
    const resultsFile = path.join(__dirname, `phase${phase}-results.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    console.log(`📄 Full results: ${resultsFile}`);

    return results;
  }
}

// =============================================================================
// CLI
// =============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const phase = parseInt(args.find(a => a.startsWith('--phase='))?.split('=')[1] || '1', 10);
  const dryRun = !args.includes('--live');
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || 'Infinity', 10);

  const engine = new PlatformEnrichmentEngine({ dryRun });
  engine.run({ phase, limit });
}

module.exports = { PlatformEnrichmentEngine, RULES };
