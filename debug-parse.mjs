// Test parsing of specific descriptions
const MODEL_PATTERNS = [
  // GM trucks - HD patterns (must come before generic patterns)
  { pattern: /GM\s*2500\s*[\/&]\s*3500/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
  { pattern: /2500\s*HD\s*3500\s*HD/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
  { pattern: /(?:GM|CHEVY|GMC|CHEVY\s*\/\s*GMC)\s+HD(?!\w)/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
  { pattern: /\b2500\s*HD\b/i, make: 'Chevrolet', model: () => 'Silverado 2500 HD', altMake: 'GMC', altModel: 'Sierra 2500 HD' },
  { pattern: /\b3500\s*HD\b/i, make: 'Chevrolet', model: () => 'Silverado 3500 HD', altMake: 'GMC', altModel: 'Sierra 3500 HD' },
];

const testDescriptions = [
  'RL 20-25 GM 2500/3500 6\'\' MAX 3.3 PREM',
  'GM 2500/3500 20-UP LOAD LEV (W/OL) SRW',
  'RL 6\'\'LIFT KIT W/FALCON SHOCKS 20+ GM HD',
  'RL 8\'\'LIFT KIT & FALCON SHOCKS 20+ GM HD',
  'RL 20-24 GM 2500/3500 6\'\' BIG 2.1 PREM',
];

for (const desc of testDescriptions) {
  console.log(`\nTesting: "${desc}"`);
  let matched = false;
  for (const mp of MODEL_PATTERNS) {
    const match = desc.match(mp.pattern);
    if (match) {
      console.log(`  ✅ Matched pattern: ${mp.pattern}`);
      console.log(`     → ${mp.make} ${typeof mp.model === 'function' ? mp.model(match) : mp.model}`);
      matched = true;
      break;
    }
  }
  if (!matched) {
    console.log('  ❌ No pattern matched!');
  }
}
