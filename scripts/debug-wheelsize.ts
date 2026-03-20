/**
 * Debug script for Wheel-Size API
 * Tests the API step-by-step to find exact query paths
 * 
 * Run: npx ts-node --esm scripts/debug-wheelsize.ts
 */

const BASE_URL = "https://api.wheel-size.com/v2/";

// Get API key from env
const API_KEY = process.env.WHEELSIZE_API_KEY;
if (!API_KEY) {
  console.error("ERROR: WHEELSIZE_API_KEY environment variable not set");
  process.exit(1);
}

async function apiGet(path: string, params?: Record<string, string>): Promise<any> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("user_key", API_KEY!);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }

  const fullUrl = url.toString();
  const safeUrl = fullUrl.replace(/user_key=[^&]+/, "user_key=***");
  
  console.log(`\n${"=".repeat(80)}`);
  console.log(`REQUEST: ${safeUrl}`);
  console.log(`PARAMS: ${JSON.stringify(params || {})}`);
  
  const res = await fetch(fullUrl, {
    headers: { Accept: "application/json" },
  });

  const text = await res.text();
  
  console.log(`STATUS: ${res.status}`);
  console.log(`RESPONSE LENGTH: ${text.length} bytes`);
  
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.log(`RAW RESPONSE: ${text.slice(0, 1000)}`);
    throw new Error(`JSON parse failed: ${e}`);
  }
  
  return data;
}

async function main() {
  console.log("\n" + "=".repeat(80));
  console.log("WHEEL-SIZE API DEBUG - 2024 Ford F-150");
  console.log("=".repeat(80));

  // Step 1: Get all makes, find Ford
  console.log("\n\n### STEP 1: GET MAKES ###");
  const makesRes = await apiGet("makes/");
  const makes = makesRes.data || [];
  console.log(`Total makes: ${makes.length}`);
  
  const fordMakes = makes.filter((m: any) => 
    m.name.toLowerCase().includes("ford") || m.slug.includes("ford")
  );
  console.log(`Ford matches:`, JSON.stringify(fordMakes, null, 2));

  // Step 2: Get models for Ford
  console.log("\n\n### STEP 2: GET MODELS FOR FORD ###");
  const modelsRes = await apiGet("models/", { make: "ford" });
  const models = modelsRes.data || [];
  console.log(`Total Ford models: ${models.length}`);
  
  const f150Models = models.filter((m: any) => 
    m.name.toLowerCase().includes("f-150") || 
    m.name.toLowerCase().includes("f150") ||
    m.slug.includes("f-150") ||
    m.slug.includes("f150")
  );
  console.log(`F-150 matches:`, JSON.stringify(f150Models, null, 2));

  // Also check for any "F" models to see naming convention
  const fModels = models.filter((m: any) => m.name.startsWith("F-") || m.name.startsWith("F "));
  console.log(`All F-series models:`, JSON.stringify(fModels.slice(0, 10), null, 2));

  // Step 3: Get years for Ford F-150 (using the slug we found)
  const f150Slug = f150Models[0]?.slug || "f-150";
  console.log(`\n\n### STEP 3: GET YEARS FOR FORD ${f150Slug} ###`);
  const yearsRes = await apiGet("years/", { make: "ford", model: f150Slug });
  const years = yearsRes.data || [];
  console.log(`Total years: ${years.length}`);
  console.log(`Years available:`, years.map((y: any) => y.name || y.slug).join(", "));
  
  const has2024 = years.some((y: any) => y.name === "2024" || y.slug === "2024");
  console.log(`Has 2024: ${has2024}`);

  // Step 4: Get modifications for 2024 Ford F-150
  console.log("\n\n### STEP 4: GET MODIFICATIONS FOR 2024 FORD F-150 ###");
  const modsRes = await apiGet("modifications/", { 
    make: "ford", 
    model: f150Slug, 
    year: "2024" 
  });
  const mods = modsRes.data || [];
  console.log(`Total modifications: ${mods.length}`);
  
  // Print all modifications
  console.log("\nALL MODIFICATIONS:");
  for (const mod of mods) {
    console.log(`  - slug: "${mod.slug}"`);
    console.log(`    name: "${mod.name}"`);
    console.log(`    trim: "${mod.trim || 'N/A'}"`);
    console.log(`    body: "${mod.body || 'N/A'}"`);
    console.log(`    regions: ${JSON.stringify(mod.regions || [])}`);
    if (mod.generation) {
      console.log(`    generation: ${mod.generation.name} (${mod.generation.start_year}-${mod.generation.end_year || 'present'})`);
    }
    console.log("");
  }

  // Find XLT modifications
  const xltMods = mods.filter((m: any) => 
    m.name?.toLowerCase().includes("xlt") || 
    m.trim?.toLowerCase().includes("xlt") ||
    m.slug?.toLowerCase().includes("xlt")
  );
  console.log(`XLT modifications found: ${xltMods.length}`);
  if (xltMods.length > 0) {
    console.log("XLT mods:", JSON.stringify(xltMods, null, 2));
  }

  // Step 5: Get full vehicle data using search/by_model
  console.log("\n\n### STEP 5: SEARCH BY MODEL (NO MODIFICATION) ###");
  const searchRes1 = await apiGet("search/by_model/", {
    make: "ford",
    model: f150Slug,
    year: "2024",
  });
  console.log(`Results: ${searchRes1.data?.length || 0}`);
  if (searchRes1.data?.[0]) {
    console.log("First result summary:", {
      slug: searchRes1.data[0].slug,
      make: searchRes1.data[0].make?.name,
      model: searchRes1.data[0].model?.name,
      trim: searchRes1.data[0].trim,
      body: searchRes1.data[0].body,
      years: searchRes1.data[0].years,
      hasTechnical: !!searchRes1.data[0].technical,
      hasWheels: !!searchRes1.data[0].wheels,
      wheelsCount: searchRes1.data[0].wheels?.length || 0,
    });
  }

  // Step 6: Try with a specific modification slug
  if (mods.length > 0) {
    const testMod = xltMods[0] || mods[0];
    console.log(`\n\n### STEP 6: SEARCH BY MODEL WITH MODIFICATION "${testMod.slug}" ###`);
    const searchRes2 = await apiGet("search/by_model/", {
      make: "ford",
      model: f150Slug,
      year: "2024",
      modification: testMod.slug,
    });
    console.log(`Results: ${searchRes2.data?.length || 0}`);
    
    if (searchRes2.data?.[0]) {
      const vehicle = searchRes2.data[0];
      console.log("\nFULL VEHICLE DATA:");
      console.log(JSON.stringify(vehicle, null, 2));
      
      // Save to file
      const fs = await import("fs");
      const outPath = "./debug-wheelsize-f150-result.json";
      fs.writeFileSync(outPath, JSON.stringify(vehicle, null, 2));
      console.log(`\nSaved full response to ${outPath}`);
      
      // Extract key data
      if (vehicle.technical) {
        console.log("\n### TECHNICAL DATA ###");
        console.log(`  Bolt Pattern: ${vehicle.technical.bolt_pattern}`);
        console.log(`  Center Bore: ${vehicle.technical.centre_bore}mm`);
        console.log(`  Stud Holes: ${vehicle.technical.stud_holes}`);
        console.log(`  PCD: ${vehicle.technical.pcd}mm`);
        console.log(`  Thread Size: ${vehicle.technical.thread_size || 'N/A'}`);
        console.log(`  Fastener Type: ${vehicle.technical.fastener_type || 'N/A'}`);
        console.log(`  Torque: ${vehicle.technical.wheel_tightening_torque || 'N/A'}Nm`);
      }
      
      if (vehicle.wheels?.length > 0) {
        console.log("\n### WHEEL SETUPS ###");
        for (const w of vehicle.wheels) {
          console.log(`  ${w.is_stock ? '[STOCK]' : '[PLUS]'} Front: ${w.front.rim} / ${w.front.tire}`);
          if (w.rear && !w.showing_fp_only) {
            console.log(`         Rear:  ${w.rear.rim} / ${w.rear.tire}`);
          }
        }
      }
    }
  }

  // Step 7: Test what happens with wrong/old query format
  console.log("\n\n### STEP 7: TEST FAILURE CASES ###");
  
  console.log("\nTest A: Wrong model name 'F150' (no hyphen):");
  const failTestA = await apiGet("search/by_model/", {
    make: "ford",
    model: "f150",
    year: "2024",
  });
  console.log(`Results: ${failTestA.data?.length || 0}`);

  console.log("\nTest B: Wrong capitalization 'Ford' instead of 'ford':");
  const failTestB = await apiGet("search/by_model/", {
    make: "Ford",
    model: "F-150",
    year: "2024",
  });
  console.log(`Results: ${failTestB.data?.length || 0}`);

  console.log("\n\n" + "=".repeat(80));
  console.log("DEBUG COMPLETE");
  console.log("=".repeat(80));
}

main().catch(console.error);
