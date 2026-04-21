import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Direct fixes for specific gaps found
const fixes = [
  { year: 2004, make: 'chevrolet', model: 'equinox', tires: ['215/70R16', '225/60R17'], wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }] },
  { year: 2005, make: 'dodge', model: 'charger', tires: ['215/65R17', '225/60R18'], wheels: [{ diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }] },
  { year: 2000, make: 'hyundai', model: 'santa-fe', tires: ['225/70R16', '235/65R17'], wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }] },
  { year: 2004, make: 'hyundai', model: 'tucson', tires: ['215/65R16', '225/60R17'], wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }] },
  { year: 2002, make: 'kia', model: 'sorento', tires: ['225/75R16', '245/70R16'], wheels: [{ diameter: 16, width: 7.0 }] },
  { year: 2003, make: 'kia', model: 'sportage', tires: ['205/70R15', '215/65R16'], wheels: [{ diameter: 15, width: 6.0 }, { diameter: 16, width: 6.5 }] },
  { year: 2004, make: 'kia', model: 'sportage', tires: ['205/70R15', '215/65R16'], wheels: [{ diameter: 15, width: 6.0 }, { diameter: 16, width: 6.5 }] },
  { year: 2019, make: 'kia', model: 'telluride', tires: ['245/65R18', '245/60R20'], wheels: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.5 }] },
  { year: 2011, make: 'mazda', model: 'cx-5', tires: ['225/65R17', '225/55R19'], wheels: [{ diameter: 17, width: 7.0 }, { diameter: 19, width: 7.0 }] },
  { year: 2012, make: 'mazda', model: 'cx-5', tires: ['225/65R17', '225/55R19'], wheels: [{ diameter: 17, width: 7.0 }, { diameter: 19, width: 7.0 }] },
  { year: 2003, make: 'mazda', model: 'mazda3', tires: ['195/65R15', '205/55R16'], wheels: [{ diameter: 15, width: 6.0 }, { diameter: 16, width: 6.5 }] },
];

console.log('Fixing specific gaps...\n');
let fixed = 0;

for (const f of fixes) {
  const ws = f.wheels.map(w => ({ ...w, axle: 'square', isStock: true }));
  const r = await pool.query(`
    UPDATE vehicle_fitments 
    SET oem_tire_sizes = $4::jsonb, oem_wheel_sizes = $5::jsonb, updated_at = NOW() 
    WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3) 
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    RETURNING id
  `, [f.year, f.make, f.model, JSON.stringify(f.tires), JSON.stringify(ws)]);
  
  if (r.rowCount > 0) { 
    console.log(`✅ ${f.year} ${f.make} ${f.model}: fixed`); 
    fixed += r.rowCount; 
  }
}

console.log(`\nTotal fixed: ${fixed}`);
pool.end();
