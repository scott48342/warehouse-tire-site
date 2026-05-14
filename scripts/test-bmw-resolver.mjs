// Test BMW M3/M4 resolver behavior after delete
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function fetchJson(url) {
  const response = await fetch(url);
  return response.json();
}

async function testTrims(year, model) {
  const url = `${BASE_URL}/api/vehicles/trims?year=${year}&make=BMW&model=${model}`;
  const data = await fetchJson(url);
  return data.trims || data.error || data;
}

async function testFitment(year, model, trim) {
  const url = `${BASE_URL}/api/tires/search?year=${year}&make=BMW&model=${model}&trim=${encodeURIComponent(trim)}`;
  const data = await fetchJson(url);
  return {
    tires: data.tires?.length || 0,
    error: data.error || null,
    message: data.message || null,
    availableTrims: data.availableTrims || null
  };
}

console.log('=' .repeat(60));
console.log(' BMW M3/M4 RESOLVER TEST');
console.log(' Base URL:', BASE_URL);
console.log('=' .repeat(60));
console.log();

console.log('📋 TRIM AVAILABILITY (2021-2026):');
console.log();

for (const year of [2024, 2025, 2026]) {
  for (const model of ['M3', 'M4']) {
    const trims = await testTrims(year, model);
    console.log(`  ${year} ${model}: ${Array.isArray(trims) ? trims.join(', ') : JSON.stringify(trims)}`);
  }
}

console.log();
console.log('🔍 BASE TRIM SEARCH (should fail or show alternatives):');
console.log();

for (const year of [2024]) {
  for (const model of ['M3', 'M4']) {
    const result = await testFitment(year, model, 'Base');
    console.log(`  ${year} ${model} "Base":`);
    console.log(`    Tires: ${result.tires}, Error: ${result.error || 'none'}`);
    if (result.availableTrims) {
      console.log(`    Available trims: ${result.availableTrims.join(', ')}`);
    }
  }
}

console.log();
console.log('✅ REAL TRIM SEARCH (should return results):');
console.log();

const realTests = [
  { year: 2024, model: 'M3', trim: 'M3 Competition' },
  { year: 2024, model: 'M4', trim: 'Competition' },
  { year: 2024, model: 'M3', trim: 'M3 CS' },
  { year: 2024, model: 'M4', trim: 'CS' },
];

for (const t of realTests) {
  const result = await testFitment(t.year, t.model, t.trim);
  const status = result.tires > 0 ? '✅' : '❌';
  console.log(`  ${status} ${t.year} ${t.model} "${t.trim}": ${result.tires} tires`);
}

console.log();
console.log('Done.');
