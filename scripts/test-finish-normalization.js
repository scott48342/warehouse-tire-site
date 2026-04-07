/**
 * Test finish normalization
 */

// Inline the normalization for testing
function normalizeFinish(fancyFinish, abbreviatedFinish) {
  const raw = (fancyFinish || abbreviatedFinish || "").toUpperCase().trim();
  
  if (!raw) return "Other";
  
  // Matte Black
  if (/^MATTE\s*BLACK(?:\s|$)/i.test(raw) && !raw.includes("MILLED") && !raw.includes("MACHINED")) {
    return "Matte Black";
  }
  
  // Satin Black
  if (/^SATIN\s*BLACK(?:\s|$)/i.test(raw) && !raw.includes("MILLED") && !raw.includes("MACHINED")) {
    return "Satin Black";
  }
  
  // Gloss Black plain
  if (/^GLOSS\s*BLACK$/i.test(raw)) {
    return "Gloss Black";
  }
  
  // Black with Machined/Milled
  if (raw.includes("BLACK") && (raw.includes("MACH") || raw.includes("MILL"))) {
    return "Black / Machined";
  }
  
  // Blackout
  if (raw.includes("BLACKOUT") || raw === "BLK-OUT") {
    return "Blackout";
  }
  
  if (raw === "BLACK" || raw === "BLK") return "Black";
  if (/^GLOSS\s*BLACK/i.test(raw)) return "Gloss Black";
  if (/^SATIN\s*BLACK/i.test(raw)) return "Satin Black";
  if (/^MATTE\s*BLACK/i.test(raw)) return "Matte Black";
  
  // Chrome/Polished
  if (raw.includes("CHROME PLATED")) return "Chrome Plated";
  if (raw.includes("CHROME")) return "Chrome";
  if (raw.includes("POLISHED") || raw.includes("POLISH")) return "Polished";
  
  // Bronze
  if (/MATTE\s*BRONZE/i.test(raw)) return "Matte Bronze";
  if (/GLOSS\s*BRONZE/i.test(raw)) return "Gloss Bronze";
  if (raw.includes("BURNT BRONZE")) return "Burnt Bronze";
  if (raw.includes("BRONZE")) return "Bronze";
  
  // Gunmetal
  if (/MATTE\s*GUNMETAL/i.test(raw)) return "Matte Gunmetal";
  if (/GLOSS\s*GUNMETAL/i.test(raw)) return "Gloss Gunmetal";
  if (raw.includes("GUNMETAL") || raw.includes("GUN METAL")) return "Gunmetal";
  
  // Gray
  if (raw.includes("ANTHRACITE")) return "Anthracite";
  if (raw.includes("GRAY") || raw.includes("GREY")) return "Gray";
  
  // Silver
  if (raw.includes("HYPER SILVER")) return "Hyper Silver";
  if (raw.includes("SILVER") && (raw.includes("MACH") || raw.includes("FACE"))) return "Silver / Machined";
  if (raw.includes("SILVER")) return "Silver";
  
  // Colors
  if (raw.includes("RED")) return "Red";
  if (raw.includes("BLUE")) return "Blue";
  if (raw.includes("WHITE")) return "White";
  if (raw.includes("GOLD")) return "Gold";
  if (raw.includes("GREEN")) return "Green";
  if (raw.includes("ORANGE")) return "Orange";
  if (raw.includes("COPPER")) return "Copper";
  
  // Special
  if (raw.includes("BRUSHED")) return "Brushed";
  if (raw.includes("MACHINED")) return "Machined";
  if (raw.includes("CUSTOM")) return "Custom";
  
  return "Other";
}

// Test cases
const tests = [
  // Black family
  { fancy: "MATTE BLACK", abbr: "BLACK", expected: "Matte Black" },
  { fancy: "GLOSS BLACK", abbr: "BLACK", expected: "Gloss Black" },
  { fancy: "SATIN BLACK", abbr: "BLACK", expected: "Satin Black" },
  { fancy: "GLOSS BLACK MILL-MACH", abbr: "BLACK", expected: "Black / Machined" },
  { fancy: "GLOSS BLACK MILLED", abbr: "BLACK", expected: "Black / Machined" },
  { fancy: "BLACK", abbr: "BLACK", expected: "Black" },
  { fancy: "BLACKOUT", abbr: "BLACK", expected: "Blackout" },
  { fancy: "MATTE BLACK W/ GLOSS BLACK LIP", abbr: "BLACK", expected: "Matte Black" },
  
  // Bronze
  { fancy: "MATTE BRONZE", abbr: "BRONZE", expected: "Matte Bronze" },
  { fancy: "BURNT BRONZE", abbr: "BRONZE", expected: "Burnt Bronze" },
  
  // Gunmetal
  { fancy: "MATTE GUNMETAL", abbr: "GUN METAL", expected: "Matte Gunmetal" },
  { fancy: "GLOSS GUNMETAL", abbr: "GUNMETAL", expected: "Gloss Gunmetal" },
  
  // Chrome/Polished
  { fancy: "CHROME", abbr: "CHROME", expected: "Chrome" },
  { fancy: "CHROME PLATED", abbr: "CHROME", expected: "Chrome Plated" },
  { fancy: "POLISHED", abbr: "POLISHED", expected: "Polished" },
  
  // Silver
  { fancy: "GLOSS SILVER W/ MACHINED FACE", abbr: "SILVER", expected: "Silver / Machined" },
  { fancy: "HYPER SILVER", abbr: "SILVER", expected: "Hyper Silver" },
  { fancy: "GLOSS SILVER", abbr: "SILVER", expected: "Silver" },
  
  // Gray
  { fancy: "MATTE ANTHRACITE", abbr: "GRAY", expected: "Anthracite" },
];

console.log("=== Finish Normalization Test ===\n");

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = normalizeFinish(t.fancy, t.abbr);
  const ok = result === t.expected;
  if (ok) {
    console.log(`✅ "${t.fancy}" → "${result}"`);
    passed++;
  } else {
    console.log(`❌ "${t.fancy}" → "${result}" (expected "${t.expected}")`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
