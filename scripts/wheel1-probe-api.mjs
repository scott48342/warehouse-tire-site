/**
 * Wheel-1 API Probe
 *
 * Calls GET /api/v1/inventory with the provided key and dumps:
 *   - HTTP status + headers
 *   - Field names found in the first record
 *   - Sample of first 3 records (full)
 *   - Total record count
 *
 * Usage:
 *   node scripts/wheel1-probe-api.mjs <API_KEY> [--csv]
 *
 * The --csv flag requests CSV format instead of JSON.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = 'https://api.thewheelgroup.info/api/v1';

const [,, apiKey, ...flags] = process.argv;
const wantCsv = flags.includes('--csv');

if (!apiKey) {
  console.error('Usage: node scripts/wheel1-probe-api.mjs <API_KEY> [--csv]');
  process.exit(1);
}

async function probe() {
  const url = wantCsv
    ? `${BASE_URL}/inventory?format=csv`
    : `${BASE_URL}/inventory`;

  console.log(`\n🔍 Probing: ${url}`);
  console.log(`   X-API-Key: ${apiKey.substring(0, 6)}****\n`);

  const res = await fetch(url, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': wantCsv ? 'text/csv' : 'application/json',
    },
  });

  console.log(`HTTP ${res.status} ${res.statusText}`);
  console.log('Headers:', Object.fromEntries([...res.headers.entries()].filter(([k]) =>
    ['content-type', 'content-length', 'x-total-count', 'x-rate-limit-remaining'].includes(k.toLowerCase())
  )));

  const body = await res.text();

  if (!res.ok) {
    console.error('\n❌ Error response:');
    console.error(body.substring(0, 500));
    process.exit(1);
  }

  if (wantCsv) {
    const lines = body.split('\n');
    console.log(`\n📄 CSV - ${lines.length} lines`);
    console.log('Headers row:', lines[0]);
    console.log('Sample row 1:', lines[1]);
    console.log('Sample row 2:', lines[2]);
    return;
  }

  let data;
  try {
    data = JSON.parse(body);
  } catch {
    console.error('Body is not valid JSON. First 2000 chars:');
    console.error(body.substring(0, 2000));
    process.exit(1);
  }

  // Handle both array and { data: [...] } shapes
  const records = Array.isArray(data) ? data : (data.data ?? data.items ?? data.results ?? []);
  const meta    = Array.isArray(data) ? null : { ...data, data: undefined, items: undefined, results: undefined };

  console.log(`\n📦 Total records: ${records.length}`);
  if (meta && Object.keys(meta).some(k => meta[k] !== undefined)) {
    console.log('Response envelope (non-data keys):', JSON.stringify(meta, null, 2));
  }

  if (records.length === 0) {
    console.log('⚠️  No records returned.');
    return;
  }

  // Field discovery
  const firstRecord = records[0];
  const fields = Object.keys(firstRecord);
  console.log(`\n🔑 Fields found (${fields.length}):`);
  fields.forEach(f => {
    const val = firstRecord[f];
    const type = typeof val;
    console.log(`  ${f.padEnd(30)} ${type.padEnd(10)} = ${JSON.stringify(val)}`);
  });

  // Sample records
  console.log('\n📋 First 3 records:');
  records.slice(0, 3).forEach((r, i) => {
    console.log(`\n  Record ${i + 1}:`);
    Object.entries(r).forEach(([k, v]) => console.log(`    ${k}: ${JSON.stringify(v)}`));
  });

  // SKU field detection heuristic
  const skuCandidates = fields.filter(f => /sku|part|item|number/i.test(f));
  const costCandidates = fields.filter(f => /cost|price|dealer|net/i.test(f));
  const mapCandidates  = fields.filter(f => /map/i.test(f));
  const qtyCandidates  = fields.filter(f => /qty|quant|stock|count|avail|inv/i.test(f));
  const whCandidates   = fields.filter(f => /warehouse|location|wh|depot/i.test(f));

  console.log('\n🗺️  Field mapping candidates:');
  console.log('  SKU:        ', skuCandidates);
  console.log('  Dealer cost:', costCandidates);
  console.log('  MAP:        ', mapCandidates);
  console.log('  Quantity:   ', qtyCandidates);
  console.log('  Warehouse:  ', whCandidates);

  console.log('\n✅ Probe complete. Paste field names into wheel1-inventory-sync.mjs FIELD_MAP.');
}

probe().catch(e => {
  console.error('Probe failed:', e.message);
  process.exit(1);
});
