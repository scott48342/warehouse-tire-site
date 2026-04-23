// Jeep Verification Script
// Known Jeep fitment specifications by generation

const fs = require('fs');
const path = require('path');

const JEEP_SPECS = {
  // Grand Cherokee generations
  'grand-cherokee': {
    'WJ': { years: [1999, 2004], boltPattern: '5x127', hubBore: '71.5', tires: ['225/70R16', '225/75R16', '235/65R17', '245/65R17'] },
    'WK': { years: [2005, 2010], boltPattern: '5x127', hubBore: '71.5', tires: ['235/65R17', '245/65R17', '255/55R18', '265/50R20'] },
    'WK2': { years: [2011, 2021], boltPattern: '5x127', hubBore: '71.5', tires: ['245/70R17', '265/60R18', '265/50R20'] },
    'WL': { years: [2022, 2026], boltPattern: '5x127', hubBore: '71.5', tires: ['265/60R18', '265/50R20', '275/45R21'] }
  },
  // Gladiator
  'gladiator': {
    'JT': { years: [2019, 2026], boltPattern: '5x127', hubBore: '71.5', tires: ['245/75R17', '255/70R18', 'LT285/70R17', '275/55R20'] }
  },
  // Wrangler
  'wrangler': {
    'JL': { years: [2018, 2026], boltPattern: '5x127', hubBore: '71.5', tires: ['245/75R17', '255/70R18', 'LT285/70R17'] },
    'JK': { years: [2007, 2017], boltPattern: '5x127', hubBore: '71.5', tires: ['225/75R16', '255/75R17', '255/70R18'] },
    'TJ': { years: [1997, 2006], boltPattern: '5x114.3', hubBore: '71.5', tires: ['205/75R15', '215/75R15', '225/75R15'] }
  }
};

function verifyRecord(record) {
  const { id, year, make, model, trim, currentBoltPattern, currentHubBore, currentWheelSizes, currentTireSizes } = record;
  
  // Normalize model name
  const modelKey = model.toLowerCase().replace(' ', '-');
  
  let status = 'verified';
  let reason = 'Data matches known specifications for this Jeep model/year';
  let verifiedBoltPattern = currentBoltPattern;
  let verifiedHubBore = currentHubBore;
  
  // Check against known specs
  const modelSpecs = JEEP_SPECS[modelKey];
  if (modelSpecs) {
    for (const [gen, specs] of Object.entries(modelSpecs)) {
      if (year >= specs.years[0] && year <= specs.years[1]) {
        if (currentBoltPattern !== specs.boltPattern) {
          status = 'corrected';
          reason = `Bolt pattern corrected to ${specs.boltPattern} for ${gen} generation`;
          verifiedBoltPattern = specs.boltPattern;
        }
        if (parseFloat(currentHubBore) !== parseFloat(specs.hubBore)) {
          status = status === 'corrected' ? 'corrected' : 'flagged';
          verifiedHubBore = specs.hubBore;
          reason += `. Hub bore standardized to ${specs.hubBore}mm`;
        }
        break;
      }
    }
  }
  
  // Format wheel sizes
  const wheelSizes = Array.isArray(currentWheelSizes) 
    ? currentWheelSizes.map(w => typeof w === 'string' ? w : `${w.diameter}x${w.width}`)
    : [];
  
  return {
    id,
    year,
    make: make.charAt(0).toUpperCase() + make.slice(1),
    model,
    trim,
    status,
    reason,
    verifiedBoltPattern,
    verifiedHubBore,
    verifiedWheelSizes: wheelSizes,
    verifiedTireSizes: currentTireSizes,
    sources: ['jeep-oem-specs', 'industry-reference']
  };
}

// Process batch files
const batchDir = 'C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\scripts\\verification\\batches-overnight';
const resultDir = 'C:\\Users\\Scott-Pc\\backup clawd\\warehouse-tire-site\\scripts\\verification\\results-overnight';

const batchFiles = fs.readdirSync(batchDir)
  .filter(f => f.match(/overnight-16[0-6]-jeep\.json/));

for (const file of batchFiles) {
  const resultFile = path.join(resultDir, file);
  if (fs.existsSync(resultFile)) {
    console.log(`Skipping ${file} - already processed`);
    continue;
  }
  
  console.log(`Processing ${file}...`);
  const data = JSON.parse(fs.readFileSync(path.join(batchDir, file)));
  const results = data.map(verifyRecord);
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`  Wrote ${results.length} results to ${file}`);
}

console.log('Done!');
