/**
 * Quick validation of mixed-diameter stagger fix
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

const tests = [
  { name: 'Corvette 19F/20R', y: 2024, ma: 'Chevrolet', mo: 'Corvette', tr: 'Stingray', fd: 19, rd: 20, exp: {f: 19, r: 20} },
  { name: 'Mustang 19F/20R', y: 2024, ma: 'Ford', mo: 'Mustang', tr: 'GT Performance Pack', fd: 19, rd: 20, exp: {f: 19, r: 20} },
  { name: 'Camaro 20F/21R', y: 2024, ma: 'Chevrolet', mo: 'Camaro', tr: 'SS 1LE', fd: 20, rd: 21, exp: {f: 20, r: 21} },
  { name: 'Mustang 19/19 (same dia)', y: 2024, ma: 'Ford', mo: 'Mustang', tr: 'GT Performance Pack', fd: 19, rd: 19, exp: {f: 19, r: 19} },
  { name: 'F-150 20/20 (square)', y: 2024, ma: 'Ford', mo: 'F-150', tr: 'XLT', fd: 20, rd: 20, exp: {f: 20, r: 20} },
  { name: 'Camry 19/19 (square)', y: 2024, ma: 'Toyota', mo: 'Camry', tr: 'XSE', fd: 19, rd: 19, exp: {f: 19, r: 19} },
];

function extractDia(size) {
  if (!size) return null;
  // Handle R19, ZR19, direct:R19 formats
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║     Mixed-Diameter Stagger Fix Validation                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  let passed = 0;
  let failed = 0;
  
  for (const t of tests) {
    const url = `${BASE_URL}/api/tires/search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}&modification=${encodeURIComponent(t.tr)}&wheelDiameter=${t.fd}&rearWheelDiameter=${t.rd}&pageSize=5`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const searched = d.tireSizesSearched;
      let frontDia = null, rearDia = null;
      
      if (searched?.front && searched?.rear) {
        // Mixed stagger response
        frontDia = extractDia(searched.front[0]);
        rearDia = extractDia(searched.rear[0]);
      } else if (Array.isArray(searched)) {
        // Square response
        frontDia = extractDia(searched[0]);
        rearDia = extractDia(searched[1] || searched[0]);
      }
      
      const pass = frontDia === t.exp.f && rearDia === t.exp.r;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        passed++;
        console.log(`${icon} ${t.name.padEnd(28)} | R${frontDia}/R${rearDia} ✓`);
      } else {
        failed++;
        console.log(`${icon} ${t.name.padEnd(28)} | Expected R${t.exp.f}/R${t.exp.r}, got R${frontDia}/R${rearDia}`);
        console.log(`   Raw: ${JSON.stringify(searched)}`);
      }
    } catch (e) {
      failed++;
      console.log(`🔴 ${t.name.padEnd(28)} | Error: ${e.message}`);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Results: ${passed}/${tests.length} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  process.exit(failed > 0 ? 1 : 0);
}

run();
