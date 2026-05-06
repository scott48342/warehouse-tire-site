const BASE_URL = 'http://localhost:3000';

async function testStaggered() {
  const vehicles = [
    { year: 2024, make: 'Ford', model: 'Mustang', trim: 'GT' },
    { year: 2023, make: 'Ford', model: 'Mustang', trim: 'GT Performance Pack' },
    { year: 2022, make: 'Chevrolet', model: 'Camaro', trim: 'SS' },
    { year: 2023, make: 'Chevrolet', model: 'Camaro', trim: 'ZL1' },
    { year: 2023, make: 'Chevrolet', model: 'Corvette', trim: 'Stingray' },
    { year: 2024, make: 'Dodge', model: 'Challenger', trim: 'R/T' },
    { year: 2024, make: 'BMW', model: 'M3', trim: 'Competition' },
    { year: 2024, make: 'Mercedes-Benz', model: 'AMG C 63', trim: 'S' },
  ];
  
  console.log('Checking staggered detection for critical vehicles...\n');
  
  for (const v of vehicles) {
    const url = `${BASE_URL}/api/wheels/fitment-search?year=${v.year}&make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model)}&trim=${encodeURIComponent(v.trim)}&pageSize=10`;
    try {
      const res = await fetch(url).then(r => r.json());
      const isStaggered = res.isStaggered || res.fitment?.isStaggered || false;
      const dbProfile = res.fitment?.dbProfile || {};
      const frontWidth = dbProfile.frontWheelWidth || res.fitment?.frontWidth;
      const rearWidth = dbProfile.rearWheelWidth || res.fitment?.rearWidth;
      const frontTire = dbProfile.frontTireSize || res.fitment?.frontTireSize;
      const rearTire = dbProfile.rearTireSize || res.fitment?.rearTireSize;
      
      const status = isStaggered ? '✅' : '❌';
      console.log(`${status} ${v.year} ${v.make} ${v.model} ${v.trim}`);
      console.log(`   isStaggered: ${isStaggered}`);
      console.log(`   frontWidth: ${frontWidth}, rearWidth: ${rearWidth}`);
      console.log(`   frontTire: ${frontTire}, rearTire: ${rearTire}`);
      console.log(`   wheelCount: ${res.totalCount || res.results?.length || 0}`);
      if (dbProfile) {
        console.log(`   dbProfile keys: ${Object.keys(dbProfile).join(', ')}`);
      }
      console.log('');
    } catch (err) {
      console.log(`❌ ${v.year} ${v.make} ${v.model} ${v.trim}: ${err.message}\n`);
    }
  }
}

testStaggered().catch(console.error);
