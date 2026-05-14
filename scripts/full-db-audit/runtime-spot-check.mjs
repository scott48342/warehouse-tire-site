/**
 * Runtime Spot-Check Script
 * Tests API endpoints for sample vehicles to verify no 500s, no deprecated usage
 * 
 * Usage: node runtime-spot-check.mjs --samples=samples.json
 */

import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env.local') });

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

async function testTrimsEndpoint(year, make, model) {
  const url = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { status: res.status, trimCount: data.trims?.length || 0 };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function testTireSizesEndpoint(year, make, model, trim) {
  const url = `${BASE_URL}/api/vehicles/tire-sizes?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json();
    
    return {
      status: res.status,
      source: data.source,
      tireSizes: data.tireSizes?.length || 0,
      staggered: data.staggered?.isStaggered || false,
      hasDeprecatedUsage: data.source === 'config' || data.source === 'static',
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function testWheelFitmentEndpoint(year, make, model, trim) {
  const url = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${encodeURIComponent(trim)}&limit=5`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { status: res.status, error: `HTTP ${res.status}` };
    const data = await res.json();
    
    return {
      status: res.status,
      wheelCount: data.wheels?.length || 0,
      has500: false,
    };
  } catch (err) {
    return { status: 'error', error: err.message };
  }
}

async function runSpotChecks(samples) {
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║   RUNTIME SPOT-CHECK: ${samples.length} vehicles`.padEnd(64) + `║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝\n`);
  
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    totalChecked: samples.length,
    passed: 0,
    failed: 0,
    has500: 0,
    hasDeprecatedUsage: 0,
    noTireSizes: 0,
    details: [],
  };
  
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    const { year, make, model, trim } = sample;
    
    console.log(`[${i + 1}/${samples.length}] ${year} ${make} ${model} ${trim || '(no trim)'}...`);
    
    const tireSizesResult = await testTireSizesEndpoint(year, make, model, trim || '');
    const wheelResult = await testWheelFitmentEndpoint(year, make, model, trim || '');
    
    const detail = {
      vehicle: { year, make, model, trim },
      tireSizes: tireSizesResult,
      wheels: wheelResult,
      passed: true,
      issues: [],
    };
    
    // Check for 500s
    if (tireSizesResult.status === 500 || tireSizesResult.status === 'error') {
      detail.issues.push(`TIRE_SIZES_ERROR: ${tireSizesResult.error || 'HTTP 500'}`);
      results.has500++;
      detail.passed = false;
    }
    if (wheelResult.status === 500 || wheelResult.status === 'error') {
      detail.issues.push(`WHEEL_SEARCH_ERROR: ${wheelResult.error || 'HTTP 500'}`);
      results.has500++;
      detail.passed = false;
    }
    
    // Check for deprecated usage
    if (tireSizesResult.hasDeprecatedUsage) {
      detail.issues.push(`DEPRECATED_SOURCE: ${tireSizesResult.source}`);
      results.hasDeprecatedUsage++;
      detail.passed = false;
    }
    
    // Check for no tire sizes (not necessarily a failure, but track it)
    if (tireSizesResult.tireSizes === 0 && tireSizesResult.status === 200) {
      detail.issues.push('NO_TIRE_SIZES');
      results.noTireSizes++;
    }
    
    if (detail.passed) {
      results.passed++;
      console.log(`  ✅ PASS (tires: ${tireSizesResult.tireSizes}, wheels: ${wheelResult.wheelCount})`);
    } else {
      results.failed++;
      console.log(`  ❌ FAIL: ${detail.issues.join(', ')}`);
    }
    
    results.details.push(detail);
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════════`);
  console.log(`RUNTIME SPOT-CHECK COMPLETE`);
  console.log(`═══════════════════════════════════════════════════════════════`);
  console.log(`Total checked:       ${results.totalChecked}`);
  console.log(`Passed:              ${results.passed}`);
  console.log(`Failed:              ${results.failed}`);
  console.log(`Has 500 errors:      ${results.has500}`);
  console.log(`Deprecated usage:    ${results.hasDeprecatedUsage}`);
  console.log(`No tire sizes:       ${results.noTireSizes}`);
  console.log(`═══════════════════════════════════════════════════════════════\n`);
  
  return results;
}

// If called with --samples, load and run
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, val] = arg.replace('--', '').split('=');
  acc[key] = val;
  return acc;
}, {});

if (args.samples) {
  const samplesPath = resolve(__dirname, args.samples);
  const samples = JSON.parse(readFileSync(samplesPath, 'utf-8'));
  runSpotChecks(samples).then(results => {
    const outputPath = resolve(__dirname, 'output', 'runtime-spot-check.json');
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`Results written to: ${outputPath}`);
  });
}

export { runSpotChecks, testTireSizesEndpoint, testWheelFitmentEndpoint };
