// Test parseWheelSizes function directly with the raw DB data

// Simulated parseWheelSizes function
function parseWheelSizeEntry(input) {
  if (!input || typeof input !== 'string' && typeof input !== 'object') {
    return null;
  }
  
  // Object format: {diameter, width, ...}
  if (input && typeof input === 'object') {
    const obj = input;
    const diameter = Number(obj.diameter || obj.rimDiameter || 0);
    const width = Number(obj.width || obj.rimWidth || 0);
    if (diameter >= 13 && diameter <= 30 && width >= 4 && width <= 14) {
      return {
        diameter,
        width,
        offset: obj.offset != null ? Number(obj.offset) : null,
        tireSize: typeof obj.tireSize === 'string' ? obj.tireSize : null,
        // Handle both "axle" (API format) and "position" (DB format)
        axle: (obj.axle === 'front' || obj.axle === 'rear') ? obj.axle 
            : (obj.position === 'front' || obj.position === 'rear') ? obj.position
            : 'both',
        isStock: obj.isStock !== false,
      };
    }
  }
  return null;
}

function parseWheelSizes(input) {
  if (!Array.isArray(input)) return [];
  const results = [];
  for (const item of input) {
    const parsed = parseWheelSizeEntry(item);
    if (parsed) results.push(parsed);
  }
  return results;
}

// Test with our exact DB data
const rawDbData = [
  {"axle":"front","width":9.5,"offset":21,"diameter":20,"boltPattern":"5x115"},
  {"axle":"rear","width":11,"offset":18,"diameter":20,"boltPattern":"5x115"}
];

console.log('Raw DB data:', JSON.stringify(rawDbData, null, 2));
console.log('');
console.log('Parsed result:');
const parsed = parseWheelSizes(rawDbData);
console.log(JSON.stringify(parsed, null, 2));
console.log('');
console.log('Count:', parsed.length);
