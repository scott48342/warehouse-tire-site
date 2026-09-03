import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const { checkStockBySize } = await import('./src/lib/usautoforce/client.ts');

// Search 235/45R18
console.log('=== 235/45R18 ===');
const r1 = await checkStockBySize('235/45R18', {
  branch: '4101',
  alternateBranches: ['4102', '4103', '4104', '4105'],
  quantity: 1, // Get all items, not just those with 4+ stock
});

if (r1.success) {
  console.log(`Found ${r1.items.length} total tires`);
  
  // Filter to Hankook (brand code HAN)
  const hankook = r1.items.filter(i => i.brandCode === 'HAN');
  console.log(`\nHankook tires (${hankook.length}):`);
  for (const t of hankook) {
    const qty = t.availability?.reduce((sum, a) => sum + a.quantityAvailable, 0) || 0;
    console.log(`  ${t.partNumber}: ${t.model || t.description}`);
    console.log(`    Cost: $${t.cost}, Stock: ${qty}`);
  }
  
  // Show first few non-Hankook for reference
  console.log('\nOther brands (first 5):');
  const other = r1.items.filter(i => i.brandCode !== 'HAN').slice(0, 5);
  for (const t of other) {
    console.log(`  ${t.brandCode} ${t.partNumber}: ${t.model || t.description}`);
  }
}

// Search 275/50R22
console.log('\n=== 275/50R22 ===');
const r2 = await checkStockBySize('275/50R22', {
  branch: '4101',
  alternateBranches: ['4102', '4103', '4104', '4105'],
  quantity: 1,
});

if (r2.success) {
  console.log(`Found ${r2.items.length} total tires`);
  
  const hankook = r2.items.filter(i => i.brandCode === 'HAN');
  console.log(`\nHankook tires (${hankook.length}):`);
  for (const t of hankook) {
    const qty = t.availability?.reduce((sum, a) => sum + a.quantityAvailable, 0) || 0;
    console.log(`  ${t.partNumber}: ${t.model || t.description}`);
    console.log(`    Cost: $${t.cost}, Stock: ${qty}`);
  }
}

// Check if the specific part numbers exist in ANY size
console.log('\n=== Looking for exact part numbers ===');
const allItems = [...(r1.items || []), ...(r2.items || [])];
const found1 = allItems.find(i => i.partNumber === '1038485');
const found2 = allItems.find(i => i.partNumber === '1034062');
console.log('Part# 1038485:', found1 ? `Found! ${found1.description}` : 'NOT FOUND');
console.log('Part# 1034062:', found2 ? `Found! ${found2.description}` : 'NOT FOUND');
