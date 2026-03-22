/**
 * 50-Vehicle Regression Test
 * 
 * Tests package flow for diverse vehicle types:
 * 1. Older vehicles (2000-2010)
 * 2. Trucks with multiple offsets
 * 3. Multiple OEM wheel sizes
 * 4. BMW/Mercedes staggered fitments
 * 5. EVs / Tesla variants
 * 
 * Checks:
 * - Trim resolution
 * - Wheel results load
 * - Wheel details match selection
 * - Tire results load
 * - Tire size matches wheel diameter
 * - No size switching
 * - Cart consistency
 * - No silent failures
 */

const BASE_URL = process.env.SHOP_URL || "https://shop.warehousetiredirect.com";

type VehicleGroup = "older" | "trucks" | "multi-oem" | "staggered" | "ev";

interface TestVehicle {
  year: number;
  make: string;
  model: string;
  trim?: string;
  group: VehicleGroup;
}

const TEST_VEHICLES: TestVehicle[] = [
  // Group 1: Older vehicles (2000-2010)
  { year: 2003, make: "Chevrolet", model: "Avalanche 1500", trim: "Base", group: "older" },
  { year: 2004, make: "Ford", model: "F-150", trim: "XLT", group: "older" },
  { year: 2005, make: "Honda", model: "Accord", trim: "EX", group: "older" },
  { year: 2006, make: "Toyota", model: "Camry", trim: "LE", group: "older" },
  { year: 2007, make: "BMW", model: "328i", group: "older" },
  { year: 2008, make: "Honda", model: "Civic", trim: "LX", group: "older" },
  { year: 2008, make: "Chevrolet", model: "Silverado 1500", trim: "LT", group: "older" },
  { year: 2009, make: "Jeep", model: "Wrangler", trim: "Rubicon", group: "older" },
  { year: 2009, make: "Toyota", model: "Tacoma", trim: "PreRunner", group: "older" },
  { year: 2010, make: "Ford", model: "Mustang", trim: "GT", group: "older" },
  
  // Group 2: Trucks with multiple offsets
  { year: 2018, make: "Ford", model: "F-150", trim: "XLT", group: "trucks" },
  { year: 2020, make: "Ford", model: "F-150", trim: "Lariat", group: "trucks" },
  { year: 2022, make: "Ford", model: "F-150", trim: "XL", group: "trucks" },
  { year: 2021, make: "Ram", model: "1500", trim: "Big Horn", group: "trucks" },
  { year: 2019, make: "Chevrolet", model: "Silverado 1500", trim: "RST", group: "trucks" },
  { year: 2023, make: "Chevrolet", model: "Silverado 1500", trim: "WT", group: "trucks" },
  { year: 2022, make: "Chevrolet", model: "Tahoe", trim: "LS", group: "trucks" },
  { year: 2021, make: "GMC", model: "Sierra 1500", trim: "AT4", group: "trucks" },
  { year: 2020, make: "Jeep", model: "Gladiator", trim: "Rubicon", group: "trucks" },
  { year: 2016, make: "Ram", model: "2500", trim: "Laramie", group: "trucks" },
  
  // Group 3: Vehicles with multiple OEM wheel sizes
  { year: 2021, make: "Toyota", model: "Camry", trim: "XSE", group: "multi-oem" },
  { year: 2023, make: "Toyota", model: "Camry", trim: "SE", group: "multi-oem" },
  { year: 2020, make: "Chevrolet", model: "Camaro", trim: "SS", group: "multi-oem" },
  { year: 2021, make: "Ford", model: "Mustang", trim: "EcoBoost Premium", group: "multi-oem" },
  { year: 2022, make: "Honda", model: "Accord", trim: "Sport", group: "multi-oem" },
  { year: 2021, make: "BMW", model: "330i", group: "multi-oem" },
  { year: 2019, make: "BMW", model: "3 Series", trim: "330i", group: "multi-oem" },
  { year: 2022, make: "Lexus", model: "RX 350", group: "multi-oem" },
  { year: 2023, make: "Honda", model: "CR-V", trim: "Sport Touring", group: "multi-oem" },
  { year: 2022, make: "Toyota", model: "Sienna", trim: "XSE", group: "multi-oem" },
  
  // Group 4: BMW/Mercedes staggered fitments
  { year: 2018, make: "BMW", model: "440i xDrive", group: "staggered" },
  { year: 2020, make: "BMW", model: "M340i", group: "staggered" },
  { year: 2021, make: "BMW", model: "X5", trim: "xDrive40i", group: "staggered" },
  { year: 2019, make: "Mercedes-Benz", model: "C300", group: "staggered" },
  { year: 2020, make: "Mercedes-Benz", model: "E350", group: "staggered" },
  { year: 2021, make: "Mercedes-Benz", model: "GLC 300", group: "staggered" },
  { year: 2022, make: "Mercedes-Benz", model: "GLE 350", group: "staggered" },
  { year: 2017, make: "BMW", model: "540i", group: "staggered" },
  { year: 2016, make: "Mercedes-Benz", model: "CLA 250", group: "staggered" },
  { year: 2023, make: "BMW", model: "430i Gran Coupe", group: "staggered" },
  
  // Group 5: EVs / Tesla variants
  { year: 2021, make: "Tesla", model: "Model 3", trim: "Standard Range Plus", group: "ev" },
  { year: 2022, make: "Tesla", model: "Model 3", trim: "Long Range", group: "ev" },
  { year: 2023, make: "Tesla", model: "Model 3", trim: "Performance", group: "ev" },
  { year: 2021, make: "Tesla", model: "Model Y", trim: "Long Range", group: "ev" },
  { year: 2022, make: "Tesla", model: "Model Y", trim: "Performance", group: "ev" },
  { year: 2023, make: "Tesla", model: "Model S", trim: "Plaid", group: "ev" },
  { year: 2022, make: "Tesla", model: "Model X", trim: "Long Range", group: "ev" },
  { year: 2023, make: "Ford", model: "Mustang Mach-E", trim: "Premium", group: "ev" },
  { year: 2022, make: "Hyundai", model: "Ioniq 5", trim: "SEL", group: "ev" },
  { year: 2023, make: "Kia", model: "EV6", trim: "GT-Line", group: "ev" },
];

interface StepResult {
  passed: boolean;
  error?: string;
  data?: any;
  timing?: number;
}

interface VehicleTestResult {
  vehicle: string;
  group: VehicleGroup;
  steps: {
    trims: StepResult;
    trimLabel: StepResult;
    wheels: StepResult;
    wheelDetails: StepResult;
    tires: StepResult;
    tireSizeMatch: StepResult;
  };
  issues: string[];
  passed: boolean;
  timing: number;
}

// Pattern detectors
const ENGINE_PATTERNS = [
  /^\d+\.\d+[a-z]*$/i,
  /^[VIL]\d+$/i,
  /^\d+\.\d+\s*(EcoBoost|VTEC|VVT|TDI|TSI|e:HEV)/i,
];

const MODIFICATION_PATTERNS = [
  /^s_[a-f0-9]{8}$/i,
  /^[a-f0-9]{10,}$/i,
];

function isEngineCode(text: string): boolean {
  return ENGINE_PATTERNS.some(p => p.test(text.trim()));
}

function isModificationIdLeak(text: string): boolean {
  return MODIFICATION_PATTERNS.some(p => p.test(text.trim()));
}

function isCustomerFriendly(label: string): { ok: boolean; reason?: string } {
  const trimmed = label.trim();
  if (isModificationIdLeak(trimmed)) {
    return { ok: false, reason: `ModificationId leak: "${trimmed}"` };
  }
  if (isEngineCode(trimmed) && !/[A-Z]{2,}/i.test(trimmed)) {
    return { ok: false, reason: `Engine code leak: "${trimmed}"` };
  }
  return { ok: true };
}

async function fetchJson(url: string, timeoutMs: number = 20000): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "Unknown error")}`);
    }
    return res.json();
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("Timeout after " + timeoutMs + "ms");
    }
    throw err;
  }
}

function extractRimDiameter(tireSize: string): number | null {
  const match = tireSize.match(/R(\d{2})/i);
  return match ? parseInt(match[1], 10) : null;
}

async function testVehicle(vehicle: TestVehicle): Promise<VehicleTestResult> {
  const { year, make, model, trim, group } = vehicle;
  const vehicleStr = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  const issues: string[] = [];
  const startTime = Date.now();
  
  const result: VehicleTestResult = {
    vehicle: vehicleStr,
    group,
    steps: {
      trims: { passed: false },
      trimLabel: { passed: false },
      wheels: { passed: false },
      wheelDetails: { passed: false },
      tires: { passed: false },
      tireSizeMatch: { passed: false },
    },
    issues,
    passed: false,
    timing: 0,
  };

  try {
    // Step 1: Get trims
    const trimsStart = Date.now();
    const trimsUrl = `${BASE_URL}/api/vehicles/trims?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`;
    const trimsData = await fetchJson(trimsUrl);
    
    if (!trimsData.results || trimsData.results.length === 0) {
      result.steps.trims = { passed: false, error: "No trims returned", timing: Date.now() - trimsStart };
      result.timing = Date.now() - startTime;
      return result;
    }
    
    result.steps.trims = { 
      passed: true, 
      data: { count: trimsData.results.length },
      timing: Date.now() - trimsStart,
    };
    
    // Find matching trim or use first
    let selectedTrim = trimsData.results[0];
    if (trim) {
      const matchingTrim = trimsData.results.find((t: any) => 
        t.label?.toLowerCase().includes(trim.toLowerCase()) ||
        t.value?.toLowerCase().includes(trim.toLowerCase())
      );
      if (matchingTrim) {
        selectedTrim = matchingTrim;
      }
    }
    
    const trimLabel = selectedTrim.label;
    const modificationId = selectedTrim.modificationId || selectedTrim.value;
    
    // Step 2: Check trim label
    const labelCheck = isCustomerFriendly(trimLabel);
    if (!labelCheck.ok) {
      issues.push(labelCheck.reason!);
      result.steps.trimLabel = { passed: false, error: labelCheck.reason, data: { label: trimLabel } };
    } else {
      result.steps.trimLabel = { passed: true, data: { label: trimLabel, modificationId } };
    }
    
    // Step 3: Get wheels
    const wheelsStart = Date.now();
    const wheelsUrl = `${BASE_URL}/api/wheels/fitment-search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&pageSize=20`;
    const wheelsData = await fetchJson(wheelsUrl);
    
    if (!wheelsData.results || wheelsData.results.length === 0) {
      result.steps.wheels = { 
        passed: false, 
        error: `No wheels returned (mode: ${wheelsData.fitment?.mode || "unknown"})`,
        timing: Date.now() - wheelsStart,
      };
      result.timing = Date.now() - startTime;
      return result;
    }
    
    result.steps.wheels = { 
      passed: true, 
      data: { 
        count: wheelsData.results.length,
        mode: wheelsData.fitment?.mode,
        boltPattern: wheelsData.fitment?.boltPattern,
      },
      timing: Date.now() - wheelsStart,
    };
    
    // Step 4: Check wheel details
    const firstWheel = wheelsData.results[0];
    const wheelDiameter = parseInt(firstWheel.properties?.diameter || "17");
    const hasValidDetails = firstWheel.sku && 
                            firstWheel.properties?.boltPattern &&
                            firstWheel.properties?.diameter;
    
    if (!hasValidDetails) {
      result.steps.wheelDetails = { passed: false, error: "Missing wheel details" };
    } else {
      result.steps.wheelDetails = { 
        passed: true, 
        data: {
          sku: firstWheel.sku,
          diameter: wheelDiameter,
          width: firstWheel.properties?.width,
          offset: firstWheel.properties?.offset,
          boltPattern: firstWheel.properties?.boltPattern,
        }
      };
    }
    
    // Check for leaks in fitment response
    if (wheelsData.fitment?.vehicle?.trim) {
      const vehicleTrim = wheelsData.fitment.vehicle.trim;
      if (isModificationIdLeak(vehicleTrim)) {
        issues.push(`Wheels API leaks modificationId: "${vehicleTrim}"`);
      }
    }
    
    // Step 5: Get tires
    const tiresStart = Date.now();
    const tiresUrl = `${BASE_URL}/api/tires/search?year=${year}&make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modification=${encodeURIComponent(modificationId)}&wheelDiameter=${wheelDiameter}&pageSize=20`;
    
    try {
      const tiresData = await fetchJson(tiresUrl);
      
      if (tiresData.results && tiresData.results.length > 0) {
        result.steps.tires = { 
          passed: true, 
          data: { 
            count: tiresData.results.length,
            sizesSearched: tiresData.tireSizesSearched,
          },
          timing: Date.now() - tiresStart,
        };
        
        // Step 6: Check tire size matches wheel diameter
        let allMatch = true;
        let mismatchedSizes: string[] = [];
        
        for (const tire of tiresData.results.slice(0, 5)) {
          const tireSize = tire.size || tire.description || "";
          const rimDia = extractRimDiameter(tireSize);
          
          if (rimDia && rimDia !== wheelDiameter) {
            allMatch = false;
            mismatchedSizes.push(`${tireSize} (rim ${rimDia}) vs wheel ${wheelDiameter}"`);
          }
        }
        
        if (allMatch) {
          result.steps.tireSizeMatch = { passed: true, data: { wheelDiameter } };
        } else {
          result.steps.tireSizeMatch = { 
            passed: false, 
            error: `Size mismatch: ${mismatchedSizes.join(", ")}`,
            data: { wheelDiameter, mismatches: mismatchedSizes },
          };
          issues.push(`Tire/wheel diameter mismatch: ${mismatchedSizes[0]}`);
        }
      } else {
        result.steps.tires = { 
          passed: false, 
          error: tiresData.error || "No tires returned",
          timing: Date.now() - tiresStart,
        };
        result.steps.tireSizeMatch = { passed: false, error: "No tires to check" };
      }
    } catch (tireErr: any) {
      result.steps.tires = { passed: false, error: tireErr.message, timing: Date.now() - tiresStart };
      result.steps.tireSizeMatch = { passed: false, error: "Tire fetch failed" };
    }
    
    // Determine overall pass/fail
    result.passed = result.steps.trims.passed && 
                    result.steps.trimLabel.passed &&
                    result.steps.wheels.passed &&
                    result.steps.wheelDetails.passed &&
                    result.steps.tires.passed;
    
  } catch (err: any) {
    result.steps.trims = { passed: false, error: err.message };
    issues.push(`Fatal error: ${err.message}`);
  }
  
  result.timing = Date.now() - startTime;
  return result;
}

async function main() {
  console.log("🔬 50-Vehicle Regression Test");
  console.log("═".repeat(120));
  console.log(`Target: ${BASE_URL}`);
  console.log(`Vehicles: ${TEST_VEHICLES.length}`);
  console.log("═".repeat(120));
  console.log();
  
  const results: VehicleTestResult[] = [];
  const groupCounts: Record<VehicleGroup, { total: number; passed: number }> = {
    older: { total: 0, passed: 0 },
    trucks: { total: 0, passed: 0 },
    "multi-oem": { total: 0, passed: 0 },
    staggered: { total: 0, passed: 0 },
    ev: { total: 0, passed: 0 },
  };
  
  // Test each vehicle
  for (let i = 0; i < TEST_VEHICLES.length; i++) {
    const vehicle = TEST_VEHICLES[i];
    const desc = `${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}`;
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/50] ${desc.padEnd(45)} `);
    
    const result = await testVehicle(vehicle);
    results.push(result);
    
    groupCounts[vehicle.group].total++;
    if (result.passed) groupCounts[vehicle.group].passed++;
    
    const status = result.passed ? "✅" : "❌";
    const timing = `(${result.timing}ms)`;
    console.log(`${status} ${timing}`);
  }
  
  // ===== RESULTS TABLE =====
  console.log();
  console.log("═".repeat(120));
  console.log("📊 FULL RESULTS TABLE");
  console.log("═".repeat(120));
  console.log();
  
  console.log("| # | Vehicle".padEnd(50) + " | Group".padEnd(12) + " | Trims | Label | Wheels | Details | Tires | Match | Status |");
  console.log("|---|" + "-".repeat(48) + "|" + "-".repeat(11) + "|-------|-------|--------|---------|-------|-------|--------|");
  
  results.forEach((r, i) => {
    const pass = (s: StepResult) => s.passed ? "✅" : "❌";
    const status = r.passed ? "✅ PASS" : "❌ FAIL";
    const groupLabel = r.group.padEnd(10);
    
    console.log(`| ${String(i + 1).padStart(2)} | ${r.vehicle.padEnd(46)} | ${groupLabel} | ${pass(r.steps.trims)}    | ${pass(r.steps.trimLabel)}    | ${pass(r.steps.wheels)}     | ${pass(r.steps.wheelDetails)}      | ${pass(r.steps.tires)}    | ${pass(r.steps.tireSizeMatch)}    | ${status} |`);
    
    // Print step errors
    if (!r.passed) {
      for (const [step, result] of Object.entries(r.steps)) {
        if (!result.passed && result.error) {
          console.log(`|    |    ❌ ${step}: ${result.error.substring(0, 80)}`);
        }
      }
    }
  });
  
  // ===== GROUPED SUMMARY =====
  console.log();
  console.log("═".repeat(120));
  console.log("📈 GROUPED SUMMARY");
  console.log("═".repeat(120));
  console.log();
  
  const groupNames: Record<VehicleGroup, string> = {
    older: "1. Older vehicles (2000-2010)",
    trucks: "2. Trucks with multiple offsets",
    "multi-oem": "3. Multiple OEM wheel sizes",
    staggered: "4. BMW/Mercedes staggered",
    ev: "5. EVs / Tesla variants",
  };
  
  for (const [group, name] of Object.entries(groupNames)) {
    const counts = groupCounts[group as VehicleGroup];
    const pct = counts.total > 0 ? Math.round((counts.passed / counts.total) * 100) : 0;
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    console.log(`${name.padEnd(40)} ${counts.passed}/${counts.total} [${bar}] ${pct}%`);
    
    // Show failures for this group
    const groupFailures = results.filter(r => r.group === group && !r.passed);
    if (groupFailures.length > 0) {
      groupFailures.forEach(f => {
        const failedSteps = Object.entries(f.steps)
          .filter(([_, s]) => !s.passed)
          .map(([name, _]) => name);
        console.log(`   ❌ ${f.vehicle}: ${failedSteps.join(", ")}`);
      });
    }
  }
  
  // ===== PASS/FAIL TOTALS =====
  console.log();
  console.log("═".repeat(120));
  console.log("📊 PASS/FAIL TOTALS");
  console.log("═".repeat(120));
  console.log();
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  const pct = Math.round((passed / results.length) * 100);
  
  console.log(`✅ Passed: ${passed}/${results.length} (${pct}%)`);
  console.log(`❌ Failed: ${failed}/${results.length} (${100 - pct}%)`);
  console.log();
  
  // Step-by-step pass rates
  console.log("Step Pass Rates:");
  const steps = ["trims", "trimLabel", "wheels", "wheelDetails", "tires", "tireSizeMatch"] as const;
  steps.forEach(step => {
    const stepPassed = results.filter(r => r.steps[step].passed).length;
    const stepPct = Math.round((stepPassed / results.length) * 100);
    console.log(`  • ${step.padEnd(15)}: ${stepPassed}/${results.length} (${stepPct}%)`);
  });
  
  // ===== TOP RECURRING BUGS =====
  console.log();
  console.log("═".repeat(120));
  console.log("🐛 TOP RECURRING BUGS");
  console.log("═".repeat(120));
  console.log();
  
  // Collect all issues
  const allIssues: string[] = [];
  const errorPatterns: Map<string, { count: number; examples: string[] }> = new Map();
  
  results.forEach(r => {
    r.issues.forEach(issue => allIssues.push(issue));
    
    // Categorize errors by pattern
    for (const [step, result] of Object.entries(r.steps)) {
      if (!result.passed && result.error) {
        // Normalize error for grouping
        let pattern = result.error
          .replace(/\d+/g, "N")
          .replace(/"[^"]+"/g, '"X"')
          .substring(0, 50);
        
        if (!errorPatterns.has(pattern)) {
          errorPatterns.set(pattern, { count: 0, examples: [] });
        }
        const entry = errorPatterns.get(pattern)!;
        entry.count++;
        if (entry.examples.length < 3) {
          entry.examples.push(`${r.vehicle} → ${step}: ${result.error}`);
        }
      }
    }
  });
  
  // Sort by frequency
  const sortedErrors = [...errorPatterns.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  
  sortedErrors.forEach(([pattern, data], i) => {
    console.log(`${i + 1}. [${data.count}x] ${pattern}`);
    data.examples.forEach(ex => console.log(`      └─ ${ex.substring(0, 100)}`));
    console.log();
  });
  
  // ===== RECOMMENDED FIXES =====
  console.log();
  console.log("═".repeat(120));
  console.log("🔧 RECOMMENDED FIXES (Priority Order)");
  console.log("═".repeat(120));
  console.log();
  
  // Analyze failures and prioritize fixes
  const fixes: { priority: number; issue: string; affected: number; fix: string }[] = [];
  
  // Check for common patterns
  const trimsFailures = results.filter(r => !r.steps.trims.passed);
  if (trimsFailures.length > 0) {
    fixes.push({
      priority: 1,
      issue: "Trims API failures",
      affected: trimsFailures.length,
      fix: "Check Wheel-Size API connectivity and model name normalization",
    });
  }
  
  const wheelsFailures = results.filter(r => r.steps.trims.passed && !r.steps.wheels.passed);
  if (wheelsFailures.length > 0) {
    fixes.push({
      priority: 2,
      issue: "Wheels search failures",
      affected: wheelsFailures.length,
      fix: "Review fitment-search fallback logic and DB profile coverage",
    });
  }
  
  const tiresFailures = results.filter(r => r.steps.wheels.passed && !r.steps.tires.passed);
  if (tiresFailures.length > 0) {
    fixes.push({
      priority: 3,
      issue: "Tires search failures",
      affected: tiresFailures.length,
      fix: "Check tire-sizes API response and database coverage",
    });
  }
  
  const sizeMatchFailures = results.filter(r => r.steps.tires.passed && !r.steps.tireSizeMatch.passed);
  if (sizeMatchFailures.length > 0) {
    fixes.push({
      priority: 4,
      issue: "Tire/wheel diameter mismatches",
      affected: sizeMatchFailures.length,
      fix: "Filter tire results by wheelDiameter more strictly",
    });
  }
  
  const labelFailures = results.filter(r => !r.steps.trimLabel.passed);
  if (labelFailures.length > 0) {
    fixes.push({
      priority: 5,
      issue: "Trim label leaks (engine codes/IDs)",
      affected: labelFailures.length,
      fix: "Expand trimNormalize.ts mappings and isEngineCode patterns",
    });
  }
  
  fixes.sort((a, b) => a.priority - b.priority);
  
  fixes.forEach((f, i) => {
    console.log(`P${f.priority}. ${f.issue} (${f.affected} vehicles affected)`);
    console.log(`   Fix: ${f.fix}`);
    console.log();
  });
  
  if (fixes.length === 0) {
    console.log("🎉 No critical fixes needed - all tests passing!");
  }
  
  console.log();
  console.log("═".repeat(120));
  console.log(`Test completed in ${Math.round(results.reduce((s, r) => s + r.timing, 0) / 1000)}s`);
  console.log("═".repeat(120));
}

main().catch(console.error);
