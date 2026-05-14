#!/usr/bin/env node
/**
 * Production Smoke Test - Staggered Fitment
 * Tests live API endpoints
 */

const BASE_URL = 'https://shop.warehousetiredirect.com';

const tests = [
  {
    name: '2024 Camaro Trims',
    url: '/api/vehicles/trims?year=2024&make=Chevrolet&model=Camaro',
    validate: (data) => {
      const trims = data.results || data.trims || data;
      return Array.isArray(trims) && trims.length > 0;
    },
  },
  {
    name: '2024 Corvette Trims',
    url: '/api/vehicles/trims?year=2024&make=Chevrolet&model=Corvette',
    validate: (data) => {
      const trims = data.results || data.trims || data;
      return Array.isArray(trims) && trims.length > 0;
    },
  },
  {
    name: '2024 BMW M4 Trims',
    url: '/api/vehicles/trims?year=2024&make=BMW&model=M4',
    validate: (data) => {
      const trims = data.results || data.trims || data;
      return Array.isArray(trims) && trims.length > 0;
    },
  },
  {
    name: 'Makes API (2024)',
    url: '/api/vehicles/makes?year=2024',
    validate: (data) => {
      const makes = data.results || data.makes || data;
      return Array.isArray(makes) && makes.some(m => m === 'Chevrolet' || m.name === 'Chevrolet');
    },
  },
  {
    name: 'Models API (2024 Chevrolet)',
    url: '/api/vehicles/models?year=2024&make=Chevrolet',
    validate: (data) => {
      const models = data.results || data.models || data;
      return Array.isArray(models) && models.some(m => m === 'Camaro' || m.name === 'Camaro');
    },
  },
];

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   PRODUCTION SMOKE TEST                                      ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
console.log(`Testing: ${BASE_URL}\n`);

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    const response = await fetch(`${BASE_URL}${test.url}`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (test.validate(data)) {
      console.log(`✅ ${test.name}`);
      passed++;
    } else {
      console.log(`❌ ${test.name} - Validation failed`);
      console.log(`   Response: ${JSON.stringify(data).slice(0, 200)}...`);
      failed++;
    }
  } catch (err) {
    console.log(`❌ ${test.name} - ${err.message}`);
    failed++;
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed}/${tests.length} passed`);

if (failed > 0) {
  console.log(`\n⚠️  ${failed} tests failed`);
  process.exit(1);
} else {
  console.log(`\n✅ All smoke tests passed!`);
}
