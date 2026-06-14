import pg from 'pg';

const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = new pg.Pool({
  connectionString: connStr,
  ssl: connStr?.includes('prisma') ? { rejectUnauthorized: false } : false
});

async function getVehicles() {
  const result = await pool.query(`
    SELECT DISTINCT year, make, model, bolt_pattern, display_trim
    FROM vehicle_fitments
    WHERE year BETWEEN 2000 AND 2026
      AND bolt_pattern IS NOT NULL
      AND certification_status = 'certified'
    ORDER BY RANDOM()
    LIMIT 80
  `);
  
  // Categorize and select diverse vehicles
  const vehicles = result.rows;
  const selected = [];
  const seen = new Set();
  
  // Categories to ensure diversity
  const hdTrucks = ['Silverado 2500', 'Silverado 3500', 'Sierra 2500', 'Sierra 3500', 'F-250', 'F-350', 'Ram 2500', 'Ram 3500'];
  const halfTons = ['Silverado 1500', 'Sierra 1500', 'F-150', 'Ram 1500', 'Tundra', 'Tacoma', 'Titan', 'Frontier', 'Colorado', 'Canyon'];
  const suvs = ['Tahoe', 'Suburban', 'Yukon', 'Expedition', 'Explorer', '4Runner', 'Sequoia', 'Grand Cherokee', 'Wrangler', 'Bronco', 'Durango'];
  const cuvs = ['CR-V', 'RAV4', 'CX-5', 'Tucson', 'Santa Fe', 'Outback', 'Forester', 'Escape', 'Equinox', 'Rogue', 'Sportage', 'Pilot', 'Highlander'];
  const cars = ['Camry', 'Corolla', 'Accord', 'Civic', 'Altima', 'Sentra', 'Sonata', 'Elantra', 'Mazda3', 'Mazda6', 'Jetta', 'Passat'];
  const sports = ['Mustang', 'Camaro', 'Challenger', 'Charger', 'Corvette', '370Z', 'Supra', 'WRX', 'BRZ', '86'];
  const luxury = ['3 Series', '5 Series', 'X5', 'C-Class', 'E-Class', 'GLE', 'A4', 'Q5', 'RX', 'ES', 'IS', 'GS', 'G-Class', 'S-Class'];
  const vans = ['Express', 'Transit', 'ProMaster', 'Sprinter', 'Savana', 'E-Series'];
  
  function categorize(model) {
    const m = model.toLowerCase();
    for (const t of hdTrucks) if (m.includes(t.toLowerCase())) return 'hd_truck';
    for (const t of halfTons) if (m.includes(t.toLowerCase())) return 'half_ton';
    for (const t of suvs) if (m.includes(t.toLowerCase())) return 'suv';
    for (const t of cuvs) if (m.includes(t.toLowerCase())) return 'cuv';
    for (const t of sports) if (m.includes(t.toLowerCase())) return 'sports';
    for (const t of luxury) if (m.includes(t.toLowerCase())) return 'luxury';
    for (const t of vans) if (m.includes(t.toLowerCase())) return 'van';
    for (const t of cars) if (m.includes(t.toLowerCase())) return 'car';
    return 'other';
  }
  
  const categoryTargets = {
    hd_truck: 8,
    half_ton: 6,
    suv: 8,
    cuv: 8,
    car: 6,
    sports: 4,
    luxury: 6,
    van: 4,
    other: 0
  };
  
  const categoryCounts = {};
  for (const cat of Object.keys(categoryTargets)) categoryCounts[cat] = 0;
  
  for (const v of vehicles) {
    const key = `${v.year}-${v.make}-${v.model}`;
    if (seen.has(key)) continue;
    
    const cat = categorize(v.model);
    if (categoryCounts[cat] >= categoryTargets[cat]) continue;
    
    seen.add(key);
    categoryCounts[cat]++;
    selected.push({
      year: v.year,
      make: v.make,
      model: v.model,
      boltPattern: v.bolt_pattern,
      category: cat
    });
    
    if (selected.length >= 50) break;
  }
  
  // Output as JSON
  console.log(JSON.stringify(selected, null, 2));
  
  await pool.end();
}

getVehicles().catch(e => { console.error(e); process.exit(1); });
