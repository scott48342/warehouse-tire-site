import fs from 'fs';

// Load gaps
const gaps = JSON.parse(fs.readFileSync('fitment-gaps.json', 'utf8'));

// US market priority makes/models - vehicles actually sold in the US
const US_PRIORITY = {
  // Ford
  'ford': ['Edge', 'Explorer', 'F-150', 'F-250', 'F-350', 'Escape', 'Expedition', 'Ranger', 'Bronco', 'Bronco Sport', 'Mustang', 'Fusion', 'Focus', 'Taurus', 'Flex', 'Transit', 'Transit 150', 'Transit 250', 'Transit 350', 'Transit Connect', 'E-150', 'E-250', 'E-350', 'Maverick', 'F-150 Lightning'],
  
  // Chevrolet
  'chevrolet': ['Silverado 1500', 'Silverado 2500HD', 'Silverado 3500HD', 'Colorado', 'Tahoe', 'Suburban', 'Traverse', 'Equinox', 'Trax', 'Blazer', 'Camaro', 'Corvette', 'Malibu', 'Impala', 'Cruze', 'Spark', 'Sonic', 'Trailblazer', 'Express 1500', 'Express 2500', 'Express 3500', 'Avalanche'],
  
  // GMC
  'gmc': ['Sierra 1500', 'Sierra 2500HD', 'Sierra 3500HD', 'Canyon', 'Yukon', 'Yukon XL', 'Acadia', 'Terrain', 'Savana 1500', 'Savana 2500', 'Savana 3500', 'Envoy'],
  
  // RAM
  'ram': ['1500', '2500', '3500', 'ProMaster 1500', 'ProMaster 2500', 'ProMaster 3500', 'ProMaster City'],
  
  // Dodge
  'dodge': ['Charger', 'Challenger', 'Durango', 'Grand Caravan', 'Journey', 'Ram 1500', 'Ram 2500', 'Ram 3500', 'Dakota', 'Caravan', 'Nitro', 'Caliber'],
  
  // Jeep
  'jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Patriot', 'Liberty', 'Commander', 'Wagoneer', 'Grand Wagoneer'],
  
  // Chrysler
  'chrysler': ['300', 'Pacifica', 'Town & Country', 'Voyager', 'PT Cruiser', 'Sebring', '200'],
  
  // Toyota
  'toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', '4Runner', 'Sequoia', 'Sienna', 'Prius', 'Avalon', 'Yaris', 'Matrix', 'Supra', 'GR86', 'Venza', 'C-HR', 'Land Cruiser'],
  
  // Honda
  'honda': ['Civic', 'Accord', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 'Passport', 'Ridgeline', 'Fit', 'Element', 'Insight', 'Clarity'],
  
  // Nissan
  'nissan': ['Altima', 'Sentra', 'Maxima', 'Rogue', 'Murano', 'Pathfinder', 'Armada', 'Titan', 'Frontier', 'Versa', 'Kicks', 'Juke', '370Z', 'GT-R', 'Leaf', 'Quest', 'Xterra', 'NV200', 'NV1500', 'NV2500', 'NV3500'],
  
  // Hyundai
  'hyundai': ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Palisade', 'Kona', 'Venue', 'Accent', 'Veloster', 'Genesis Coupe', 'Santa Cruz', 'Ioniq 5', 'Ioniq 6'],
  
  // Kia
  'kia': ['Optima', 'K5', 'Forte', 'Soul', 'Sportage', 'Sorento', 'Telluride', 'Seltos', 'Rio', 'Stinger', 'Carnival', 'Sedona', 'Niro', 'EV6'],
  
  // Subaru
  'subaru': ['Outback', 'Forester', 'Crosstrek', 'Impreza', 'Legacy', 'Ascent', 'WRX', 'BRZ', 'Baja'],
  
  // Mazda
  'mazda': ['Mazda3', 'Mazda6', 'CX-5', 'CX-9', 'CX-30', 'CX-50', 'MX-5 Miata', 'Tribute', 'CX-7', 'RX-8'],
  
  // Volkswagen
  'volkswagen': ['Jetta', 'Passat', 'Golf', 'Tiguan', 'Atlas', 'Beetle', 'CC', 'Touareg', 'GTI', 'Golf R', 'Arteon', 'ID.4', 'Taos'],
  
  // BMW
  'bmw': ['3 Series', '5 Series', 'X3', 'X5', 'X1', 'X7', '7 Series', '4 Series', '2 Series', 'X4', 'X6', 'Z4', 'i4', 'iX'],
  
  // Mercedes
  'mercedes': ['C-Class', 'E-Class', 'S-Class', 'GLC-Class', 'GLE-Class', 'GLS-Class', 'A-Class', 'CLA-Class', 'GLA-Class', 'GLB-Class', 'G-Class', 'Sprinter', 'Metris'],
  
  // Audi
  'audi': ['A4', 'A6', 'Q5', 'Q7', 'A3', 'Q3', 'A5', 'Q8', 'A8', 'e-tron', 'TT', 'R8', 'S4', 'S5', 'RS5'],
  
  // Lexus
  'lexus': ['RX', 'ES', 'NX', 'GX', 'LX', 'IS', 'GS', 'LS', 'UX', 'RC', 'LC'],
  
  // Acura
  'acura': ['MDX', 'RDX', 'TLX', 'ILX', 'TSX', 'TL', 'RL', 'RSX', 'Integra'],
  
  // Infiniti
  'infiniti': ['Q50', 'Q60', 'QX50', 'QX60', 'QX80', 'G35', 'G37', 'M35', 'M37', 'FX35', 'FX50', 'QX70'],
  
  // Cadillac
  'cadillac': ['Escalade', 'XT5', 'XT4', 'CT5', 'CT4', 'SRX', 'CTS', 'ATS', 'XTS', 'Escalade ESV', 'XT6'],
  
  // Lincoln
  'lincoln': ['Navigator', 'Aviator', 'Nautilus', 'Corsair', 'MKX', 'MKC', 'MKZ', 'MKS', 'Continental', 'Town Car'],
  
  // Buick
  'buick': ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal', 'Verano', 'Century', 'LeSabre', 'Park Avenue', 'Rainier', 'Rendezvous'],
  
  // GMC/Chevy Vans
  'gmc': ['Savana 1500', 'Savana 2500', 'Savana 3500'],
  
  // Tesla
  'tesla': ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
  
  // Volvo
  'volvo': ['XC90', 'XC60', 'XC40', 'S60', 'S90', 'V60', 'V90'],
  
  // Land Rover
  'land-rover': ['Range Rover', 'Range Rover Sport', 'Range Rover Evoque', 'Discovery', 'Discovery Sport', 'Defender', 'LR2', 'LR3', 'LR4'],
  
  // Porsche
  'porsche': ['911', 'Cayenne', 'Macan', 'Panamera', 'Boxster', 'Cayman', 'Taycan'],
  
  // Jaguar
  'jaguar': ['F-Pace', 'E-Pace', 'I-Pace', 'XF', 'XE', 'XJ', 'F-Type'],
  
  // Mini
  'mini': ['Cooper', 'Countryman', 'Clubman', 'Hardtop', 'Convertible'],
  
  // Mitsubishi
  'mitsubishi': ['Outlander', 'Eclipse Cross', 'Outlander Sport', 'Mirage', 'Lancer', 'Galant', 'Montero', 'Montero Sport'],
};

// Create lookup map
const priorityMap = new Map();
for (const [make, models] of Object.entries(US_PRIORITY)) {
  for (const model of models) {
    priorityMap.set(`${make.toLowerCase()}|${model.toLowerCase()}`, true);
  }
}

// Filter gaps to US priority only
const usPriorityGaps = gaps.filter(item => {
  const key = `${item.make.toLowerCase()}|${item.model.toLowerCase()}`;
  // Check exact match or close match
  return priorityMap.has(key) || 
    [...priorityMap.keys()].some(k => {
      const [kMake, kModel] = k.split('|');
      return item.make.toLowerCase() === kMake && 
             (item.model.toLowerCase().includes(kModel) || kModel.includes(item.model.toLowerCase()));
    });
});

console.log('=== US MARKET PRIORITY GAPS ===\n');

let totalMissing = 0;
for (const item of usPriorityGaps) {
  console.log(`${item.make} ${item.model}: ${item.count} years missing`);
  console.log(`  Missing: ${item.years.join(', ')}`);
  totalMissing += item.count;
}

console.log(`\n=== SUMMARY ===`);
console.log(`US Priority vehicles with gaps: ${usPriorityGaps.length}`);
console.log(`Total year-gaps to fill: ${totalMissing}`);

// Save filtered list
fs.writeFileSync('us-priority-gaps.json', JSON.stringify(usPriorityGaps, null, 2));
console.log('\nSaved to us-priority-gaps.json');
