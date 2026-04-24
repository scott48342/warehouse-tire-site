/**
 * Generate a prioritized queue of vehicles needing trim-level research
 */
import pg from "pg";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

// Popular US makes (prioritize these)
const PRIORITY_MAKES = [
  'Ford', 'Chevrolet', 'Toyota', 'Honda', 'RAM', 'Jeep', 'GMC', 'Nissan',
  'Hyundai', 'Kia', 'Subaru', 'Dodge', 'Volkswagen', 'Mazda', 'BMW',
  'Mercedes-Benz', 'Audi', 'Lexus', 'Acura', 'Buick', 'Cadillac', 'Chrysler',
  'Lincoln', 'Infiniti', 'Genesis', 'Volvo', 'Land Rover', 'Porsche', 'Tesla'
];

async function generate() {
  const client = await pool.connect();
  
  try {
    console.log('=== GENERATING RESEARCH QUEUE ===\n');
    
    // Get vehicles that need research (Base-only or have grouped trims)
    const needsResearch = await client.query(`
      WITH vehicle_analysis AS (
        SELECT 
          year, make, model,
          array_agg(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_trims,
          array_agg(DISTINCT display_trim) FILTER (WHERE display_trim LIKE '%,%') as grouped_trims,
          bool_or(display_trim LIKE '%,%') as has_grouped,
          COUNT(DISTINCT display_trim) FILTER (WHERE display_trim NOT LIKE '%,%') as individual_count
        FROM vehicle_fitments
        GROUP BY year, make, model
      )
      SELECT year, make, model, individual_trims, grouped_trims, has_grouped, individual_count
      FROM vehicle_analysis
      WHERE (individual_count <= 1 OR has_grouped)
        AND year >= 2015
      ORDER BY year DESC, make, model
    `);
    
    console.log(`Total vehicles needing research: ${needsResearch.rows.length}`);
    
    // Create batches by make for parallel processing
    const batches = {};
    for (const v of needsResearch.rows) {
      const make = v.make;
      if (!batches[make]) batches[make] = [];
      batches[make].push({
        year: v.year,
        make: v.make,
        model: v.model,
        currentTrims: v.individual_trims || [],
        groupedTrims: v.grouped_trims || [],
        needsExpansion: v.has_grouped,
        priority: PRIORITY_MAKES.includes(make) ? 1 : 2
      });
    }
    
    // Write batch files
    const outputDir = 'scripts/trim-research';
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Priority 1: Popular makes (2020+)
    const priority1 = [];
    const priority2 = [];
    const priority3 = [];
    
    for (const [make, vehicles] of Object.entries(batches)) {
      for (const v of vehicles) {
        if (PRIORITY_MAKES.slice(0, 15).includes(make) && v.year >= 2020) {
          priority1.push(v);
        } else if (PRIORITY_MAKES.includes(make) && v.year >= 2018) {
          priority2.push(v);
        } else {
          priority3.push(v);
        }
      }
    }
    
    // Sort each priority by year desc
    priority1.sort((a, b) => b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
    priority2.sort((a, b) => b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
    priority3.sort((a, b) => b.year - a.year || a.make.localeCompare(b.make) || a.model.localeCompare(b.model));
    
    // Write queue files
    fs.writeFileSync(`${outputDir}/queue-priority-1.json`, JSON.stringify(priority1, null, 2));
    fs.writeFileSync(`${outputDir}/queue-priority-2.json`, JSON.stringify(priority2, null, 2));
    fs.writeFileSync(`${outputDir}/queue-priority-3.json`, JSON.stringify(priority3, null, 2));
    
    console.log(`\nPriority 1 (Top makes 2020+): ${priority1.length} vehicles`);
    console.log(`Priority 2 (All priority makes 2018+): ${priority2.length} vehicles`);
    console.log(`Priority 3 (Everything else): ${priority3.length} vehicles`);
    
    // Show sample of priority 1
    console.log('\n--- PRIORITY 1 SAMPLE (First 30) ---');
    for (const v of priority1.slice(0, 30)) {
      console.log(`  ${v.year} ${v.make} ${v.model}: ${v.currentTrims.join(', ') || 'NO TRIMS'}`);
    }
    
    // Summary by make for priority 1
    console.log('\n--- PRIORITY 1 BY MAKE ---');
    const p1ByMake = {};
    for (const v of priority1) {
      p1ByMake[v.make] = (p1ByMake[v.make] || 0) + 1;
    }
    Object.entries(p1ByMake)
      .sort((a, b) => b[1] - a[1])
      .forEach(([make, count]) => console.log(`  ${make}: ${count}`));
    
    console.log(`\nQueue files written to ${outputDir}/`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

generate().catch(console.error);
