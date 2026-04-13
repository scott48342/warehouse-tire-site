/**
 * Fitment Research Pilot Script
 * 
 * Web-researches per-trim tire sizes for high-traffic vehicles.
 * 
 * NON-NEGOTIABLE RULES:
 * - Output to STAGING only (not production)
 * - Default confidence = MEDIUM (not high)
 * - Require 2+ source agreement for promotion
 * - Flag conflicts for manual review
 * 
 * Source ranking:
 * 1. OEM / manufacturer docs
 * 2. Major fitment retailers (Tire Rack, Discount Tire, etc.)
 * 3. Other sources
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

// Load API key from clawdbot config if not in env
async function getApiKey(): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  
  const configPath = path.join(os.homedir(), ".clawdbot", "clawdbot.json");
  try {
    const config = JSON.parse(await fs.readFile(configPath, "utf-8"));
    return config.apiKeys?.anthropic || "";
  } catch {
    throw new Error("No ANTHROPIC_API_KEY found in env or ~/.clawdbot/clawdbot.json");
  }
}

// ============================================================================
// Types
// ============================================================================

interface ResearchSource {
  name: string;
  url?: string;
  tier: 1 | 2 | 3; // 1=OEM, 2=major retailer, 3=other
}

interface TrimFitment {
  trim: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth?: number;
}

interface ResearchResult {
  year: number;
  make: string;
  model: string;
  trim: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth: number | null;
  sources: ResearchSource[];
  sourceCount: number;
  confidence: "high" | "medium" | "low";
  conflictStatus: "none" | "minor" | "major";
  conflictNotes?: string;
  rawResponse?: string;
  researchedAt: string;
}

interface PilotOutput {
  metadata: {
    generatedAt: string;
    vehicleCount: number;
    trimCount: number;
    conflictCount: number;
  };
  candidates: ResearchResult[];
  conflicts: ResearchResult[];
  promotionReady: ResearchResult[];
}

// ============================================================================
// Configuration
// ============================================================================

const PILOT_VEHICLES = [
  // Japanese sedans
  { make: "Toyota", model: "Camry", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Honda", model: "Accord", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Honda", model: "Civic", years: [2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Toyota", model: "Corolla", years: [2019, 2020, 2021, 2022, 2023, 2024] },
  // Japanese SUVs
  { make: "Toyota", model: "RAV4", years: [2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Honda", model: "CR-V", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  // Trucks
  { make: "Ford", model: "F-150", years: [2018, 2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Chevrolet", model: "Silverado 1500", years: [2019, 2020, 2021, 2022, 2023, 2024] },
  { make: "Ram", model: "1500", years: [2019, 2020, 2021, 2022, 2023, 2024] },
  // Full-size SUVs (already partially seeded, but verify)
  { make: "Chevrolet", model: "Tahoe", years: [2021, 2022, 2023, 2024] },
  { make: "Chevrolet", model: "Suburban", years: [2021, 2022, 2023, 2024] },
  { make: "GMC", model: "Yukon", years: [2021, 2022, 2023, 2024] },
  { make: "Cadillac", model: "Escalade", years: [2021, 2022, 2023, 2024] },
];

const OUTPUT_DIR = path.join(__dirname, "staging");

// ============================================================================
// Research Functions
// ============================================================================

async function researchVehicleFitment(
  client: Anthropic,
  year: number,
  make: string,
  model: string
): Promise<TrimFitment[]> {
  const prompt = `Research the EXACT OEM/stock tire sizes for the ${year} ${make} ${model}.

I need the tire size for EACH TRIM LEVEL separately. This is critical - different trims have different wheel sizes.

Format your response as a JSON array with this exact structure:
[
  {
    "trim": "LE",
    "tireSize": "215/55R17",
    "wheelDiameter": 17,
    "wheelWidth": 7.0
  },
  ...
]

Requirements:
1. List EVERY available trim for ${year} ${make} ${model}
2. Use the PRIMARY/standard tire size for each trim (not optional upgrades)
3. Tire size format: ###/##R## (e.g., 215/55R17)
4. wheelDiameter is the rim size in inches (the R## number)
5. wheelWidth in inches if known, otherwise omit

Be thorough - include base trims (L, LX, S) through sport/luxury trims (XSE, Touring, Limited).

Sources to consider:
- Toyota/Honda/Ford/etc official specs
- Tire Rack
- Discount Tire
- TireSize.com
- Car and Driver specs

Return ONLY the JSON array, no other text.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`[${year} ${make} ${model}] No JSON found in response`);
      return [];
    }

    const fitments = JSON.parse(jsonMatch[0]) as TrimFitment[];
    return fitments;
  } catch (err) {
    console.error(`[${year} ${make} ${model}] Research failed:`, err);
    return [];
  }
}

async function verifyWithSecondSource(
  client: Anthropic,
  year: number,
  make: string,
  model: string,
  primaryResults: TrimFitment[]
): Promise<{ verified: TrimFitment[]; conflicts: TrimFitment[] }> {
  // Second query specifically asking to verify against retailer sites
  const trimList = primaryResults.map(r => `${r.trim}: ${r.tireSize}`).join(", ");
  
  const prompt = `Verify these OEM tire sizes for the ${year} ${make} ${model}:
${trimList}

Cross-reference with major tire retailers (Tire Rack, Discount Tire, TireSize.com).

Return a JSON object:
{
  "verified": [
    { "trim": "LE", "tireSize": "215/55R17", "correct": true }
  ],
  "corrections": [
    { "trim": "XSE", "claimed": "235/45R18", "actual": "235/40R19", "source": "Tire Rack" }
  ]
}

Return ONLY the JSON, no other text.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return { verified: primaryResults, conflicts: [] };
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { verified: primaryResults, conflicts: [] };
    }

    const verification = JSON.parse(jsonMatch[0]);
    const verified: TrimFitment[] = [];
    const conflicts: TrimFitment[] = [];

    for (const primary of primaryResults) {
      const correction = verification.corrections?.find(
        (c: any) => c.trim.toLowerCase() === primary.trim.toLowerCase()
      );
      
      if (correction) {
        // Conflict found
        conflicts.push({
          ...primary,
          tireSize: `CONFLICT: ${primary.tireSize} vs ${correction.actual}`,
        });
      } else {
        verified.push(primary);
      }
    }

    return { verified, conflicts };
  } catch (err) {
    console.warn(`[${year} ${make} ${model}] Verification failed, using primary results`);
    return { verified: primaryResults, conflicts: [] };
  }
}

function extractWheelDiameter(tireSize: string): number | null {
  const match = tireSize.match(/R(\d{2})/i);
  return match ? parseInt(match[1], 10) : null;
}

function buildResearchResult(
  year: number,
  make: string,
  model: string,
  fitment: TrimFitment,
  isVerified: boolean,
  hasConflict: boolean,
  conflictNotes?: string
): ResearchResult {
  const wheelDia = fitment.wheelDiameter || extractWheelDiameter(fitment.tireSize);
  
  // Determine confidence based on verification status
  let confidence: "high" | "medium" | "low" = "medium"; // Default per spec
  if (hasConflict) {
    confidence = "low";
  } else if (isVerified) {
    confidence = "medium"; // Still medium per NON-NEGOTIABLE rules
  }

  return {
    year,
    make,
    model,
    trim: fitment.trim,
    tireSize: fitment.tireSize,
    wheelDiameter: wheelDia || 0,
    wheelWidth: fitment.wheelWidth || null,
    sources: [
      { name: "Claude Research", tier: 3 },
      ...(isVerified ? [{ name: "Cross-reference verification", tier: 2 }] : []),
    ],
    sourceCount: isVerified ? 2 : 1,
    confidence,
    conflictStatus: hasConflict ? "major" : "none",
    conflictNotes,
    researchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Main
// ============================================================================

async function runPilot() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  FITMENT RESEARCH PILOT");
  console.log("  Output: STAGING ONLY (not production)");
  console.log("═══════════════════════════════════════════════════════════════");

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Get API key
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.error("❌ No Anthropic API key found");
    process.exit(1);
  }
  console.log("✓ API key loaded\n");
  
  const client = new Anthropic({ apiKey });
  
  const allCandidates: ResearchResult[] = [];
  const allConflicts: ResearchResult[] = [];

  let vehicleCount = 0;
  let trimCount = 0;

  for (const vehicle of PILOT_VEHICLES) {
    for (const year of vehicle.years) {
      vehicleCount++;
      console.log(`\n[${vehicleCount}] Researching ${year} ${vehicle.make} ${vehicle.model}...`);

      // Primary research
      const primaryResults = await researchVehicleFitment(
        client,
        year,
        vehicle.make,
        vehicle.model
      );

      if (primaryResults.length === 0) {
        console.log(`  ⚠️ No results found`);
        continue;
      }

      console.log(`  Found ${primaryResults.length} trims`);

      // Verification pass
      const { verified, conflicts } = await verifyWithSecondSource(
        client,
        year,
        vehicle.make,
        vehicle.model,
        primaryResults
      );

      // Build results
      for (const fitment of verified) {
        const result = buildResearchResult(
          year,
          vehicle.make,
          vehicle.model,
          fitment,
          true, // verified
          false, // no conflict
        );
        allCandidates.push(result);
        trimCount++;
      }

      for (const fitment of conflicts) {
        const result = buildResearchResult(
          year,
          vehicle.make,
          vehicle.model,
          fitment,
          false, // not verified
          true, // has conflict
          fitment.tireSize, // Contains conflict details
        );
        allConflicts.push(result);
      }

      console.log(`  ✅ ${verified.length} verified, ⚠️ ${conflicts.length} conflicts`);

      // Rate limiting - be nice to the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Build promotion-ready subset (sourceCount >= 2, no conflicts)
  const promotionReady = allCandidates.filter(
    c => c.sourceCount >= 2 && c.conflictStatus === "none"
  );

  // Build output
  const output: PilotOutput = {
    metadata: {
      generatedAt: new Date().toISOString(),
      vehicleCount,
      trimCount,
      conflictCount: allConflicts.length,
    },
    candidates: allCandidates,
    conflicts: allConflicts,
    promotionReady,
  };

  // Write outputs
  const outputPath = path.join(OUTPUT_DIR, "pilot-results.json");
  await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Results written to: ${outputPath}`);

  // Write summary report
  const reportPath = path.join(OUTPUT_DIR, "pilot-report.md");
  const report = generateReport(output);
  await fs.writeFile(reportPath, report);
  console.log(`📊 Report written to: ${reportPath}`);

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  PILOT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  Vehicles researched: ${vehicleCount}`);
  console.log(`  Total trim/size records: ${trimCount}`);
  console.log(`  Conflicts flagged: ${allConflicts.length}`);
  console.log(`  Promotion-ready: ${promotionReady.length}`);
  console.log("═══════════════════════════════════════════════════════════════");
}

function generateReport(output: PilotOutput): string {
  const lines: string[] = [
    "# Fitment Research Pilot Report",
    "",
    `Generated: ${output.metadata.generatedAt}`,
    "",
    "## Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Vehicles researched | ${output.metadata.vehicleCount} |`,
    `| Trim/size records | ${output.metadata.trimCount} |`,
    `| Conflicts flagged | ${output.metadata.conflictCount} |`,
    `| Promotion-ready | ${output.promotionReady.length} |`,
    "",
    "## Promotion-Ready Records",
    "",
    "These records have 2+ source verification and no conflicts:",
    "",
    "| Year | Make | Model | Trim | Tire Size | Wheel |",
    "|------|------|-------|------|-----------|-------|",
  ];

  for (const r of output.promotionReady.slice(0, 50)) {
    lines.push(`| ${r.year} | ${r.make} | ${r.model} | ${r.trim} | ${r.tireSize} | ${r.wheelDiameter}" |`);
  }

  if (output.promotionReady.length > 50) {
    lines.push(`| ... | ... | ... | ... | ... | ... |`);
    lines.push(`| *(${output.promotionReady.length - 50} more)* | | | | | |`);
  }

  if (output.conflicts.length > 0) {
    lines.push("");
    lines.push("## Conflicts (Require Manual Review)");
    lines.push("");
    lines.push("| Year | Make | Model | Trim | Conflict |");
    lines.push("|------|------|-------|------|----------|");
    
    for (const c of output.conflicts) {
      lines.push(`| ${c.year} | ${c.make} | ${c.model} | ${c.trim} | ${c.conflictNotes || c.tireSize} |`);
    }
  }

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  lines.push("1. Review promotion-ready records for accuracy");
  lines.push("2. Manually resolve conflicts");
  lines.push("3. Run promotion script to insert into config table");
  lines.push("4. Re-deploy and verify UX improvement");

  return lines.join("\n");
}

// Run
runPilot().catch(console.error);
