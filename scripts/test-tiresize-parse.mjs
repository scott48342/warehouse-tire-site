/**
 * Test tiresize.com parsing to understand page structure
 */

const url = "https://tiresize.com/tires/toyota/camry/2020/";

console.log(`Fetching: ${url}\n`);

const response = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html",
  },
});

if (!response.ok) {
  console.log(`HTTP ${response.status}`);
  process.exit(1);
}

const html = await response.text();

// Find the main content area - usually contains the fitment tables
// Look for patterns around trim/option tables

console.log("=== TIRE SIZES FOUND ===");
const tireSizePattern = /\b(P|LT)?(\d{3}\/\d{2}R\d{2})\b/gi;
const tireMatches = [...html.matchAll(tireSizePattern)];
const tireSizes = [...new Set(tireMatches.map(m => m[0].toUpperCase()))];
tireSizes.forEach(s => console.log(`  ${s}`));

console.log("\n=== WHEEL SIZE PATTERNS ===");
const wheelPattern = /(\d{2})[\s×x]+([\d.]+)/gi;
const wheelMatches = [...html.matchAll(wheelPattern)];
const wheels = new Set();
wheelMatches.forEach(m => {
  const d = parseInt(m[1], 10);
  const w = parseFloat(m[2]);
  if (d >= 15 && d <= 22 && w >= 5 && w <= 11) {
    wheels.add(`${d}x${w}`);
  }
});
[...wheels].forEach(s => console.log(`  ${s}`));

console.log("\n=== OFFSET PATTERNS ===");
const offsetPattern = /ET\s*\+?(-?\d+)/gi;
const offsetMatches = [...html.matchAll(offsetPattern)];
offsetMatches.forEach(m => console.log(`  ET${m[1]}`));

console.log("\n=== Looking for structured data ===");
// Look for JSON-LD or structured data
const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
if (jsonLdMatch) {
  try {
    const data = JSON.parse(jsonLdMatch[1]);
    console.log("Found JSON-LD:", JSON.stringify(data, null, 2).substring(0, 500));
  } catch (e) {
    console.log("Invalid JSON-LD");
  }
}

// Look for data tables
const tableMatches = html.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
console.log(`\nFound ${tableMatches.length} tables`);

// Look for trim/option sections
const trimSections = html.match(/(?:trim|option|package)[^<]*<[^>]*>\s*\d{3}\/\d{2}R\d{2}/gi) || [];
console.log(`Found ${trimSections.length} trim sections with tire sizes`);

// Extract from around "Original tire size" or similar markers
const originalPattern = /original[^<]*tire[^<]*size[^<]*[:>]\s*(\d{3}\/\d{2}R\d{2})/gi;
const originalMatches = [...html.matchAll(originalPattern)];
if (originalMatches.length > 0) {
  console.log("\n=== ORIGINAL TIRE SIZES ===");
  originalMatches.forEach(m => console.log(`  ${m[1]}`));
}

// Check for specific fitment data near OEM markers
const oemPattern = /OEM|stock|factory|standard/gi;
const oemCount = (html.match(oemPattern) || []).length;
console.log(`\n${oemCount} OEM/stock/factory mentions`);
