/**
 * Toyo UTQG Scraper
 * 
 * Fetches UTQG data from Toyo's official website for patterns missing data.
 * Source: toyotires.com
 * 
 * Usage: node scripts/tire-enrichment/scrape-toyo-utqg.mjs [--dry-run] [--limit N]
 */

import pg from "pg";
import fs from "fs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitArg = args.find(a => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : 10;

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const pool = new pg.Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// Toyo tire catalog URL patterns
const TOYO_BASE_URL = "https://www.toyotires.com";
const TOYO_API_URL = "https://www.toyotires.com/api";

// Map our pattern names to Toyo's URL slugs
const PATTERN_SLUG_MAP = {
  "Open Country A/T III": "open-country-at3",
  "Open Country M/T": "open-country-mt",
  "Open Country R/T": "open-country-rt",
  "Open Country R/T Trail": "open-country-rt-trail",
  "Open Country A/T II": "open-country-at2",
  "Proxes Sport A/S": "proxes-sport-as",
  "Proxes Sport": "proxes-sport",
  "Celsius": "celsius",
  "Celsius CUV": "celsius-cuv",
  "Celsius Sport": "celsius-sport",
  "Extensa HP II": "extensa-hp-ii",
  "Extensa A/S II": "extensa-as-ii",
  "Versado Noir": "versado-noir",
  "Observe GSi-6": "observe-gsi-6",
  "Observe GSi-6 HP": "observe-gsi-6-hp",
};

/**
 * Fetch UTQG data from Toyo's website
 */
async function fetchToyoUtqg(patternName) {
  // Try to find the slug
  let slug = PATTERN_SLUG_MAP[patternName];
  
  if (!slug) {
    // Try to auto-generate slug
    slug = patternName
      .toLowerCase()
      .replace(/\//g, "-")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }
  
  const url = `${TOYO_BASE_URL}/tires/${slug}`;
  console.log(`  Fetching: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    
    if (!response.ok) {
      console.log(`  ❌ HTTP ${response.status}`);
      return null;
    }
    
    const html = await response.text();
    
    // Look for UTQG pattern in the HTML
    // Toyo typically shows: "UTQG: 500 A A" or "Treadwear: 500 Traction: A Temperature: A"
    
    // Pattern 1: "UTQG: 500 A A"
    const utqgMatch = html.match(/UTQG[:\s]*(\d{2,3})\s*([ABC]{1,2})\s*([ABC])/i);
    if (utqgMatch) {
      return {
        utqg: `${utqgMatch[1]} ${utqgMatch[2]} ${utqgMatch[3]}`,
        treadwear: parseInt(utqgMatch[1]),
        traction: utqgMatch[2].toUpperCase(),
        temperature: utqgMatch[3].toUpperCase(),
      };
    }
    
    // Pattern 2: Separate fields
    const treadwearMatch = html.match(/Treadwear[:\s]*(\d{2,3})/i);
    const tractionMatch = html.match(/Traction[:\s]*([ABC]{1,2})/i);
    const tempMatch = html.match(/Temperature[:\s]*([ABC])/i);
    
    if (treadwearMatch) {
      const treadwear = parseInt(treadwearMatch[1]);
      const traction = tractionMatch ? tractionMatch[1].toUpperCase() : null;
      const temp = tempMatch ? tempMatch[1].toUpperCase() : null;
      
      return {
        utqg: [treadwear, traction, temp].filter(Boolean).join(" "),
        treadwear,
        traction,
        temperature: temp,
      };
    }
    
    // Pattern 3: JSON-LD data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const jsonStr = match.replace(/<script[^>]*>|<\/script>/gi, "");
          const data = JSON.parse(jsonStr);
          // Check for tire spec data
          if (data.utqg || data.treadwear) {
            return {
              utqg: data.utqg,
              treadwear: data.treadwear,
              traction: data.traction,
              temperature: data.temperature,
            };
          }
        } catch {}
      }
    }
    
    console.log("  ⚠️ No UTQG data found on page");
    return null;
    
  } catch (error) {
    console.log(`  ❌ Fetch error: ${error.message}`);
    return null;
  }
}

/**
 * Alternative: Try to get data from WheelPros raw JSON
 */
async function getFromWheelPros(patternName) {
  const query = `
    SELECT 
      raw->>'treadwear' as treadwear,
      raw->>'traction' as traction,
      raw->>'temperature' as temperature,
      raw->>'utqg' as utqg
    FROM wp_tires
    WHERE brand_desc ILIKE '%Toyo%'
      AND tire_description ILIKE $1
      AND (raw->>'treadwear' IS NOT NULL OR raw->>'utqg' IS NOT NULL)
    LIMIT 1
  `;
  
  const result = await pool.query(query, [`%${patternName}%`]);
  
  if (result.rows[0]) {
    const r = result.rows[0];
    if (r.treadwear || r.utqg) {
      return {
        utqg: r.utqg || [r.treadwear, r.traction, r.temperature].filter(Boolean).join(" "),
        treadwear: r.treadwear ? parseInt(r.treadwear) : null,
        traction: r.traction,
        temperature: r.temperature,
        source: "wheelpros",
      };
    }
  }
  return null;
}

async function main() {
  console.log("🔍 Toyo UTQG Scraper");
  console.log(`   Mode: ${dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`   Limit: ${limit} patterns\n`);

  // Get Toyo patterns missing UTQG
  const missingQuery = `
    SELECT id, brand, pattern_name, pattern_key, sample_sku
    FROM tire_pattern_specs
    WHERE brand = 'Toyo'
      AND (utqg IS NULL OR utqg = '')
    ORDER BY sample_count DESC NULLS LAST
    LIMIT $1
  `;
  
  const missing = await pool.query(missingQuery, [limit]);
  console.log(`Found ${missing.rows.length} Toyo patterns missing UTQG\n`);

  const results = [];
  let updated = 0;
  let skipped = 0;

  for (const row of missing.rows) {
    console.log(`\n📦 ${row.pattern_name || row.pattern_key}`);
    
    // First, try WheelPros data
    let data = await getFromWheelPros(row.pattern_name || row.pattern_key);
    
    if (data) {
      console.log(`  ✅ Found in WheelPros: ${data.utqg}`);
    } else {
      // Fall back to scraping
      console.log("  Not in WheelPros, trying website...");
      data = await fetchToyoUtqg(row.pattern_name || row.pattern_key);
      if (data) {
        data.source = "toyo_website";
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 1500));
    }
    
    if (data) {
      results.push({
        id: row.id,
        pattern: row.pattern_name || row.pattern_key,
        ...data,
      });
      
      if (!dryRun && data.utqg) {
        // Update database
        await pool.query(`
          UPDATE tire_pattern_specs
          SET utqg = $1,
              treadwear = $2,
              traction = $3,
              temperature = $4,
              source = COALESCE(source, '') || ' utqg:${data.source || "scraped"}',
              updated_at = NOW()
          WHERE id = $5
        `, [data.utqg, data.treadwear, data.traction, data.temperature, row.id]);
        
        updated++;
        console.log(`  💾 Updated in database`);
      } else if (dryRun) {
        console.log(`  [DRY RUN] Would update: ${data.utqg}`);
      }
    } else {
      skipped++;
      console.log(`  ⏭️ Skipped - no data found`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("                       SUMMARY                              ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`Processed: ${missing.rows.length} patterns`);
  console.log(`Updated:   ${updated}`);
  console.log(`Skipped:   ${skipped}`);
  
  // Save results
  fs.writeFileSync(
    "scripts/tire-enrichment/toyo-utqg-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("\n✅ Results saved to scripts/tire-enrichment/toyo-utqg-results.json");

  await pool.end();
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
