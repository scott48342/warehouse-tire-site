const wheelSizeApi = require("./src/lib/wheelSizeApi");

async function check() {
  try {
    // Find Pontiac
    const make = await wheelSizeApi.findMake("Pontiac");
    if (!make) {
      console.log("Pontiac NOT found in Wheel-Size API");
      return;
    }
    console.log("Make found:", make.slug);
    
    // Find Firebird
    const model = await wheelSizeApi.findModel(make.slug, "Firebird");
    if (!model) {
      console.log("Firebird NOT found");
      return;
    }
    console.log("Model found:", model.slug);
    
    // Get years
    const years = await wheelSizeApi.getYears(make.slug, model.slug);
    console.log("Years available:", years?.slice(0, 10).join(", "), "...");
    
    // Get modifications for 2000
    const mods = await wheelSizeApi.getModifications(make.slug, model.slug, 2000);
    console.log("\n2000 Firebird modifications:");
    if (mods && mods.length > 0) {
      mods.forEach(m => console.log("  -", m.name || m.slug));
    } else {
      console.log("  (none)");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
check();
