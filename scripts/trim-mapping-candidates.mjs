/**
 * Trim Mapping Candidate Report
 * 
 * Identifies high-value vehicles where trim mappings would improve customer flow.
 * NO API CALLS. NO MAPPING CREATION. Analysis only.
 */

import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

async function generateCandidateReport() {
  const client = await pool.connect();
  
  try {
    console.log("=".repeat(80));
    console.log("TRIM MAPPING CANDIDATE REPORT");
    console.log("Generated:", new Date().toISOString());
    console.log("=".repeat(80));
    console.log("");
    
    // =========================================================================
    // Query: Get all fitments with tire size data
    // =========================================================================
    
    const query = `
      SELECT 
        vf.id,
        vf.year,
        vf.make,
        vf.model,
        vf.display_trim as trim,
        vf.modification_id,
        vf.source,
        vf.oem_tire_sizes,
        vf.oem_wheel_sizes,
        EXISTS (
          SELECT 1 FROM wheel_size_trim_mappings wstm 
          WHERE wstm.year = vf.year 
            AND wstm.make = vf.make 
            AND wstm.model = vf.model 
            AND wstm.our_trim = vf.display_trim
        ) as already_mapped
      FROM vehicle_fitments vf
      WHERE vf.year >= 2020
        AND vf.oem_tire_sizes IS NOT NULL
      ORDER BY vf.year DESC, vf.make, vf.model, vf.display_trim
    `;
    
    console.log("Querying vehicle fitments...");
    const result = await client.query(query);
    console.log(`Found ${result.rows.length} fitments with tire data`);
    
    // =========================================================================
    // Analyze each fitment
    // =========================================================================
    
    const candidates = [];
    
    for (const row of result.rows) {
      if (row.already_mapped) continue;
      
      // Parse tire sizes
      let tireSizes = [];
      try {
        if (Array.isArray(row.oem_tire_sizes)) {
          tireSizes = row.oem_tire_sizes;
        } else if (typeof row.oem_tire_sizes === 'string') {
          tireSizes = JSON.parse(row.oem_tire_sizes);
        }
      } catch (e) {
        continue;
      }
      
      if (!Array.isArray(tireSizes) || tireSizes.length === 0) continue;
      
      // Extract diameters
      const diameters = [...new Set(tireSizes.map(s => {
        const match = String(s).match(/R(\d+)/i);
        return match ? parseInt(match[1]) : null;
      }).filter(Boolean))].sort((a,b) => a - b);
      
      if (diameters.length === 0) continue;
      
      // Determine characteristics
      const isMultiDiameter = diameters.length > 1;
      const isGrouped = row.source?.toLowerCase().includes('grouped') || 
                        row.source?.toLowerCase().includes('fallback') ||
                        row.modification_id?.toLowerCase().includes('manual_');
      const hasSingleDefault = diameters.length === 1;
      
      // Prioritize
      let priority = 'low';
      let reason = '';
      
      if (isMultiDiameter) {
        priority = diameters.length > 2 ? 'high' : 'medium';
        reason = `${diameters.length} wheel diameters (${diameters.join('", "')}") - customer sees chooser`;
      } else if (isGrouped) {
        priority = 'high';
        reason = `Grouped/fallback source (${row.source}) - may have ambiguous fitment`;
      } else {
        continue; // Skip single-config non-grouped
      }
      
      candidates.push({
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.trim || '(no trim)',
        tireSizes,
        diameters,
        source: row.source,
        isGrouped,
        hasSingleDefault,
        priority,
        reason,
      });
    }
    
    // Sort by priority
    candidates.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.year - a.year;
    });
    
    // =========================================================================
    // Output Report
    // =========================================================================
    
    const top50 = candidates.slice(0, 50);
    
    console.log("\n");
    console.log("=".repeat(80));
    console.log("TOP 50 TRIM MAPPING CANDIDATES");
    console.log("=".repeat(80));
    console.log("");
    
    console.log("| # | Year | Make | Model | Trim | Configs | Diameters | Grouped? | Single? | Priority |");
    console.log("|---|------|------|-------|------|---------|-----------|----------|---------|----------|");
    
    top50.forEach((c, i) => {
      const grouped = c.isGrouped ? "YES" : "no";
      const single = c.hasSingleDefault ? "YES" : "no";
      const dias = c.diameters.join('/');
      console.log(`| ${(i+1).toString().padStart(2)} | ${c.year} | ${c.make.substring(0,10).padEnd(10)} | ${c.model.substring(0,12).padEnd(12)} | ${(c.trim || '-').substring(0,15).padEnd(15)} | ${c.tireSizes.length} | ${dias.padEnd(9)} | ${grouped.padEnd(8)} | ${single.padEnd(7)} | ${c.priority.padEnd(8)} |`);
    });
    
    console.log("");
    console.log("=".repeat(80));
    console.log("DETAILED ANALYSIS - TOP 20");
    console.log("=".repeat(80));
    
    top50.slice(0, 20).forEach((c, i) => {
      console.log("");
      console.log(`${i+1}. ${c.year} ${c.make} ${c.model} ${c.trim}`);
      console.log(`   Tire Sizes: ${c.tireSizes.join(', ')}`);
      console.log(`   Diameters: ${c.diameters.join('", "')}`);
      console.log(`   Source: ${c.source}`);
      console.log(`   Grouped/Fallback: ${c.isGrouped ? 'YES' : 'no'}`);
      console.log(`   Single Default Available: ${c.hasSingleDefault ? 'YES' : 'no'}`);
      console.log(`   Priority: ${c.priority.toUpperCase()}`);
      console.log(`   Reason: ${c.reason}`);
      console.log(`   Recommendation: ${c.hasSingleDefault ? 'Create mapping with auto-select' : 'Review - may need chooser OR verify OEM options'}`);
    });
    
    // =========================================================================
    // Summary Statistics
    // =========================================================================
    
    console.log("\n");
    console.log("=".repeat(80));
    console.log("SUMMARY STATISTICS");
    console.log("=".repeat(80));
    console.log("");
    console.log(`Total unmapped candidates: ${candidates.length}`);
    console.log(`  High priority: ${candidates.filter(c => c.priority === 'high').length}`);
    console.log(`  Medium priority: ${candidates.filter(c => c.priority === 'medium').length}`);
    console.log(`  Low priority: ${candidates.filter(c => c.priority === 'low').length}`);
    console.log("");
    console.log(`Multi-diameter vehicles: ${candidates.filter(c => c.diameters.length > 1).length}`);
    console.log(`Grouped/fallback vehicles: ${candidates.filter(c => c.isGrouped).length}`);
    console.log(`Single default identifiable: ${candidates.filter(c => c.hasSingleDefault).length}`);
    console.log("");
    
    // By make
    const makeCount = {};
    candidates.forEach(c => {
      makeCount[c.make] = (makeCount[c.make] || 0) + 1;
    });
    console.log("Top Makes:");
    Object.entries(makeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([make, count]) => {
        console.log(`  ${make}: ${count}`);
      });
    
    console.log("\n");
    console.log("=".repeat(80));
    console.log("REPORT COMPLETE - NO API CALLS MADE");
    console.log("=".repeat(80));
    
    return { total: candidates.length, top50 };
    
  } finally {
    client.release();
    await pool.end();
  }
}

generateCandidateReport()
  .then(() => console.log("\nDone."))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
