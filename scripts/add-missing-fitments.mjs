import pg from "pg";
import fs from "fs";
import crypto from "crypto";

const envContent = fs.readFileSync(".env.local", "utf-8");
const dbMatch = envContent.match(/POSTGRES_URL="?([^"\s]+)/);
const dbUrl = dbMatch ? dbMatch[1].trim() : null;

const { Pool } = pg;
const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

// Fitment data for the 4 missing vehicles
const fitments = [
  { 
    year: 2005, make: 'chrysler', model: '300c',
    displayTrim: 'Base',
    boltPattern: '5x115', centerBoreMm: 71.5, threadSize: 'M14x1.5',
    oemTireSizes: ['225/60R18', '245/45R20', '255/45R20'],
    oemWheelSizes: [
      { diameter: 18, width: 7.5 },
      { diameter: 20, width: 8.0 }
    ]
  },
  { 
    year: 2010, make: 'ford', model: 'mustang',
    displayTrim: 'Base',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5',
    oemTireSizes: ['215/60R17', '235/50R18', '245/45R19', '255/45R18', '285/40R18', '255/40R19', '285/35R19'],
    oemWheelSizes: [
      { diameter: 17, width: 7.0 },
      { diameter: 18, width: 8.0 },
      { diameter: 19, width: 9.0 }
    ]
  },
  { 
    year: 2010, make: 'ford', model: 'mustang',
    displayTrim: 'GT',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5',
    oemTireSizes: ['215/60R17', '235/50R18', '245/45R19', '255/45R18', '285/40R18', '255/40R19', '285/35R19'],
    oemWheelSizes: [
      { diameter: 18, width: 8.0 },
      { diameter: 19, width: 9.0 }
    ]
  },
  { 
    year: 2021, make: 'ford', model: 'mustang',
    displayTrim: 'EcoBoost',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5',
    oemTireSizes: ['235/55R17', '235/50R18', '255/40R19', '265/40R19'],
    oemWheelSizes: [
      { diameter: 17, width: 8.0 },
      { diameter: 18, width: 8.0 },
      { diameter: 19, width: 9.0 }
    ]
  },
  { 
    year: 2021, make: 'ford', model: 'mustang',
    displayTrim: 'GT',
    boltPattern: '5x114.3', centerBoreMm: 70.6, threadSize: 'M14x1.5',
    oemTireSizes: ['235/55R17', '255/40R19', '265/40R19', '265/35R20', '305/30R20', '315/30R20'],
    oemWheelSizes: [
      { diameter: 19, width: 9.0, tires: ['255/40R19'] },
      { diameter: 19, width: 10.0, tires: ['265/40R19'] },
      { diameter: 20, width: 10.5, tires: ['305/30R20'] }
    ]
  },
  { 
    year: 2022, make: 'toyota', model: 'sienna',
    displayTrim: 'Base',
    boltPattern: '5x114.3', centerBoreMm: 60.1, threadSize: 'M12x1.5',
    oemTireSizes: ['235/65R17', '235/60R18', '235/50R20'],
    oemWheelSizes: [
      { diameter: 17, width: 7.0 },
      { diameter: 18, width: 7.5 },
      { diameter: 20, width: 8.0 }
    ]
  },
  { 
    year: 2022, make: 'toyota', model: 'sienna',
    displayTrim: 'XLE',
    boltPattern: '5x114.3', centerBoreMm: 60.1, threadSize: 'M12x1.5',
    oemTireSizes: ['235/60R18', '235/50R20'],
    oemWheelSizes: [
      { diameter: 18, width: 7.5 },
      { diameter: 20, width: 8.0 }
    ]
  },
];

function slug(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

try {
  console.log("Adding missing fitments to Vercel Postgres:\n");
  
  for (const f of fitments) {
    const id = crypto.randomUUID();
    const modId = `${f.year}-${slug(f.displayTrim)}`;
    
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
      RETURNING id
    `, [
      id, f.year, f.make, f.model, modId, f.displayTrim, f.displayTrim,
      f.boltPattern, f.centerBoreMm, f.threadSize,
      JSON.stringify(f.oemTireSizes), JSON.stringify(f.oemWheelSizes),
      'manual-import'
    ]);
    
    console.log(`✅ ${f.year} ${f.make} ${f.model} ${f.displayTrim}`);
    console.log(`   Sizes: ${f.oemTireSizes.join(', ')}`);
  }
  
  console.log("\n✅ Done! Added/updated", fitments.length, "fitments");
  
} finally {
  await pool.end();
}
