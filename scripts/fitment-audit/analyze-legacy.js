/**
 * Analyze legacy contamination patterns for targeted remediation
 */
const data = require('./full-audit-results.json');
const legacy = data.records.filter(r => r.issueType === 'legacy_contamination');

// Group by model with detailed size breakdown
const analysis = {};
legacy.forEach(r => {
  const key = r.make + '/' + r.model;
  if (!analysis[key]) {
    analysis[key] = { 
      records: [], 
      years: new Set(), 
      sizes: new Set(),
      sources: new Set(),
      minDiaByYear: {}
    };
  }
  analysis[key].records.push(r);
  analysis[key].years.add(r.year);
  analysis[key].sources.add(r.source);
  
  // Track sizes and min diameter per year
  const diameters = (r.tireSizes || []).map(s => {
    const match = s.match(/R(\d+)/);
    return match ? parseInt(match[1]) : null;
  }).filter(d => d !== null);
  
  if (!analysis[key].minDiaByYear[r.year]) {
    analysis[key].minDiaByYear[r.year] = 99;
  }
  if (diameters.length > 0) {
    const minD = Math.min(...diameters);
    if (minD < analysis[key].minDiaByYear[r.year]) {
      analysis[key].minDiaByYear[r.year] = minD;
    }
  }
  
  r.tireSizes.forEach(s => analysis[key].sizes.add(s));
});

console.log('=== LEGACY CONTAMINATION ANALYSIS ===\n');
Object.entries(analysis)
  .sort((a,b) => b[1].records.length - a[1].records.length)
  .forEach(([model, info]) => {
    console.log('MODEL: ' + model + ' (' + info.records.length + ' records)');
    console.log('Years: ' + [...info.years].sort().join(', '));
    console.log('Sources: ' + [...info.sources].join(', '));
    console.log('Min diameters by year:');
    Object.entries(info.minDiaByYear)
      .sort((a,b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([y, d]) => console.log('  ' + y + ': ' + d + '"'));
    console.log('Sample sizes: ' + [...info.sizes].slice(0, 5).join(', '));
    console.log('');
  });

// Output structured data for remediation script
console.log('\n=== REMEDIATION RULES ===\n');
const rules = [];

Object.entries(analysis).forEach(([model, info]) => {
  const [make, modelName] = model.split('/');
  const years = [...info.years].sort();
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // Determine appropriate floor based on vehicle type and years
  let floor;
  const sportsCars = ['mx-5-miata', 'wrx', 'brz', 'gr86', 'mustang', 'camaro', 'challenger', 'charger', '370z', 'supra'];
  const trucks = ['tacoma', 'f-150', 'silverado-1500', 'sierra-1500', 'tundra', 'ram-1500'];
  
  if (sportsCars.includes(modelName)) {
    floor = 17; // Sports cars: minimum 17" for modern years
  } else if (trucks.includes(modelName)) {
    floor = 16; // Trucks: allow 16" base
  } else {
    floor = 16; // Default: 16" minimum
  }
  
  rules.push({
    make,
    model: modelName,
    yearRange: [minYear, maxYear],
    minDiameter: floor,
    affectedRecords: info.records.length
  });
});

console.log(JSON.stringify(rules, null, 2));
