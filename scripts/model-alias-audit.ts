/**
 * Model Alias Audit
 * 
 * Comprehensive audit of model name resolution:
 * 1. Current alias rules
 * 2. DB model names that need aliasing
 * 3. Normalization collisions
 * 4. Unresolved alias candidates
 * 
 * Run: npx tsx scripts/model-alias-audit.ts
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../src/lib/fitment-db/db";
import { sql } from "drizzle-orm";
import { normalizeModel, normalizeMake } from "../src/lib/fitment-db/keys";
import * as fs from "fs";

// ============================================================================
// Current Alias Rules (from coverage.ts and profileService.ts)
// ============================================================================

const CURRENT_ALIASES: Record<string, string[]> = {
  // Ford Super Duty trucks
  "f-250": ["f-250-super-duty"],
  "f-350": ["f-350-super-duty"],
  "f-450": ["f-450-super-duty"],
  
  // Chrysler 300 variants
  "300": ["300c", "300s", "300m"],
  "300c": ["300"],
  
  // Common alternate namings
  "silverado": ["silverado-1500"],
  "sierra": ["sierra-1500"],
  "ram": ["ram-1500"],
};

// ============================================================================
// Audit Functions
// ============================================================================

interface ModelInfo {
  make: string;
  model: string;
  normalizedModel: string;
  recordCount: number;
  years: number[];
}

interface NormalizationCollision {
  normalizedName: string;
  dbModels: string[];
  makes: string[];
}

interface AliasSuggestion {
  shortForm: string;
  fullForm: string;
  make: string;
  reason: string;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  MODEL ALIAS AUDIT");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ──────────────────────────────────────────────────────────────────────────
  // PART 1: List all current alias rules
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 1: CURRENT ALIAS RULES");
  console.log("─".repeat(60));
  for (const [shortForm, aliases] of Object.entries(CURRENT_ALIASES)) {
    console.log(`  ${shortForm} → ${aliases.join(", ")}`);
  }
  console.log();

  // ──────────────────────────────────────────────────────────────────────────
  // PART 2: Get all unique models from database
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 2: DATABASE MODEL INVENTORY");
  console.log("─".repeat(60));
  
  const dbModels = await db.execute(sql`
    SELECT 
      make,
      model,
      COUNT(*) as record_count,
      array_agg(DISTINCT year ORDER BY year) as years
    FROM vehicle_fitments
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  const models: ModelInfo[] = (dbModels.rows as any[]).map(r => ({
    make: r.make,
    model: r.model,
    normalizedModel: normalizeModel(r.model),
    recordCount: parseInt(r.record_count),
    years: r.years,
  }));
  
  console.log(`  Total unique make/model combinations: ${models.length}`);
  console.log();

  // ──────────────────────────────────────────────────────────────────────────
  // PART 3: Find normalization collisions
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 3: NORMALIZATION COLLISIONS");
  console.log("─".repeat(60));
  console.log("  Models that normalize to the same name (potential data loss):\n");
  
  // Group by normalized name
  const byNormalized = new Map<string, ModelInfo[]>();
  for (const m of models) {
    const key = `${m.make}:${m.normalizedModel}`;
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key)!.push(m);
  }
  
  const collisions: NormalizationCollision[] = [];
  for (const [key, group] of byNormalized) {
    if (group.length > 1) {
      const [make, normalized] = key.split(":");
      collisions.push({
        normalizedName: normalized,
        dbModels: group.map(g => g.model),
        makes: [make],
      });
    }
  }
  
  if (collisions.length === 0) {
    console.log("  ✅ No normalization collisions found within same make\n");
  } else {
    for (const c of collisions) {
      console.log(`  ⚠️  ${c.makes[0]} "${c.normalizedName}" normalizes:`);
      for (const m of c.dbModels) {
        const info = models.find(x => x.model === m && c.makes.includes(x.make));
        console.log(`      • "${m}" (${info?.recordCount} records)`);
      }
      console.log();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PART 4: Check if aliases are needed for DB models
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 4: ALIAS COVERAGE CHECK");
  console.log("─".repeat(60));
  console.log("  Checking if DB models are reachable via their short form:\n");
  
  // Patterns that suggest a short form might be used in URLs
  const shortFormPatterns = [
    { pattern: /-super-duty$/, shortForm: (m: string) => m.replace(/-super-duty$/, "") },
    { pattern: /-1500$/, shortForm: (m: string) => m.replace(/-1500$/, "") },
    { pattern: /-2500$/, shortForm: (m: string) => m.replace(/-2500$/, "") },
    { pattern: /-3500$/, shortForm: (m: string) => m.replace(/-3500$/, "") },
    { pattern: /-hd$/, shortForm: (m: string) => m.replace(/-hd$/, "") },
    { pattern: /c$/, shortForm: (m: string) => m.replace(/c$/, ""), onlyIf: (m: string) => /^\d+c$/.test(m) },
  ];
  
  const needsAlias: AliasSuggestion[] = [];
  const hasAlias: { model: string; make: string; alias: string }[] = [];
  
  for (const m of models) {
    // Check if this model might have a short form
    for (const p of shortFormPatterns) {
      if (p.pattern.test(m.model)) {
        if (p.onlyIf && !p.onlyIf(m.model)) continue;
        
        const shortForm = p.shortForm(m.model);
        
        // Check if alias exists
        const aliasExists = CURRENT_ALIASES[shortForm]?.includes(m.model);
        
        if (aliasExists) {
          hasAlias.push({ model: m.model, make: m.make, alias: shortForm });
        } else {
          // Check if short form exists as a separate model
          const shortFormExists = models.some(x => x.make === m.make && x.model === shortForm);
          
          needsAlias.push({
            shortForm,
            fullForm: m.model,
            make: m.make,
            reason: shortFormExists 
              ? `Both "${shortForm}" and "${m.model}" exist - users might search for either`
              : `Users might search for "${shortForm}" but only "${m.model}" exists`,
          });
        }
      }
    }
  }
  
  console.log("  CURRENTLY COVERED BY ALIASES:");
  for (const h of hasAlias) {
    console.log(`    ✅ ${h.make} ${h.alias} → ${h.model}`);
  }
  console.log();
  
  console.log("  POTENTIALLY NEEDS ALIAS:");
  for (const n of needsAlias) {
    console.log(`    ⚠️  ${n.make} ${n.shortForm} → ${n.fullForm}`);
    console.log(`       Reason: ${n.reason}`);
  }
  console.log();

  // ──────────────────────────────────────────────────────────────────────────
  // PART 5: Check for models that normalize to something different
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 5: NORMALIZATION TRANSFORMATIONS");
  console.log("─".repeat(60));
  console.log("  Models where normalizeModel() changes the name:\n");
  
  const transformations: { model: string; normalized: string; make: string }[] = [];
  for (const m of models) {
    if (m.model !== m.normalizedModel) {
      transformations.push({ model: m.model, normalized: m.normalizedModel, make: m.make });
    }
  }
  
  if (transformations.length === 0) {
    console.log("  ✅ No transformations - all model names are already normalized\n");
  } else {
    // Group by transformation type
    const superDutyTransforms = transformations.filter(t => t.model.includes("super-duty") && !t.normalized.includes("super-duty"));
    const otherTransforms = transformations.filter(t => !t.model.includes("super-duty") || t.normalized.includes("super-duty"));
    
    if (superDutyTransforms.length > 0) {
      console.log("  SUPER DUTY NORMALIZATION (keys.ts collapses these):");
      for (const t of superDutyTransforms.slice(0, 10)) {
        console.log(`    ⚠️  ${t.make} "${t.model}" → "${t.normalized}"`);
      }
      if (superDutyTransforms.length > 10) {
        console.log(`    ... and ${superDutyTransforms.length - 10} more`);
      }
      console.log();
    }
    
    if (otherTransforms.length > 0) {
      console.log("  OTHER TRANSFORMATIONS:");
      for (const t of otherTransforms.slice(0, 10)) {
        console.log(`    "${t.model}" → "${t.normalized}"`);
      }
      if (otherTransforms.length > 10) {
        console.log(`    ... and ${otherTransforms.length - 10} more`);
      }
      console.log();
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PART 6: Generate recommendations
  // ──────────────────────────────────────────────────────────────────────────
  console.log("PART 6: RECOMMENDATIONS");
  console.log("─".repeat(60));
  
  const recommendations: string[] = [];
  
  // Check for critical issues
  const criticalCollisions = collisions.filter(c => c.dbModels.length > 1);
  if (criticalCollisions.length > 0) {
    recommendations.push(`CRITICAL: ${criticalCollisions.length} normalization collisions detected - data may be inaccessible`);
  }
  
  if (needsAlias.length > 0) {
    recommendations.push(`ADD ALIASES: ${needsAlias.length} models may need alias rules for URL compatibility`);
  }
  
  // Check Super Duty handling
  const superDutyIssues = transformations.filter(t => t.model.includes("super-duty"));
  if (superDutyIssues.length > 0) {
    recommendations.push(`REVIEW: ${superDutyIssues.length} Super Duty models are collapsed by normalizeModel() - ensure aliases handle this`);
  }
  
  if (recommendations.length === 0) {
    console.log("  ✅ No critical issues found\n");
  } else {
    for (const r of recommendations) {
      console.log(`  • ${r}`);
    }
    console.log();
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Save report
  // ──────────────────────────────────────────────────────────────────────────
  const report = {
    timestamp: new Date().toISOString(),
    currentAliases: CURRENT_ALIASES,
    totalModels: models.length,
    collisions,
    needsAlias,
    hasAlias,
    transformations: transformations.slice(0, 50),
    recommendations,
  };
  
  fs.writeFileSync("scripts/model-alias-audit-report.json", JSON.stringify(report, null, 2));
  console.log("Report saved to: scripts/model-alias-audit-report.json");
  
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
