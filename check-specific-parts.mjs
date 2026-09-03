import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const { checkStockByPartNumber, checkStockBySize } = await import('./src/lib/usautoforce/client.ts');

// Try checking stock by part number directly
console.log('=== Checking by Part Number (with lineCode HAN) ===');

const parts = [
  { pn: '1038485', lineCode: 'HAN', desc: 'Ventus S1 AS H125 235/45R18' },
  { pn: '1034062', lineCode: 'HAN', desc: 'Dynapro HT2 RH14 275/50R22' },
];

for (const p of parts) {
  console.log(`\n--- ${p.pn}: ${p.desc} ---`);
  const result = await checkStockByPartNumber(p.pn, p.lineCode, {
    branch: '4101',
    alternateBranches: ['4102', '4103', '4104', '4105', '4106', '4107', '4108'],
    quantity: 4,
  });
  console.log('Success:', result.success);
  console.log('Items:', result.items?.length || 0);
  console.log('Error:', result.errorMessage || 'none');
  if (result.items?.length > 0) {
    console.log('First item:', JSON.stringify(result.items[0], null, 2));
  }
}

// Also try searching by size again, but check if maybe the size format matters
console.log('\n=== Trying different size formats ===');
const sizes = ['235/45R18', '2354518', '235/45/18', '23545R18'];
for (const size of sizes) {
  const r = await checkStockBySize(size, { branch: '4101', quantity: 1 });
  console.log(`Size "${size}": ${r.success ? r.items.length + ' items' : 'FAILED: ' + r.errorMessage}`);
  
  // Check if 1038485 is in the results
  const found = r.items?.find(i => i.partNumber === '1038485');
  if (found) {
    console.log('  ^^^ FOUND 1038485!');
  }
}
