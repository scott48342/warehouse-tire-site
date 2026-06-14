/**
 * Comprehensive 50-Vehicle Test
 * Tests all selling paths against the migrated Universal Fitment Resolver
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NATIONAL_BASE = 'https://shop.warehousetiredirect.com';
const LOCAL_BASE = 'https://shop.warehousetire.net';

// Load test vehicles
const vehicles = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-vehicles.json'), 'utf-8'));

// Results storage
const results = [];
const failures = [];

async function fetchJSON(url, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status };
    return await res.json();
  } catch (e) {
    clearTimeout(id);
    return { error: e.message };
  }
}

async function testVehicle(v, index) {
  const { year, make, model, category } = v;
  const params = new URLSearchParams({ year: String(year), make, model });
  const result = {
    index: index + 1,
    year,
    make,
    model,
    category,
    normalizedModel: null,
    boltPattern: null,
    oemTireSizes: [],
    tireSizesOk: false,
    tiresCount: 0,
    tiresOk: false,
    wheelsCount: 0,
    wheelsOk: false,
    packagesCount: 0,
    packagesOk: false,
    domain: 'national',
    errors: [],
    warnings: [],
    pass: false
  };

  try {
    // 1. Tire Sizes API
    const tireSizesUrl = `${NATIONAL_BASE}/api/vehicles/tire-sizes?${params}`;
    const tireSizesData = await fetchJSON(tireSizesUrl);
    if (tireSizesData.error) {
      result.errors.push(`tire-sizes: ${tireSizesData.error}`);
    } else {
      result.tireSizesOk = (tireSizesData.tireSizes?.length > 0) || tireSizesData.trimResolutionRequired;
      result.oemTireSizes = tireSizesData.tireSizes || [];
      result.boltPattern = tireSizesData.fitment?.boltPattern || null;
      if (tireSizesData.trimResolutionRequired) {
        result.warnings.push(`Trim selection required (${tireSizesData.availableTrims?.length || 0} trims)`);
      }
    }

    // 2. Wheels Fitment Search API
    const wheelsUrl = `${NATIONAL_BASE}/api/wheels/fitment-search?${params}`;
    const wheelsData = await fetchJSON(wheelsUrl);
    if (wheelsData.error) {
      result.errors.push(`wheels: ${wheelsData.error}`);
    } else if (wheelsData.blocked) {
      result.warnings.push(`wheels: blocked - ${wheelsData.blockReason}`);
      result.wheelsOk = true; // Blocked is a valid response
    } else {
      result.wheelsCount = wheelsData.totalCount || 0;
      result.wheelsOk = wheelsData.totalCount > 0;
      // Check bolt pattern consistency
      const wheelsBolt = wheelsData.debug?.boltPattern || wheelsData.filters?.boltPatterns?.[0];
      if (wheelsBolt && result.boltPattern && wheelsBolt !== result.boltPattern) {
        result.errors.push(`Bolt pattern mismatch: tire-sizes=${result.boltPattern}, wheels=${wheelsBolt}`);
      }
      if (!result.boltPattern && wheelsBolt) {
        result.boltPattern = wheelsBolt;
      }
    }

    // 3. Tires Search API
    const tiresUrl = `${NATIONAL_BASE}/api/tires/search?${params}`;
    const tiresData = await fetchJSON(tiresUrl);
    if (tiresData.error && !tiresData.trimResolutionRequired) {
      result.errors.push(`tires: ${tiresData.error}`);
    } else if (tiresData.trimResolutionRequired) {
      result.warnings.push(`tires: Trim selection required`);
      result.tiresOk = true; // Valid response
    } else {
      result.tiresCount = tiresData.results?.length || 0;
      result.tiresOk = tiresData.results?.length > 0;
      // Verify OEM sizes match
      const tiresOem = tiresData.oemTireSizes || [];
      if (tiresOem.length > 0 && result.oemTireSizes.length > 0) {
        const match = tiresOem.some(s => result.oemTireSizes.includes(s));
        if (!match) {
          result.warnings.push(`OEM size mismatch between tire-sizes and tires/search`);
        }
      }
    }

    // 4. Packages Recommended API
    const packagesUrl = `${NATIONAL_BASE}/api/packages/recommended?${params}`;
    const packagesData = await fetchJSON(packagesUrl);
    if (packagesData.error) {
      result.errors.push(`packages: ${packagesData.error}`);
    } else {
      result.packagesCount = packagesData.packages?.length || 0;
      result.packagesOk = packagesData.packages?.length > 0 || !packagesData.fitment?.boltPattern;
      // Check bolt pattern consistency
      const pkgBolt = packagesData.fitment?.boltPattern;
      if (pkgBolt && result.boltPattern && pkgBolt !== result.boltPattern) {
        result.errors.push(`Bolt pattern mismatch: tire-sizes=${result.boltPattern}, packages=${pkgBolt}`);
      }
    }

    // Determine overall pass/fail
    // Pass if: tire-sizes resolves AND (tires OR wheels returns products OR valid no-result reason)
    result.pass = result.tireSizesOk && 
                  (result.tiresOk || result.wheelsOk) && 
                  result.errors.length === 0;

  } catch (e) {
    result.errors.push(`Exception: ${e.message}`);
  }

  return result;
}

async function runTests() {
  console.log('Starting comprehensive 50-vehicle test...');
  console.log(`Testing ${vehicles.length} vehicles against ${NATIONAL_BASE}`);
  console.log('');

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    process.stdout.write(`[${i + 1}/${vehicles.length}] ${v.year} ${v.make} ${v.model}... `);
    const result = await testVehicle(v, i);
    results.push(result);
    
    if (result.pass) {
      console.log(`✅ (W:${result.wheelsCount} T:${result.tiresCount} P:${result.packagesCount})`);
    } else {
      console.log(`❌ ${result.errors.join(', ')}`);
      failures.push(result);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  // Output summary
  console.log('');
  console.log('═'.repeat(80));
  console.log('SUMMARY');
  console.log('═'.repeat(80));
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${results.filter(r => r.pass).length}`);
  console.log(`Failed: ${failures.length}`);
  console.log('');

  // Output table
  console.log('RESULTS TABLE:');
  console.log('─'.repeat(120));
  console.log('# | Year | Make | Model | Category | Bolt | OEM Sizes | Tires | Wheels | Pkgs | Pass');
  console.log('─'.repeat(120));
  
  for (const r of results) {
    const sizes = r.oemTireSizes.slice(0, 2).join(', ') + (r.oemTireSizes.length > 2 ? '...' : '');
    const pass = r.pass ? '✅' : '❌';
    console.log(
      `${String(r.index).padStart(2)} | ${r.year} | ${r.make.padEnd(12)} | ${r.model.padEnd(20)} | ${r.category.padEnd(12)} | ${(r.boltPattern || '-').padEnd(8)} | ${sizes.padEnd(25)} | ${String(r.tiresCount).padStart(5)} | ${String(r.wheelsCount).padStart(6)} | ${String(r.packagesCount).padStart(4)} | ${pass}`
    );
  }
  console.log('─'.repeat(120));

  // Output failures
  if (failures.length > 0) {
    console.log('');
    console.log('FAILURES:');
    console.log('─'.repeat(80));
    for (const f of failures) {
      console.log(`${f.year} ${f.make} ${f.model}:`);
      for (const e of f.errors) console.log(`  ERROR: ${e}`);
      for (const w of f.warnings) console.log(`  WARN: ${w}`);
    }
  }

  // Save results to JSON
  fs.writeFileSync(
    path.join(__dirname, 'comprehensive-test-results.json'),
    JSON.stringify({ results, failures, summary: { total: results.length, passed: results.filter(r => r.pass).length, failed: failures.length } }, null, 2)
  );
  console.log('');
  console.log('Results saved to scripts/comprehensive-test-results.json');
}

runTests().catch(e => {
  console.error('Test runner error:', e);
  process.exit(1);
});
