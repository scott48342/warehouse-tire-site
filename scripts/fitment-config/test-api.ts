/**
 * Test the configurations API behavior
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { getFitmentConfigurations } from "../../src/lib/fitment-db/getFitmentConfigurations";

async function test() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  API BEHAVIOR TEST");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Test 1: 2022 Camry LE - should now return single 17" config
  console.log("Test 1: 2022 Toyota Camry LE");
  const camryLE = await getFitmentConfigurations(2022, "Toyota", "Camry", "LE");
  console.log("  usedConfigTable:", camryLE.usedConfigTable);
  console.log("  confidence:", camryLE.confidence);
  console.log("  uniqueDiameters:", camryLE.uniqueDiameters);
  console.log("  hasMultipleDiameters:", camryLE.hasMultipleDiameters);
  console.log("  configurations:", camryLE.configurations.length);
  camryLE.configurations.forEach(c => console.log(`    - ${c.wheelDiameter}" ${c.tireSize}`));
  console.log("");

  // Test 2: 2022 Escalade - should have 22"/24" options
  console.log("Test 2: 2022 Cadillac Escalade");
  const escalade = await getFitmentConfigurations(2022, "Cadillac", "Escalade");
  console.log("  usedConfigTable:", escalade.usedConfigTable);
  console.log("  confidence:", escalade.confidence);
  console.log("  uniqueDiameters:", escalade.uniqueDiameters);
  console.log("  hasMultipleDiameters:", escalade.hasMultipleDiameters);
  console.log("");

  // Test 3: 2022 Ford F-150 (not in config table) - should use legacy fallback
  console.log("Test 3: 2022 Ford F-150 (legacy fallback)");
  const f150 = await getFitmentConfigurations(2022, "Ford", "F-150");
  console.log("  usedConfigTable:", f150.usedConfigTable);
  console.log("  confidence:", f150.confidence);
  console.log("  source:", f150.source);
  console.log("  uniqueDiameters:", f150.uniqueDiameters);
  console.log("");

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  WHEEL SIZE GATE DECISION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Test wheel size gate decision
  console.log("2022 Camry LE should SKIP gate (single 17\" config):");
  console.log("  hasMultipleDiameters:", camryLE.hasMultipleDiameters);
  console.log("  → Gate skipped:", !camryLE.hasMultipleDiameters);
  console.log("");

  console.log("2022 Escalade should SHOW gate (22\"/24\" options):");
  console.log("  hasMultipleDiameters:", escalade.hasMultipleDiameters);
  console.log("  → Gate shown:", escalade.hasMultipleDiameters);

  process.exit(0);
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
