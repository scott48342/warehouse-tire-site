// Deep test BMW M3/M4 tire search
const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

async function testTireSearch(year, make, model, trim) {
  const url = `${BASE_URL}/api/tires/search?year=${year}&make=${make}&model=${model}&trim=${encodeURIComponent(trim)}`;
  console.log('URL:', url);
  const response = await fetch(url);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2).slice(0, 2000));
  return data;
}

console.log('Testing 2024 BMW M3 "M3 Competition":');
await testTireSearch(2024, 'BMW', 'M3', 'M3 Competition');

console.log('\n\nTesting 2024 BMW M4 "Competition":');
await testTireSearch(2024, 'BMW', 'M4', 'Competition');

console.log('\n\nTesting 2024 BMW M3 "Base" (should fail):');
await testTireSearch(2024, 'BMW', 'M3', 'Base');
