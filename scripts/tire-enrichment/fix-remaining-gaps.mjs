/**
 * Fix remaining gaps in popular US vehicles
 */
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/POSTGRES_URL="?([^"\s]+)/)[1];
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

// Find the specific gaps
const gaps = await pool.query(`
  SELECT year, make, model, display_trim
  FROM vehicle_fitments
  WHERE (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
    AND LOWER(model) IN (
      'equinox', 'charger', 'cx-5', 'mazda3', 'tucson', 'santa-fe', 
      'sorento', 'sportage', 'telluride', 'frontier'
    )
  ORDER BY make, model, year
`);

console.log('=== Gaps to fix ===');
gaps.rows.forEach(r => console.log(`${r.year} ${r.make} ${r.model} - ${r.display_trim}`));

// Fitment data for these specific vehicles
const fixes = [
  // Chevrolet Equinox
  { make: 'chevrolet', model: 'equinox', years: [2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['225/65R17', '225/60R18', '235/55R18', '235/50R19', '235/45R20'],
    wheels: [{ diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 8.0 }] },
  
  // Dodge Charger
  { make: 'dodge', model: 'charger', years: [2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['215/65R17', '225/60R18', '235/55R19', '245/45R20', '275/40R20', '305/35R20'],
    wheels: [{ diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 8.0 }, { diameter: 20, width: 9.0 }, { diameter: 20, width: 9.5 }] },
  
  // Mazda CX-5
  { make: 'mazda', model: 'cx-5', years: [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['225/65R17', '225/55R19', '225/55R19'],
    wheels: [{ diameter: 17, width: 7.0 }, { diameter: 19, width: 7.0 }] },
  
  // Mazda3
  { make: 'mazda', model: 'mazda3', years: [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['205/60R16', '215/45R18', '215/45R18'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 18, width: 7.0 }] },
  
  // Hyundai Tucson
  { make: 'hyundai', model: 'tucson', years: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['215/70R16', '225/60R17', '235/55R18', '235/50R19', '255/45R19'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 7.5 }] },
  
  // Hyundai Santa Fe
  { make: 'hyundai', model: 'santa-fe', years: [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['235/70R16', '235/65R17', '235/60R18', '235/55R19', '255/45R20'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 7.5 }, { diameter: 20, width: 8.0 }] },
  
  // Kia Sorento
  { make: 'kia', model: 'sorento', years: [2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['235/70R16', '235/65R17', '235/60R18', '235/55R19', '255/45R20'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 7.5 }, { diameter: 20, width: 8.0 }] },
  
  // Kia Sportage
  { make: 'kia', model: 'sportage', years: [2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['215/70R16', '225/60R17', '235/55R18', '235/50R19', '255/45R19'],
    wheels: [{ diameter: 16, width: 6.5 }, { diameter: 17, width: 7.0 }, { diameter: 18, width: 7.5 }, { diameter: 19, width: 7.5 }] },
  
  // Kia Telluride
  { make: 'kia', model: 'telluride', years: [2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['245/65R18', '245/60R20'],
    wheels: [{ diameter: 18, width: 7.5 }, { diameter: 20, width: 8.5 }] },
  
  // Nissan Frontier
  { make: 'nissan', model: 'frontier', years: [2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
    tires: ['255/70R16', '265/70R16', '265/65R17', '265/60R18'],
    wheels: [{ diameter: 16, width: 7.0 }, { diameter: 17, width: 7.5 }, { diameter: 18, width: 7.5 }] },
];

console.log('\n=== Applying fixes ===');
let totalFixed = 0;

for (const fix of fixes) {
  const wheelSizes = fix.wheels.map(w => ({ ...w, axle: 'square', isStock: true }));
  
  for (const year of fix.years) {
    const result = await pool.query(`
      UPDATE vehicle_fitments
      SET 
        oem_tire_sizes = $4::jsonb,
        oem_wheel_sizes = CASE 
          WHEN oem_wheel_sizes IS NULL OR oem_wheel_sizes::text = '[]' THEN $5::jsonb
          ELSE oem_wheel_sizes
        END,
        updated_at = NOW()
      WHERE LOWER(make) = LOWER($1) 
        AND LOWER(model) = LOWER($2)
        AND year = $3
        AND (oem_tire_sizes IS NULL OR oem_tire_sizes::text = '[]')
      RETURNING id
    `, [fix.make, fix.model, year, JSON.stringify(fix.tires), JSON.stringify(wheelSizes)]);
    
    if (result.rowCount > 0) {
      console.log(`  ${year} ${fix.make} ${fix.model}: ${result.rowCount} fixed`);
      totalFixed += result.rowCount;
    }
  }
}

console.log(`\n✅ Total fixed: ${totalFixed}`);
pool.end();
