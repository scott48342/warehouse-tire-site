// Test the flotation regex specifically
const s = "215/55R16".toUpperCase().trim();
console.log("Input:", s);

const flotMatch = s.match(/^(\d{2,3})[X\/]/);
console.log("Flotation match:", flotMatch);

if (flotMatch) {
  console.log("  Captured group:", flotMatch[1]);
  console.log("  parseInt:", parseInt(flotMatch[1], 10));
  console.log("  >= 40:", parseInt(flotMatch[1], 10) >= 40);
} else {
  console.log("  No match");
}

// Test the full condition
if (flotMatch && parseInt(flotMatch[1], 10) >= 40) {
  console.log("WOULD RETURN TRUE");
} else {
  console.log("WOULD RETURN FALSE");
}
