/**
 * Add Chevrolet Express van fitments to database
 * 
 * Express 2500/3500 SRW: 6x139.7, 78.1mm CB
 * Years: 2003-2025 (same generation/platform)
 */

const BASE_URL = process.env.BASE_URL || 'https://shop.warehousetiredirect.com';

// Express 2500 specs (SRW - Single Rear Wheel)
const express2500 = {
  make: 'Chevrolet',
  model: 'Express 2500',
  boltPattern: '6x139.7',
  centerBoreMm: 78.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 28,
  offsetMaxMm: 50,
  oemWheelSizes: [
    { diameter: 16, width: 6.5, offset: 28, isStock: true },
    { diameter: 17, width: 7.5, offset: 32, isStock: true }
  ],
  oemTireSizes: ['LT245/75R16', 'LT245/70R17'],
  source: 'manual-clawd',
  confidence: 'high',
  sourceNotes: 'GM fleet specs - Express van 2003+ platform'
};

// Express 3500 SRW (same as 2500)
const express3500SRW = {
  make: 'Chevrolet',
  model: 'Express 3500',
  displayTrim: 'SRW',
  submodel: 'SRW',
  boltPattern: '6x139.7',
  centerBoreMm: 78.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 28,
  offsetMaxMm: 50,
  oemWheelSizes: [
    { diameter: 16, width: 6.5, offset: 28, isStock: true },
    { diameter: 17, width: 7.5, offset: 32, isStock: true }
  ],
  oemTireSizes: ['LT245/75R16', 'LT245/70R17'],
  source: 'manual-clawd',
  confidence: 'high',
  sourceNotes: 'GM fleet specs - Express 3500 SRW'
};

// Express 3500 DRW (Dual Rear Wheel) - different bolt pattern on rear
const express3500DRW = {
  make: 'Chevrolet',
  model: 'Express 3500',
  displayTrim: 'DRW',
  submodel: 'DRW',
  boltPattern: '8x165.1', // 8-lug for DRW
  centerBoreMm: 121.4,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 105,
  offsetMaxMm: 130,
  oemWheelSizes: [
    { diameter: 16, width: 6, offset: 115, isStock: true }
  ],
  oemTireSizes: ['LT225/75R16'],
  source: 'manual-clawd',
  confidence: 'medium',
  sourceNotes: 'GM fleet specs - Express 3500 DRW (8-lug)'
};

// Also add GMC Savana (badge-engineered twin)
const savana2500 = {
  ...express2500,
  make: 'GMC',
  model: 'Savana 2500',
  sourceNotes: 'GMC badge-engineered twin of Express 2500'
};

const savana3500SRW = {
  ...express3500SRW,
  make: 'GMC',
  model: 'Savana 3500',
  sourceNotes: 'GMC badge-engineered twin of Express 3500 SRW'
};

const savana3500DRW = {
  ...express3500DRW,
  make: 'GMC',
  model: 'Savana 3500',
  sourceNotes: 'GMC badge-engineered twin of Express 3500 DRW'
};

// Generate records for all years
const YEAR_START = 2003;
const YEAR_END = 2025;

const records = [];

for (let year = YEAR_START; year <= YEAR_END; year++) {
  // Chevy Express 2500
  records.push({ ...express2500, year });
  
  // Chevy Express 3500 SRW
  records.push({ ...express3500SRW, year });
  
  // Chevy Express 3500 DRW
  records.push({ ...express3500DRW, year });
  
  // GMC Savana 2500
  records.push({ ...savana2500, year });
  
  // GMC Savana 3500 SRW
  records.push({ ...savana3500SRW, year });
  
  // GMC Savana 3500 DRW
  records.push({ ...savana3500DRW, year });
}

console.log(`Generated ${records.length} fitment records`);
console.log(`Years: ${YEAR_START}-${YEAR_END}`);
console.log(`Models: Express 2500, Express 3500 (SRW/DRW), Savana 2500, Savana 3500 (SRW/DRW)`);

// Make the API call
async function importFitments() {
  console.log(`\nPosting to ${BASE_URL}/api/admin/fitment/manual...`);
  
  const response = await fetch(`${BASE_URL}/api/admin/fitment/manual`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ records }),
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('Import failed:', result);
    process.exit(1);
  }
  
  console.log('Import result:', JSON.stringify(result, null, 2));
}

importFitments().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
