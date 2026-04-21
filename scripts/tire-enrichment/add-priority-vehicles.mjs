/**
 * Add back high-priority US vehicles that were accidentally removed
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// High-priority vehicles to add
const vehicles = [
  // Dodge Journey (2009-2020)
  {
    make: 'Dodge', model: 'Journey',
    years: [2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020],
    boltPattern: '5x127', hubBore: 71.5, offsetMin: 35, offsetMax: 50,
    tires: ['225/55R17', '225/55R19'],
    wheels: [{ diameter: 17, width: 7.0 }, { diameter: 19, width: 7.5 }]
  },
  
  // Mazda6 (2003-2021)
  {
    make: 'Mazda', model: 'Mazda6',
    years: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 
            2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021],
    boltPattern: '5x114.3', hubBore: 67.1, offsetMin: 45, offsetMax: 55,
    tires: ['205/60R16', '225/55R17', '225/45R19'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.5 }, { diameter: 19, width: 7.5 }]
  },
  
  // Also add back any other commonly searched vehicles
  // Nissan Quest (was removed as non-US but is US)
  {
    make: 'Nissan', model: 'Quest',
    years: [2004, 2005, 2006, 2007, 2008, 2009, 2011, 2012, 2013, 2014, 2015, 2016, 2017],
    boltPattern: '5x114.3', hubBore: 66.1, offsetMin: 40, offsetMax: 50,
    tires: ['215/70R15', '225/60R16', '235/55R18', '235/55R19'],
    wheels: [{ diameter: 15, width: 6.5 }, { diameter: 16, width: 7 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 8 }]
  },
  
  // Hyundai Sonata (check if missing)
  {
    make: 'Hyundai', model: 'Sonata',
    years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    boltPattern: '5x114.3', hubBore: 67.1, offsetMin: 40, offsetMax: 52,
    tires: ['205/65R16', '215/55R17', '235/45R18', '245/40R19'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 8 }]
  },
  
  // Acura RDX 
  {
    make: 'Acura', model: 'RDX',
    years: [2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    boltPattern: '5x114.3', hubBore: 64.1, offsetMin: 40, offsetMax: 50,
    tires: ['235/60R18', '255/45R20'],
    wheels: [{ diameter: 18, width: 8 }, { diameter: 20, width: 9 }]
  },
];

console.log('=== ADDING HIGH-PRIORITY VEHICLES ===\n');

let totalAdded = 0;

for (const v of vehicles) {
  const wheelSizes = v.wheels.map(w => ({ 
    diameter: w.diameter, 
    width: w.width, 
    axle: 'square', 
    isStock: true 
  }));
  
  for (const year of v.years) {
    // Check if already exists
    const exists = await pool.query(
      'SELECT id FROM vehicle_fitments WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)',
      [year, v.make, v.model]
    );
    
    if (exists.rows.length > 0) {
      // Update existing
      await pool.query(`
        UPDATE vehicle_fitments SET
          oem_tire_sizes = $4::jsonb,
          oem_wheel_sizes = $5::jsonb,
          bolt_pattern = COALESCE(bolt_pattern, $6),
          center_bore_mm = COALESCE(center_bore_mm, $7),
          offset_min_mm = COALESCE(offset_min_mm, $8),
          offset_max_mm = COALESCE(offset_max_mm, $9),
          updated_at = NOW()
        WHERE year = $1 AND LOWER(make) = LOWER($2) AND LOWER(model) = LOWER($3)
      `, [year, v.make, v.model, JSON.stringify(v.tires), JSON.stringify(wheelSizes),
          v.boltPattern, v.hubBore, v.offsetMin, v.offsetMax]);
    } else {
      // Insert new
      await pool.query(`
        INSERT INTO vehicle_fitments (
          year, make, model, modification_id, display_trim,
          bolt_pattern, center_bore_mm, offset_min_mm, offset_max_mm,
          oem_tire_sizes, oem_wheel_sizes, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12)
      `, [year, v.make, v.model, `${v.make.toLowerCase()}-${v.model.toLowerCase()}-${year}`, 'Base',
          v.boltPattern, v.hubBore, v.offsetMin, v.offsetMax,
          JSON.stringify(v.tires), JSON.stringify(wheelSizes), 'priority-gap-fill']);
      totalAdded++;
    }
  }
  
  console.log(`✅ ${v.make} ${v.model}: ${v.years.length} years`);
}

console.log(`\nTotal new records added: ${totalAdded}`);

// Verify
const verify = await pool.query(`
  SELECT make, model, COUNT(*) as cnt 
  FROM vehicle_fitments 
  WHERE LOWER(model) IN ('journey', 'mazda6', 'quest', 'sonata', 'rdx')
  GROUP BY make, model
`);
console.log('\nVerification:');
verify.rows.forEach(r => console.log(`  ${r.make} ${r.model}: ${r.cnt} records`));

// Final stats
const stats = await pool.query(`
  SELECT COUNT(*) as total,
    SUM(CASE WHEN oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]' THEN 1 ELSE 0 END) as missing
  FROM vehicle_fitments
`);
const s = stats.rows[0];
console.log(`\nFinal coverage: ${((s.total - s.missing) / s.total * 100).toFixed(1)}%`);

pool.end();
