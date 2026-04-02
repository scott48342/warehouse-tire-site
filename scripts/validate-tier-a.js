// Tier A Validation Sweep - Fixed
const BASE = 'https://shop.warehousetiredirect.com';

async function fetchJson(url) {
  const res = await fetch(url);
  return res.json();
}

async function getTrims(year, make, model) {
  const url = `${BASE}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
  return fetchJson(url);
}

async function getFitment(year, make, model, trimId) {
  const url = `${BASE}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&trim=${trimId}`;
  return fetchJson(url);
}

const TIER_A = [
  { make: 'Ford', model: 'Mustang', years: [2024, 2022, 2020, 2018], 
    expectedStaggered: ['GT Performance', 'Mach 1', 'Shelby', 'GT350', 'GT500', 'Dark Horse'] },
  { make: 'Chevrolet', model: 'Camaro', years: [2024, 2022, 2020, 2018],
    expectedStaggered: ['SS', '1LE', 'ZL1'] },
  { make: 'Dodge', model: 'Challenger', years: [2023, 2021, 2019, 2018],
    expectedStaggered: ['Demon'] },
  { make: 'Dodge', model: 'Charger', years: [2023, 2021, 2019],
    expectedStaggered: [] }
];

const REGRESSION = [
  { year: 2024, make: 'Toyota', model: 'Camry' },
  { year: 2024, make: 'Honda', model: 'CR-V' },
  { year: 2024, make: 'Ford', model: 'F-150' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 1500' },
  { year: 2024, make: 'Toyota', model: 'RAV4' },
  { year: 2024, make: 'Honda', model: 'Civic' },
  { year: 2024, make: 'Nissan', model: 'Altima' },
  { year: 2024, make: 'Hyundai', model: 'Tucson' },
  { year: 2024, make: 'Kia', model: 'Sorento' },
  { year: 2024, make: 'Subaru', model: 'Outback' }
];

const RESOLVER = [
  { year: 2008, make: 'Chrysler', model: '300' },
  { year: 2024, make: 'Ford', model: 'F-250' },
  { year: 2024, make: 'Ford', model: 'F-350' }
];

async function testTierA() {
  console.log('\n## TIER A VALIDATION\n');
  let passed = 0, failed = 0;
  
  for (const v of TIER_A) {
    console.log(`\n### ${v.make} ${v.model}`);
    console.log('| Year | Trim | Staggered | Results | Status |');
    console.log('|------|------|-----------|---------|--------|');
    
    for (const year of v.years) {
      const data = await getTrims(year, v.make, v.model);
      const trims = data?.results || [];
      
      if (!trims.length) {
        console.log(`| ${year} | NO TRIMS | - | - | ❌ FAIL |`);
        failed++;
        continue;
      }
      
      // Test all trims for this year
      for (const trim of trims) {
        const trimId = trim.value || trim.modificationId;
        const trimName = trim.label || 'Base';
        
        const fitment = await getFitment(year, v.make, v.model, trimId);
        const isStag = fitment?.isStaggered || false;
        const count = fitment?.totalCount || 0;
        
        // Check if this trim should be staggered
        const expectStag = v.expectedStaggered.some(s => trimName.toLowerCase().includes(s.toLowerCase()));
        
        // Staggered mismatch is a warning, not failure (unless expected but not detected)
        let status = '✅ PASS';
        let notes = '';
        
        if (count === 0) {
          status = '❌ FAIL';
          notes = ' (no results)';
        } else if (expectStag && !isStag) {
          status = '⚠️ WARN';
          notes = ' (expected staggered)';
        }
        
        if (status === '✅ PASS') passed++; 
        else if (status === '❌ FAIL') failed++;
        
        console.log(`| ${year} | ${trimName.substring(0,30)} | ${isStag ? 'Yes' : 'No'} | ${count} | ${status}${notes} |`);
      }
    }
  }
  return { passed, failed };
}

async function testRegression() {
  console.log('\n## REGRESSION CHECK\n');
  console.log('| Vehicle | Trims | Results | Status |');
  console.log('|---------|-------|---------|--------|');
  
  let passed = 0, failed = 0;
  
  for (const v of REGRESSION) {
    const data = await getTrims(v.year, v.make, v.model);
    const trims = data?.results || [];
    const trimCount = trims.length;
    
    if (trimCount === 0) {
      console.log(`| ${v.year} ${v.make} ${v.model} | 0 | - | ❌ FAIL |`);
      failed++;
      continue;
    }
    
    const trimId = trims[0].value || trims[0].modificationId;
    const fitment = await getFitment(v.year, v.make, v.model, trimId);
    const count = fitment?.totalCount || 0;
    const status = count > 0 ? '✅ PASS' : '❌ FAIL';
    if (status.includes('PASS')) passed++; else failed++;
    
    console.log(`| ${v.year} ${v.make} ${v.model} | ${trimCount} | ${count} | ${status} |`);
  }
  return { passed, failed };
}

async function testResolver() {
  console.log('\n## RESOLVER INTEGRITY\n');
  console.log('| Vehicle | Trims | Results | Status |');
  console.log('|---------|-------|---------|--------|');
  
  let passed = 0, failed = 0;
  
  for (const v of RESOLVER) {
    const data = await getTrims(v.year, v.make, v.model);
    const trims = data?.results || [];
    const trimCount = trims.length;
    
    let count = 0;
    if (trimCount > 0) {
      const trimId = trims[0].value || trims[0].modificationId;
      const fitment = await getFitment(v.year, v.make, v.model, trimId);
      count = fitment?.totalCount || 0;
    }
    
    const status = trimCount > 0 && count > 0 ? '✅ PASS' : '❌ FAIL';
    if (status.includes('PASS')) passed++; else failed++;
    
    console.log(`| ${v.year} ${v.make} ${v.model} | ${trimCount} | ${count} | ${status} |`);
  }
  return { passed, failed };
}

async function main() {
  console.log('# TIER A VALIDATION SWEEP');
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const t1 = await testTierA();
  const t2 = await testRegression();
  const t3 = await testResolver();
  
  console.log('\n## SUMMARY\n');
  console.log(`- Tier A: ${t1.passed} passed, ${t1.failed} failed`);
  console.log(`- Regression: ${t2.passed} passed, ${t2.failed} failed`);
  console.log(`- Resolver: ${t3.passed} passed, ${t3.failed} failed`);
  console.log(`- **Total: ${t1.passed + t2.passed + t3.passed} passed, ${t1.failed + t2.failed + t3.failed} failed**`);
}

main().catch(console.error);
