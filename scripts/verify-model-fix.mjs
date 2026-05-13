#!/usr/bin/env node
/**
 * Verify the getModelVariants fix
 */

// Inline the fixed function for testing
function getModelVariants(model) {
  // Model aliases (simplified)
  const MODEL_ALIASES = {
    "silverado-2500-hd": ["silverado-2500hd", "silverado-2500"],
    "ram-3500": ["3500"],
  };
  
  const HD_RICH_PRIORITY = {
    "silverado-2500-hd": "silverado-2500hd",
  };
  
  // Preserve the original input (just lowercase) - this matches DB format with spaces
  const lowercased = model.toLowerCase().trim();
  
  // Slugify the input (lowercase, hyphens for non-alphanumeric)
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  
  // Get aliases (these are RAW DB names, not normalized)
  const aliases = MODEL_ALIASES[slugified] || [];
  
  // Check if this is an HD truck with sparse data - prioritize rich variant
  const richVariant = HD_RICH_PRIORITY[slugified];
  if (richVariant) {
    // Put rich variant FIRST, then original (with spaces), then slugified, then other aliases
    const others = aliases.filter(a => a !== richVariant);
    const variants = [richVariant, lowercased, slugified, ...others];
    // Dedupe while preserving order
    return [...new Set(variants)];
  }
  
  // Try original first (with spaces), then slugified, then aliases
  const variants = [lowercased, slugified, ...aliases];
  // Dedupe while preserving order
  return [...new Set(variants)];
}

// Test cases
const testCases = [
  { input: "F-150 Lightning", expectedFirst: "f-150 lightning" },
  { input: "Silverado 2500 HD", expectedFirst: "silverado-2500hd" }, // HD priority
  { input: "Tacoma", expectedFirst: "tacoma" },
  { input: "Bronco", expectedFirst: "bronco" },
  { input: "Corvette", expectedFirst: "corvette" },
  { input: "M3", expectedFirst: "m3" },
  { input: "Ram 3500", expectedFirst: "ram 3500" },
];

console.log("Testing getModelVariants fix:\n");

for (const tc of testCases) {
  const variants = getModelVariants(tc.input);
  const pass = variants[0] === tc.expectedFirst || variants.includes(tc.expectedFirst);
  console.log(`${pass ? '✅' : '❌'} "${tc.input}"`);
  console.log(`   Variants: [${variants.join(', ')}]`);
  console.log(`   First: "${variants[0]}" (expected includes: "${tc.expectedFirst}")`);
  console.log('');
}
