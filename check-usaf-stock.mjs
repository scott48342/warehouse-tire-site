// Use production credentials
process.env.USAUTOFORCE_USERNAME = 'warehousetire';
process.env.USAUTOFORCE_PASSWORD = '***';
process.env.USAUTOFORCE_ACCOUNT = '1381479';

const { checkStockBySize } = await import('./src/lib/usautoforce/client.ts');

// Search for Hankook Ventus S1 AS H125 in 235/45R18
console.log('--- Searching USAF for 235/45R18 ---');
const result = await checkStockBySize('235/45R18', {
  branch: '4101',
  alternateBranches: ['4102', '4103', '4104', '4105'],
  quantity: 4,
});

console.log('Total items:', result.items.length);

// Find any Hankook Ventus
const ventus = result.items.filter(i => 
  i.description?.toLowerCase().includes('ventus') ||
  i.model?.toLowerCase().includes('ventus')
);
console.log('\nVentus models found:');
for (const t of ventus) {
  console.log(`  ${t.partNumber}: ${t.description || t.model}`);
  console.log(`    Brand code: ${t.brandCode}, Cost: $${t.cost}, Stock: ${t.availability?.[0]?.quantityAvailable || 0}`);
}

// Also look for the specific part numbers from the order
console.log('\n--- Looking for specific part numbers ---');
const pn1 = result.items.find(i => i.partNumber === '1038485');
console.log('1038485 found in 235/45R18:', pn1 ? 'YES' : 'NO');

// Check 275/50R22 for the other part
console.log('\n--- Searching USAF for 275/50R22 ---');
const result2 = await checkStockBySize('275/50R22', {
  branch: '4101',
  alternateBranches: ['4102', '4103', '4104', '4105'],
  quantity: 4,
});

console.log('Total items:', result2.items.length);

// Find Dynapro HT2
const dynapro = result2.items.filter(i => 
  i.description?.toLowerCase().includes('dynapro') ||
  i.model?.toLowerCase().includes('dynapro')
);
console.log('\nDynapro models found:');
for (const t of dynapro) {
  console.log(`  ${t.partNumber}: ${t.description || t.model}`);
  console.log(`    Brand code: ${t.brandCode}, Cost: $${t.cost}, Stock: ${t.availability?.[0]?.quantityAvailable || 0}`);
}

const pn2 = result2.items.find(i => i.partNumber === '1034062');
console.log('\n1034062 found in 275/50R22:', pn2 ? 'YES' : 'NO');

// Dump ALL part numbers to see if these exist at all
console.log('\n--- All part numbers in 235/45R18 results ---');
console.log(result.items.map(i => i.partNumber).sort().join(', '));

console.log('\n--- All part numbers in 275/50R22 results ---');
console.log(result2.items.map(i => i.partNumber).sort().join(', '));
