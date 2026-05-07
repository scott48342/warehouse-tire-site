import pg from "pg";
import fs from "fs";
import crypto from "crypto";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

if (!dbUrl) {
  console.error("❌ Could not find POSTGRES_URL in .env.local");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Load extracted data - check for batch2 first, then batch1
const batch2Path = "g:/clawd/fitment/extracted-fitment-batch2.json";
const batch1Path = "g:/clawd/fitment/extracted-fitment-data.json";
const dataPath = process.argv[2] || (fs.existsSync(batch2Path) ? batch2Path : batch1Path);
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
console.log(`Loading from: ${dataPath}`);

function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseWheelSize(wheelSizeStr) {
  // Parse "20x9" or "21x10.5" format
  const match = wheelSizeStr.match(/(\d+)x([\d.]+)/);
  if (!match) return null;
  return { diameter: parseInt(match[1]), width: parseFloat(match[2]) };
}

function parseTireSize(tireSizeStr) {
  // Normalize tire size - remove /C suffix for LT tires, keep the size
  return tireSizeStr.replace(/\/C$/, '');
}

async function importFitments() {
  console.log(`📦 Importing ${data.vehicles.length} vehicles from Tire Guide Pro data\n`);
  
  let added = 0;
  let updated = 0;
  let errors = 0;

  for (const vehicle of data.vehicles) {
    const { year, make, model, boltPattern, centerBore, lugPattern, offset, trims } = vehicle;
    
    // Convert lugPattern to thread size format
    const threadSize = lugPattern.replace('B', ''); // Remove 'B' suffix if present
    
    for (const trimData of trims) {
      const { trim, optional } = trimData;
      
      // Skip optional sizes - we only want primary OEM sizes
      if (optional) continue;
      
      // Build tire sizes array
      const tireSizes = [];
      if (trimData.staggered) {
        if (trimData.tireSizeFront) tireSizes.push(parseTireSize(trimData.tireSizeFront));
        if (trimData.tireSizeRear) tireSizes.push(parseTireSize(trimData.tireSizeRear));
      } else if (trimData.tireSize) {
        tireSizes.push(parseTireSize(trimData.tireSize));
      }
      
      // Build wheel sizes array
      const wheelSizes = [];
      if (trimData.staggered) {
        if (trimData.wheelSizeFront) {
          const parsed = parseWheelSize(trimData.wheelSizeFront);
          if (parsed) wheelSizes.push({ ...parsed, position: 'front' });
        }
        if (trimData.wheelSizeRear) {
          const parsed = parseWheelSize(trimData.wheelSizeRear);
          if (parsed) wheelSizes.push({ ...parsed, position: 'rear' });
        }
      } else if (trimData.wheelSize) {
        const parsed = parseWheelSize(trimData.wheelSize);
        if (parsed) wheelSizes.push(parsed);
      }
      
      if (tireSizes.length === 0) {
        console.log(`⚠️  Skipping ${year} ${make} ${model} ${trim} - no tire sizes`);
        continue;
      }
      
      const id = crypto.randomUUID();
      const modId = `${year}-${slug(trim)}`;
      const makeLower = make.toLowerCase();
      const modelLower = model.toLowerCase();
      
      try {
        const result = await pool.query(`
          INSERT INTO vehicle_fitments (
            id, year, make, model, modification_id, display_trim, raw_trim,
            bolt_pattern, center_bore_mm, thread_size,
            oem_tire_sizes, oem_wheel_sizes, source, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW()
          )
          ON CONFLICT (year, make, model, modification_id) DO UPDATE SET
            oem_tire_sizes = $11,
            oem_wheel_sizes = $12,
            bolt_pattern = $8,
            center_bore_mm = $9,
            thread_size = $10,
            updated_at = NOW()
          RETURNING id, (xmax = 0) as inserted
        `, [
          id, year, makeLower, modelLower, modId, trim, trim,
          boltPattern, centerBore, threadSize,
          JSON.stringify(tireSizes), JSON.stringify(wheelSizes),
          'tire-guide-pro-import'
        ]);
        
        if (result.rows[0].inserted) {
          added++;
          console.log(`✅ Added: ${year} ${make} ${model} ${trim}`);
        } else {
          updated++;
          console.log(`🔄 Updated: ${year} ${make} ${model} ${trim}`);
        }
        console.log(`   Tires: ${tireSizes.join(', ')}`);
        if (trimData.staggered) {
          console.log(`   ⚡ STAGGERED: F=${trimData.wheelSizeFront} R=${trimData.wheelSizeRear}`);
        }
        
      } catch (err) {
        errors++;
        console.error(`❌ Error: ${year} ${make} ${model} ${trim}: ${err.message}`);
      }
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${added + updated}`);
}

try {
  await importFitments();
} finally {
  await pool.end();
}
