const BASE_URL = 'http://localhost:3000';

async function test() {
  console.log('Testing 2024 Ford F-150 XLT...');
  
  // Wheel fitment
  const wUrl = BASE_URL + '/api/wheels/fitment-search?year=2024&make=Ford&model=F-150&trim=XLT&pageSize=10';
  const wRes = await fetch(wUrl).then(r => r.json());
  console.log('Wheels:', wRes.totalCount || wRes.results?.length || 0, 'bolt:', wRes.fitment?.dbProfile?.boltPattern);
  
  // Standard tires
  const tUrl = BASE_URL + '/api/tires/search?year=2024&make=Ford&model=F-150';
  const tRes = await fetch(tUrl).then(r => r.json());
  console.log('Tires:', tRes.results?.length || 0, 'sizes:', tRes.sizesSearched?.slice(0,3).join(', '));
  
  // Lifted 4"
  const lUrl = BASE_URL + '/api/tires/search?year=2024&make=Ford&model=F-150&wheelDiameter=20&buildType=lifted&liftInches=4';
  const lRes = await fetch(lUrl).then(r => r.json());
  console.log('Lifted 4in:', lRes.results?.length || 0, 'sizes:', lRes.liftedBuildInfo?.sizesSearched?.slice(0,3).join(', '));
  console.log('  minDia:', lRes.liftedBuildInfo?.minDiameterEnforced, 'maxDia:', lRes.liftedBuildInfo?.maxDiameterEnforced);
  
  // Check staggered
  const sUrl = BASE_URL + '/api/wheels/fitment-search?year=2024&make=Ford&model=Mustang&trim=GT&pageSize=10';
  const sRes = await fetch(sUrl).then(r => r.json());
  console.log('Mustang GT isStaggered:', sRes.isStaggered || sRes.fitment?.isStaggered || false);
  console.log('  wheels:', sRes.totalCount || sRes.results?.length || 0);
}

test().catch(console.error);
