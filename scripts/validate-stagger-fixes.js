/**
 * Final validation of all staggered fitment fixes
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

function extractDia(size) {
  if (!size) return null;
  const m = size.match(/R(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

async function runValidation() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║          STAGGERED FITMENT FIX VALIDATION                            ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const results = { pass: 0, fail: 0, tests: [] };
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: Mixed-diameter stagger in tire search API
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('P1: MIXED-DIAMETER STAGGER SEARCH');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const mixedDiameterTests = [
    { name: 'Corvette 19F/20R', y: 2024, ma: 'Chevrolet', mo: 'Corvette', tr: 'Stingray', fd: 19, rd: 20, exp: {f: 19, r: 20} },
    { name: 'Mustang 19F/20R', y: 2024, ma: 'Ford', mo: 'Mustang', tr: 'GT Performance Pack', fd: 19, rd: 20, exp: {f: 19, r: 20} },
    { name: 'Camaro 20F/21R', y: 2024, ma: 'Chevrolet', mo: 'Camaro', tr: 'SS 1LE', fd: 20, rd: 21, exp: {f: 20, r: 21} },
  ];
  
  for (const t of mixedDiameterTests) {
    const url = `${BASE_URL}/api/tires/search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}&modification=${encodeURIComponent(t.tr)}&wheelDiameter=${t.fd}&rearWheelDiameter=${t.rd}&pageSize=5`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const searched = d.tireSizesSearched;
      let frontDia = null, rearDia = null;
      
      if (searched?.front && searched?.rear) {
        frontDia = extractDia(searched.front[0]);
        rearDia = extractDia(searched.rear[0]);
      } else if (Array.isArray(searched)) {
        frontDia = extractDia(searched[0]);
        rearDia = extractDia(searched[1] || searched[0]);
      }
      
      const pass = frontDia === t.exp.f && rearDia === t.exp.r;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        results.pass++;
        console.log(`${icon} ${t.name.padEnd(25)} | R${frontDia}/R${rearDia} ✓`);
      } else {
        results.fail++;
        console.log(`${icon} ${t.name.padEnd(25)} | Expected R${t.exp.f}/R${t.exp.r}, got R${frontDia}/R${rearDia}`);
      }
      results.tests.push({ name: t.name, type: 'P1', pass });
    } catch (e) {
      results.fail++;
      console.log(`🔴 ${t.name.padEnd(25)} | Error: ${e.message}`);
      results.tests.push({ name: t.name, type: 'P1', pass: false, error: e.message });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Same-diameter stagger still works
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('P1: SAME-DIAMETER STAGGER (no regression)');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const sameDiameterTests = [
    { name: 'Mustang 19/19', y: 2024, ma: 'Ford', mo: 'Mustang', tr: 'GT Performance Pack', fd: 19, rd: 19, exp: {f: 19, r: 19} },
    { name: 'Camaro 20/20', y: 2024, ma: 'Chevrolet', mo: 'Camaro', tr: 'SS 1LE', fd: 20, rd: 20, exp: {f: 20, r: 20} },
  ];
  
  for (const t of sameDiameterTests) {
    const url = `${BASE_URL}/api/tires/search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}&modification=${encodeURIComponent(t.tr)}&wheelDiameter=${t.fd}&rearWheelDiameter=${t.rd}&pageSize=5`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const searched = d.tireSizesSearched;
      let frontDia = null, rearDia = null;
      
      if (searched?.front && searched?.rear) {
        frontDia = extractDia(searched.front[0]);
        rearDia = extractDia(searched.rear[0]);
      } else if (Array.isArray(searched)) {
        frontDia = extractDia(searched[0]);
        rearDia = extractDia(searched[1] || searched[0]);
      }
      
      const pass = frontDia === t.exp.f && rearDia === t.exp.r;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        results.pass++;
        console.log(`${icon} ${t.name.padEnd(25)} | R${frontDia}/R${rearDia} ✓`);
      } else {
        results.fail++;
        console.log(`${icon} ${t.name.padEnd(25)} | Expected R${t.exp.f}/R${t.exp.r}, got R${frontDia}/R${rearDia}`);
      }
      results.tests.push({ name: t.name, type: 'P1-NoRegression', pass });
    } catch (e) {
      results.fail++;
      console.log(`🔴 ${t.name.padEnd(25)} | Error: ${e.message}`);
      results.tests.push({ name: t.name, type: 'P1-NoRegression', pass: false, error: e.message });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: Square fitment still works
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('P1: SQUARE FITMENT (no regression)');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const squareTests = [
    { name: 'F-150 20/20', y: 2024, ma: 'Ford', mo: 'F-150', tr: 'XLT', fd: 20, rd: 20, exp: {f: 20, r: 20} },
    { name: 'Camry 19/19', y: 2024, ma: 'Toyota', mo: 'Camry', tr: 'XSE', fd: 19, rd: 19, exp: {f: 19, r: 19} },
  ];
  
  for (const t of squareTests) {
    const url = `${BASE_URL}/api/tires/search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}&modification=${encodeURIComponent(t.tr)}&wheelDiameter=${t.fd}&rearWheelDiameter=${t.rd}&pageSize=5`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const searched = d.tireSizesSearched;
      let frontDia = null, rearDia = null;
      
      if (Array.isArray(searched)) {
        frontDia = extractDia(searched[0]);
        rearDia = extractDia(searched[1] || searched[0]);
      }
      
      const pass = frontDia === t.exp.f && rearDia === t.exp.r;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        results.pass++;
        console.log(`${icon} ${t.name.padEnd(25)} | R${frontDia}/R${rearDia} ✓`);
      } else {
        results.fail++;
        console.log(`${icon} ${t.name.padEnd(25)} | Expected R${t.exp.f}/R${t.exp.r}, got R${frontDia}/R${rearDia}`);
      }
      results.tests.push({ name: t.name, type: 'P1-NoRegression', pass });
    } catch (e) {
      results.fail++;
      console.log(`🔴 ${t.name.padEnd(25)} | Error: ${e.message}`);
      results.tests.push({ name: t.name, type: 'P1-NoRegression', pass: false, error: e.message });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: Staggered detection improvements (P2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('P2: STAGGERED DETECTION');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const detectionTests = [
    { name: 'BMW M3 (tire width inference)', y: 2024, ma: 'BMW', mo: 'M3', tr: '', expectedStaggered: true },
    { name: 'Corvette Stingray (wheel width)', y: 2024, ma: 'Chevrolet', mo: 'Corvette', tr: 'Stingray', expectedStaggered: true },
    { name: 'Charger Widebody (square)', y: 2023, ma: 'Dodge', mo: 'Charger', tr: 'Scat Pack Widebody', expectedStaggered: false },
    { name: 'F-150 (square)', y: 2024, ma: 'Ford', mo: 'F-150', tr: 'XLT', expectedStaggered: false },
  ];
  
  for (const t of detectionTests) {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}${t.tr ? `&modification=${encodeURIComponent(t.tr)}` : ''}&pageSize=1`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const isStaggered = d.fitment?.staggered?.isStaggered || false;
      const pass = isStaggered === t.expectedStaggered;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        results.pass++;
        console.log(`${icon} ${t.name.padEnd(35)} | Staggered: ${isStaggered} ✓`);
      } else {
        results.fail++;
        console.log(`${icon} ${t.name.padEnd(35)} | Expected staggered=${t.expectedStaggered}, got ${isStaggered}`);
      }
      results.tests.push({ name: t.name, type: 'P2', pass });
    } catch (e) {
      results.fail++;
      console.log(`🔴 ${t.name.padEnd(35)} | Error: ${e.message}`);
      results.tests.push({ name: t.name, type: 'P2', pass: false, error: e.message });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 5: Missing OEM tire data (P3)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('P3: STAGGERED SPEC TIRE SIZES');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  const tireSizeTests = [
    { name: 'Corvette (19F/20R)', y: 2024, ma: 'Chevrolet', mo: 'Corvette', tr: 'Stingray', expectFront: 19, expectRear: 20 },
    { name: 'BMW M3 (18/18)', y: 2024, ma: 'BMW', mo: 'M3', tr: '', expectFront: 18, expectRear: 18 },
  ];
  
  for (const t of tireSizeTests) {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${t.y}&make=${encodeURIComponent(t.ma)}&model=${encodeURIComponent(t.mo)}${t.tr ? `&modification=${encodeURIComponent(t.tr)}` : ''}&pageSize=1`;
    
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      const d = await res.json();
      
      const frontTireSize = d.fitment?.staggered?.frontSpec?.tireSize;
      const rearTireSize = d.fitment?.staggered?.rearSpec?.tireSize;
      const frontDia = extractDia(frontTireSize);
      const rearDia = extractDia(rearTireSize);
      
      const hasFrontTire = frontTireSize !== null && frontTireSize !== undefined;
      const hasRearTire = rearTireSize !== null && rearTireSize !== undefined;
      const frontMatches = frontDia === t.expectFront;
      const rearMatches = !t.expectRear || rearDia === t.expectRear;
      
      const pass = hasFrontTire && (hasRearTire || !d.fitment?.staggered?.rearSpec) && frontMatches && rearMatches;
      const icon = pass ? '✅' : '❌';
      
      if (pass) {
        results.pass++;
        console.log(`${icon} ${t.name.padEnd(25)} | Front: ${frontTireSize}, Rear: ${rearTireSize || 'N/A'} ✓`);
      } else {
        results.fail++;
        console.log(`${icon} ${t.name.padEnd(25)} | Front: ${frontTireSize || 'NULL'}, Rear: ${rearTireSize || 'NULL'}`);
      }
      results.tests.push({ name: t.name, type: 'P3', pass });
    } catch (e) {
      results.fail++;
      console.log(`🔴 ${t.name.padEnd(25)} | Error: ${e.message}`);
      results.tests.push({ name: t.name, type: 'P3', pass: false, error: e.message });
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                          FINAL RESULTS                               ║');
  console.log('╠══════════════════════════════════════════════════════════════════════╣');
  
  const p1Tests = results.tests.filter(t => t.type === 'P1' || t.type === 'P1-NoRegression');
  const p2Tests = results.tests.filter(t => t.type === 'P2');
  const p3Tests = results.tests.filter(t => t.type === 'P3');
  
  const p1Pass = p1Tests.filter(t => t.pass).length;
  const p2Pass = p2Tests.filter(t => t.pass).length;
  const p3Pass = p3Tests.filter(t => t.pass).length;
  
  console.log(`║ P1: Mixed-diameter stagger search: ${p1Pass}/${p1Tests.length} ${p1Pass === p1Tests.length ? '✅' : '❌'}`.padEnd(71) + '║');
  console.log(`║ P2: Staggered detection:           ${p2Pass}/${p2Tests.length} ${p2Pass === p2Tests.length ? '✅' : '❌'}`.padEnd(71) + '║');
  console.log(`║ P3: Staggered spec tire sizes:     ${p3Pass}/${p3Tests.length} ${p3Pass === p3Tests.length ? '✅' : '❌'}`.padEnd(71) + '║');
  console.log('╟──────────────────────────────────────────────────────────────────────╢');
  console.log(`║ TOTAL: ${results.pass}/${results.pass + results.fail} passed ${results.fail === 0 ? '✅ ALL PASS' : `❌ ${results.fail} FAILED`}`.padEnd(71) + '║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  
  process.exit(results.fail > 0 ? 1 : 0);
}

runValidation();
