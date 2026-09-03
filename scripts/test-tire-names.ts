import { cleanTireDisplayTitle } from '../src/lib/productFormat';

const tests = [
  // Toyo examples from API
  { input: 'OPAT3 117T', brand: 'Toyo', expected: 'Open Country A/T III' },
  { input: 'OPRT TRL 116Q SL', brand: 'Toyo', expected: 'Open Country R/T Trail' },
  { input: 'OPAT3 LT C6', brand: 'Toyo', expected: 'Open Country A/T III' },
  { input: 'OPRT LT E10', brand: 'Toyo', expected: 'Open Country R/T' },
  { input: 'OPAT3 121/118S E10 32.8', brand: 'Toyo', expected: 'Open Country A/T III' },
  { input: 'OPRT TRL 126/123Q E10 32.8', brand: 'Toyo', expected: 'Open Country R/T Trail' },
  { input: 'CELSI CUV', brand: 'Toyo', expected: 'Celsius CUV' },
  // Other brands
  { input: 'DUEL AT REVO 3', brand: 'Bridgestone', expected: 'Dueler AT Revo 3' },
  { input: 'WRNGL AT ADVENTURE', brand: 'Goodyear', expected: 'Wrangler AT Adventure' },
  { input: 'GRAB APX', brand: 'General', expected: 'Grabber APX' },
  { input: 'RDGR M/T', brand: 'Nitto', expected: 'Ridge Grappler M/T' },
  { input: 'DISC AT3 XLT', brand: 'Cooper', expected: 'Discoverer AT3 XLT' },
  { input: 'WILD AT3W', brand: 'Falken', expected: 'Wildpeak AT3W' },
  { input: 'DYNA HT RH12', brand: 'Hankook', expected: 'Dynapro HT RH12' },
  { input: 'GEOL AT G015', brand: 'Yokohama', expected: 'Geolandar AT G015' },
];

console.log('Testing cleanTireDisplayTitle abbreviation expansion:\n');
for (const t of tests) {
  const result = cleanTireDisplayTitle(t.input, t.brand);
  const pass = result.toLowerCase().includes(t.expected.toLowerCase().split(' ')[0]);
  console.log(`${pass ? '✅' : '❌'} "${t.input}" (${t.brand})`);
  console.log(`   → "${result}"`);
  if (!pass) console.log(`   Expected to contain: "${t.expected}"`);
  console.log();
}
