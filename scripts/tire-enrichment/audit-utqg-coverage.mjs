/**
 * UTQG Coverage Audit
 * 
 * Analyzes UTQG coverage across tire data sources:
 * - tire_pattern_specs (pattern-level specs)
 * - wp_tires (WheelPros inventory)
 * - tireweb_sku_cache (TireWeb SKUs)
 * 
 * Usage: node scripts/tire-enrichment/audit-utqg-coverage.mjs
 */

import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function audit() {
  console.log("🔍 Auditing UTQG coverage across tire data sources...\n");

  // ═══════════════════════════════════════════════════════════════════
  // 1. tire_pattern_specs audit
  // ═══════════════════════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════════════");
  console.log("           tire_pattern_specs (Pattern-Level UTQG)         ");
  console.log("═══════════════════════════════════════════════════════════");

  const patternStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN utqg IS NOT NULL AND utqg != '' THEN 1 END) as has_utqg,
      COUNT(CASE WHEN utqg IS NULL OR utqg = '' THEN 1 END) as missing_utqg
    FROM tire_pattern_specs
  `);
  const ps = patternStats.rows[0];
  console.log(`Total patterns:     ${ps.total}`);
  console.log(`With UTQG:          ${ps.has_utqg} (${(ps.has_utqg / ps.total * 100).toFixed(1)}%)`);
  console.log(`Missing UTQG:       ${ps.missing_utqg} (${(ps.missing_utqg / ps.total * 100).toFixed(1)}%)`);

  // Brand breakdown for patterns
  const patternByBrand = await pool.query(`
    SELECT 
      brand,
      COUNT(*) as total,
      COUNT(CASE WHEN utqg IS NOT NULL AND utqg != '' THEN 1 END) as has_utqg,
      COUNT(CASE WHEN utqg IS NULL OR utqg = '' THEN 1 END) as missing_utqg
    FROM tire_pattern_specs
    GROUP BY brand
    ORDER BY missing_utqg DESC
  `);
  
  console.log("\nBy Brand (patterns missing UTQG):");
  console.log("─────────────────────────────────────────────────────────────");
  for (const r of patternByBrand.rows.filter(x => x.missing_utqg > 0)) {
    console.log(`  ${(r.brand || 'unknown').padEnd(25)} ${r.missing_utqg} missing of ${r.total}`);
  }

  // Show patterns missing UTQG
  const missingPatterns = await pool.query(`
    SELECT brand, pattern_name, pattern_key, sample_sku, sample_count
    FROM tire_pattern_specs
    WHERE utqg IS NULL OR utqg = ''
    ORDER BY sample_count DESC NULLS LAST
    LIMIT 30
  `);
  
  console.log("\nTop 30 Patterns Missing UTQG (by SKU count):");
  console.log("─────────────────────────────────────────────────────────────");
  for (const r of missingPatterns.rows) {
    console.log(`  ${(r.brand || '?').padEnd(15)} ${(r.pattern_name || r.pattern_key || '?').padEnd(30)} (${r.sample_count || '?'} SKUs)`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. wp_tires audit (check raw JSON for UTQG)
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("              wp_tires (WheelPros Inventory)                ");
  console.log("═══════════════════════════════════════════════════════════");

  const wpStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN raw->>'utqg' IS NOT NULL AND raw->>'utqg' != '' THEN 1 END) as has_utqg_raw,
      COUNT(CASE WHEN raw->>'treadwear' IS NOT NULL THEN 1 END) as has_treadwear
    FROM wp_tires
  `);
  const wp = wpStats.rows[0];
  console.log(`Total WP tires:     ${wp.total}`);
  console.log(`With UTQG in raw:   ${wp.has_utqg_raw}`);
  console.log(`With treadwear:     ${wp.has_treadwear}`);

  // Check what fields are in raw JSON
  const sampleWp = await pool.query(`
    SELECT raw FROM wp_tires 
    WHERE raw IS NOT NULL 
    LIMIT 1
  `);
  if (sampleWp.rows[0]?.raw) {
    console.log("\nSample raw JSON keys:", Object.keys(sampleWp.rows[0].raw).slice(0, 20));
  }

  // Brand breakdown for wp_tires
  const wpByBrand = await pool.query(`
    SELECT 
      brand_desc as brand,
      COUNT(*) as total
    FROM wp_tires
    GROUP BY brand_desc
    ORDER BY total DESC
    LIMIT 20
  `);
  
  console.log("\nTop 20 Brands in WheelPros:");
  for (const r of wpByBrand.rows) {
    console.log(`  ${(r.brand || 'unknown').padEnd(25)} ${r.total} tires`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. tireweb_sku_cache audit
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("              tireweb_sku_cache (TireWeb SKUs)              ");
  console.log("═══════════════════════════════════════════════════════════");

  const twStats = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(DISTINCT brand) as brands
    FROM tireweb_sku_cache
  `);
  console.log(`Total SKUs:         ${twStats.rows[0].total}`);
  console.log(`Unique brands:      ${twStats.rows[0].brands}`);

  const twByBrand = await pool.query(`
    SELECT brand, COUNT(*) as cnt
    FROM tireweb_sku_cache
    GROUP BY brand
    ORDER BY cnt DESC
    LIMIT 20
  `);
  
  console.log("\nTop 20 Brands in TireWeb cache:");
  for (const r of twByBrand.rows) {
    console.log(`  ${(r.brand || 'unknown').padEnd(25)} ${r.cnt} SKUs`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Summary & Recommendations
  // ═══════════════════════════════════════════════════════════════════
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                      SUMMARY                               ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Pattern specs coverage: ${ps.has_utqg}/${ps.total} (${(ps.has_utqg / ps.total * 100).toFixed(1)}%)`);
  console.log(`Patterns needing UTQG:  ${ps.missing_utqg}`);
  console.log("");
  console.log("🎯 RECOMMENDATION:");
  console.log("   Focus on enriching the tire_pattern_specs table.");
  console.log("   Each pattern covers multiple SKUs, so fixing 171 patterns");
  console.log("   will improve coverage for thousands of tires.");

  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    patternSpecs: {
      total: Number(ps.total),
      hasUtqg: Number(ps.has_utqg),
      missingUtqg: Number(ps.missing_utqg),
      coveragePercent: (ps.has_utqg / ps.total * 100).toFixed(1),
    },
    wpTires: {
      total: Number(wp.total),
      hasUtqgRaw: Number(wp.has_utqg_raw),
    },
    tireweb: {
      total: Number(twStats.rows[0].total),
      brands: Number(twStats.rows[0].brands),
    },
    missingPatterns: missingPatterns.rows,
    patternsByBrand: patternByBrand.rows,
  };
  
  fs.writeFileSync(
    "scripts/tire-enrichment/utqg-audit-results.json",
    JSON.stringify(output, null, 2)
  );
  console.log("\n✅ Results saved to scripts/tire-enrichment/utqg-audit-results.json");

  await pool.end();
}

audit().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
