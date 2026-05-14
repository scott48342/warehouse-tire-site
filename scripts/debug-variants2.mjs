// Copy of getModelVariants logic
const MODEL_ALIASES = {};  // BMW M3 has no aliases

function getModelVariants(model) {
  const lowercased = model.toLowerCase().trim();
  const slugified = model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const aliases = MODEL_ALIASES[slugified] || [];
  const variants = [lowercased, slugified, ...aliases];
  return [...new Set(variants)];
}

console.log('getModelVariants("M3"):', getModelVariants("M3"));
console.log('getModelVariants("m3"):', getModelVariants("m3"));
