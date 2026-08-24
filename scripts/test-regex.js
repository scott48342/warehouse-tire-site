// Test the isCommercialTruckSize regex directly
const isCommercialTruckSize = (size) => {
  if (!size) return false;
  const s = size.toUpperCase().trim();
  
  // LT prefix (light truck)
  if (/^LT\s?\d/.test(s)) { console.log("  Match: LT prefix"); return true; }
  
  // ST prefix (special trailer)
  if (/^ST\s?\d/.test(s)) { console.log("  Match: ST prefix"); return true; }
  
  // Decimal rim diameters (medium truck): 19.5, 22.5, 24.5
  // Matches: 225/70R19.5, 11R22.5, R22.5
  if (/R?\s*\d{2}\.5(?:[^0-9]|$)/.test(s)) { console.log("  Match: Decimal rim"); return true; }
  
  // Compact numeric format: 11225 (11R22.5 compressed)
  if (/^\d{5}$/.test(s)) { console.log("  Match: 5-digit compact"); return true; }
  
  // Compact numeric format: 22570195 (225/70R19.5 compressed)
  // Pattern: width(3) + aspect(2) + rim with .5 (175, 195, 225, 245)
  if (/^\d{3}\d{2}(?:175|195|225|245)$/.test(s)) { console.log("  Match: 8-digit compact"); return true; }
  
  // Very large flotation sizes (commercial use): 40"+ diameter
  const flotMatch = s.match(/^(\d{2,3})[X\/]/);
  if (flotMatch && parseInt(flotMatch[1], 10) >= 40) { console.log("  Match: Flotation 40+"); return true; }
  
  return false;
};

const testSizes = [
  "215/55R16",      // Should be FALSE
  "225/70R19.5",    // Should be TRUE
  "11R22.5",        // Should be TRUE  
  "LT265/70R17",    // Should be TRUE
];

for (const size of testSizes) {
  console.log(`Testing: "${size}"`);
  const result = isCommercialTruckSize(size);
  console.log(`  Result: ${result}`);
  console.log("");
}
