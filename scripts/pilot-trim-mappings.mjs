/**
 * Pilot: Create trim mappings for 5 test vehicles
 * Uses existing DB data - NO Wheel-Size API calls
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

const PILOT_VEHICLES = [
  { year: 2024, make: "Ram", model: "1500", trim: "Big Horn" },
  { year: 2024, make: "Ford", model: "F-150", trim: "XLT" },
  { year: 2024, make: "Chevrolet", model: "Silverado 1500", trim: "LT" },
  { year: 2024, make: "GMC", model: "Sierra 1500", trim: "Elevation" },
  { year: 2024, make: "Toyota", model: "Tacoma", trim: "SR5" },
];

async function createMappingsFromDB() {
  const client = await pool.connect();
  const results = [];
  
  try {
    for (const v of PILOT_VEHICLES) {
      console.log(`\n=== Processing ${v.year} ${v.make} ${v.model} ${v.trim} ===`);
      
      // 1. Find the vehicle fitment in our DB
      const fitmentQuery = `
        SELECT 
          vf.id,
          vf.year,
          vf.make,
          vf.model,
          vf.display_trim as trim,
          vf.modification_id,
          vf.bolt_pattern,
          vf.center_bore_mm as center_bore,
          vf.source,
          vf.oem_tire_sizes as tire_sizes_json,
          vf.oem_wheel_sizes as wheel_sizes_json
        FROM vehicle_fitments vf
        WHERE vf.year = $1 
          AND vf.make ILIKE $2 
          AND vf.model ILIKE $3 
          AND vf.display_trim ILIKE $4
        LIMIT 1
      `;
      
      const fitmentResult = await client.query(fitmentQuery, [v.year, v.make, v.model, v.trim]);
      
      if (fitmentResult.rows.length === 0) {
        console.log(`  ❌ No fitment found in DB`);
        results.push({
          vehicle: `${v.year} ${v.make} ${v.model} ${v.trim}`,
          status: "not_found",
          calls_used: 0,
          cache: "N/A",
          mapping_created: false,
        });
        continue;
      }
      
      const fitment = fitmentResult.rows[0];
      
      // Parse OEM data from JSON columns
      const tireSizes = Array.isArray(fitment.tire_sizes_json) 
        ? fitment.tire_sizes_json 
        : [];
      const wheelSizes = Array.isArray(fitment.wheel_sizes_json)
        ? fitment.wheel_sizes_json
        : [];
      
      // Extract diameters from wheel sizes (format like "8.5Jx18" or {diameter: 18, width: 8.5})
      const extractedDiameters = wheelSizes.map(ws => {
        if (typeof ws === 'object' && ws.diameter) return ws.diameter;
        if (typeof ws === 'string') {
          const match = ws.match(/x(\d+)/);
          return match ? parseInt(match[1]) : null;
        }
        return null;
      }).filter(d => d);
      
      // Also extract from tire sizes (format like "275/65R18")
      const tireDiameters = tireSizes.map(ts => {
        if (typeof ts === 'string') {
          const match = ts.match(/R(\d+)/i);
          return match ? parseInt(match[1]) : null;
        }
        return null;
      }).filter(d => d);
      
      const allDiameters = [...new Set([...extractedDiameters, ...tireDiameters])].sort((a,b) => a - b);
      
      console.log(`  ✓ Found fitment: ${fitment.modification_id}`);
      console.log(`    Tire sizes: ${tireSizes.join(", ") || "none"}`);
      console.log(`    Wheel sizes: ${JSON.stringify(wheelSizes)}`);
      console.log(`    Diameters: ${allDiameters.join(", ") || "none"}`);
      
      // 2. Determine if this needs size chooser
      const uniqueDiameters = allDiameters;
      const configCount = tireSizes.length || 1;
      const hasSingleConfig = uniqueDiameters.length === 1;
      const showSizeChooser = uniqueDiameters.length > 1;
      
      console.log(`    Show size chooser: ${showSizeChooser}`);
      console.log(`    Has single config: ${hasSingleConfig}`);
      
      // 3. Check if mapping already exists
      const existingQuery = `
        SELECT id FROM wheel_size_trim_mappings
        WHERE year = $1 AND make = $2 AND model = $3 AND our_trim = $4
      `;
      const existing = await client.query(existingQuery, [v.year, v.make, v.model, v.trim]);
      
      if (existing.rows.length > 0) {
        console.log(`  ⚠️ Mapping already exists: ${existing.rows[0].id}`);
        results.push({
          vehicle: `${v.year} ${v.make} ${v.model} ${v.trim}`,
          status: "exists",
          calls_used: 0,
          cache: "N/A",
          mapping_created: false,
          existing_id: existing.rows[0].id,
        });
        continue;
      }
      
      // 4. Create the mapping (status=pending, needs_review=true)
      const insertQuery = `
        INSERT INTO wheel_size_trim_mappings (
          year, make, model, our_trim, our_modification_id, vehicle_fitment_id,
          ws_slug, ws_modification_name,
          match_method, match_confidence, match_score,
          config_count, has_single_config,
          default_wheel_diameter, default_tire_size,
          all_wheel_diameters, all_tire_sizes,
          needs_review, review_reason, review_priority,
          status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8,
          $9, $10, $11,
          $12, $13,
          $14, $15,
          $16, $17,
          $18, $19, $20,
          $21, NOW(), NOW()
        )
        RETURNING id
      `;
      
      const defaultDiameter = uniqueDiameters.length === 1 ? uniqueDiameters[0] : null;
      const defaultTireSize = hasSingleConfig && tireSizes.length === 1 
        ? tireSizes[0] 
        : null;
      
      const insertResult = await client.query(insertQuery, [
        v.year,                           // year
        v.make,                           // make
        v.model,                          // model
        v.trim,                           // our_trim
        fitment.modification_id,          // our_modification_id
        fitment.id,                       // vehicle_fitment_id
        fitment.modification_id,          // ws_slug (using our modification_id as placeholder)
        `${v.year} ${v.make} ${v.model} ${v.trim}`, // ws_modification_name
        "db_import",                      // match_method
        hasSingleConfig ? "high" : "medium", // match_confidence
        1.0,                              // match_score
        configCount,                      // config_count
        hasSingleConfig,                  // has_single_config
        defaultDiameter,                  // default_wheel_diameter
        defaultTireSize,                  // default_tire_size
        uniqueDiameters,                  // all_wheel_diameters
        tireSizes,                        // all_tire_sizes
        true,                             // needs_review (ALWAYS true for pilot)
        "Pilot import - requires admin review", // review_reason
        1,                                // review_priority
        "pending",                        // status (NOT auto-approved)
      ]);
      
      console.log(`  ✅ Created mapping: ${insertResult.rows[0].id}`);
      
      results.push({
        vehicle: `${v.year} ${v.make} ${v.model} ${v.trim}`,
        status: "created",
        calls_used: 0, // No WS API calls!
        cache: "db_only",
        mapping_created: true,
        mapping_id: insertResult.rows[0].id,
        confidence: hasSingleConfig ? "high" : "medium",
        showSizeChooser,
        autoSelectedConfig: defaultDiameter ? { diameter: defaultDiameter, tireSize: defaultTireSize } : null,
        warnings: showSizeChooser ? ["Multiple OEM diameters - chooser required"] : [],
        config_count: configCount,
        diameters: uniqueDiameters,
      });
    }
    
    return results;
    
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
createMappingsFromDB()
  .then(results => {
    console.log("\n\n========================================");
    console.log("PILOT RESULTS SUMMARY");
    console.log("========================================\n");
    
    console.log("| Vehicle | Calls Used | Cache | Mapping Created | Confidence | showSizeChooser | autoSelectedConfig | Warnings |");
    console.log("|---------|------------|-------|-----------------|------------|-----------------|--------------------|---------:|");
    
    for (const r of results) {
      const warnings = r.warnings?.length ? r.warnings.join("; ") : "-";
      const autoConfig = r.autoSelectedConfig 
        ? `${r.autoSelectedConfig.diameter}" / ${r.autoSelectedConfig.tireSize || "any"}` 
        : "-";
      
      console.log(`| ${r.vehicle} | ${r.calls_used} | ${r.cache} | ${r.mapping_created ? "✅" : "❌"} | ${r.confidence || "-"} | ${r.showSizeChooser ?? "-"} | ${autoConfig} | ${warnings} |`);
    }
    
    console.log("\n========================================");
    console.log("Recommended Actions:");
    console.log("========================================");
    
    for (const r of results) {
      if (r.mapping_created) {
        if (r.showSizeChooser) {
          console.log(`• ${r.vehicle}: REVIEW - has ${r.diameters?.length} OEM diameters, chooser is correct`);
        } else {
          console.log(`• ${r.vehicle}: APPROVE - single config, auto-select enabled`);
        }
      } else if (r.status === "exists") {
        console.log(`• ${r.vehicle}: SKIP - mapping already exists`);
      } else {
        console.log(`• ${r.vehicle}: INVESTIGATE - no fitment found`);
      }
    }
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
