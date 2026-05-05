// Test the normalization function

function normalizeDisplayTrim(trim: string): string {
  if (!trim) return "";
  
  // If it's already a clean display trim (no hyphens, not a slug), return as-is
  if (!trim.includes("-") || /^[A-Z][a-z]/.test(trim)) {
    return trim;
  }
  
  // Try to extract trim from canonical fitment ID format: year-make-model-trim-hash
  // e.g., "2020-ram-1500-big-horn-148347" → "big-horn"
  const canonicalMatch = trim.match(/^\d{4}-[a-z]+-[a-z0-9]+-(.+)-[a-f0-9]{6,}$/i);
  if (canonicalMatch) {
    return slugToTitle(canonicalMatch[1]);
  }
  
  // Try to extract trim from modification slug format: make-model-trim-hash
  // e.g., "ram-1500-big-horn-8b33058e" → "big-horn"
  const modMatch = trim.match(/^[a-z]+-[a-z0-9]+-(.+)-[a-f0-9]{6,}$/i);
  if (modMatch) {
    return slugToTitle(modMatch[1]);
  }
  
  // If it looks like a simple slug (all lowercase, has hyphens), convert to title case
  if (/^[a-z0-9-]+$/.test(trim)) {
    return slugToTitle(trim);
  }
  
  return trim;
}

function slugToTitle(slug: string): string {
  const uppercaseTrims: Record<string, string> = {
    "at4": "AT4", "srt": "SRT", "rt": "R/T", "zr2": "ZR2", "trd": "TRD",
    "sr5": "SR5", "xlt": "XLT", "sel": "SEL", "wt": "WT", "lt": "LT",
    "ltz": "LTZ", "sle": "SLE", "slt": "SLT", "z71": "Z71",
  };
  
  const lower = slug.toLowerCase();
  if (uppercaseTrims[lower]) return uppercaseTrims[lower];
  
  return slug.split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
}

// Test cases
const tests = [
  "2020-ram-1500-big-horn-148347",
  "ram-1500-big-horn-8b33058e",
  "big-horn",
  "Big Horn",
];

for (const t of tests) {
  console.log(`"${t}" → "${normalizeDisplayTrim(t)}"`);
}
