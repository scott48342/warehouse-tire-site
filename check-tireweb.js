const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

// Check what pattern name TireWeb returns for a tire
// and whether it matches our pattern_specs cache

async function main() {
  // Simulate what the tire search would return
  const size = '225/65R17';
  const partNumber = '000000000001123534';
  
  // Fetch from API
  const url = `https://shop.warehousetiredirect.com/api/tires/search?size=${encodeURIComponent(size)}&partNumber=${encodeURIComponent(partNumber)}&limit=1`;
  
  console.log('Fetching:', url);
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.results && data.results.length > 0) {
      const tire = data.results[0];
      console.log('\nTire found:');
      console.log('  Brand:', tire.brand);
      console.log('  Model:', tire.model);
      console.log('  Pattern:', tire.pattern);
      console.log('  Description:', tire.description?.slice(0, 100));
      console.log('\n  Badges:');
      console.log('    UTQG:', tire.badges?.utqg);
      console.log('    Warranty:', tire.badges?.warrantyMiles);
      console.log('    TreadDepth:', tire.badges?.treadDepth);
      
      // Check what key would be built (with FIX: full model name)
      const normBrand = (tire.brand || '').toLowerCase().trim().slice(0, 20);
      const patternName = tire.model || tire.pattern || '';
      const normPattern = patternName
        .toLowerCase()
        .trim()
        .replace(/[-_\s]+/g, '')   // Remove hyphens, underscores, spaces
        .replace(/[^a-z0-9]/g, '') // Keep only alphanumeric
        .slice(0, 50);
      const lookupKey = `${normBrand}:${normPattern}`;
      console.log('\n  Pattern lookup key:', lookupKey);
      
      // Check if it matches DB
      const pool = new pg.Pool({ 
        connectionString: process.env.POSTGRES_URL, 
        ssl: { rejectUnauthorized: false } 
      });
      
      const match = await pool.query(
        "SELECT pattern_key, utqg, mileage_warranty FROM tire_pattern_specs WHERE pattern_key = $1",
        [lookupKey]
      );
      
      if (match.rows.length > 0) {
        console.log('  DB Match:', match.rows[0]);
      } else {
        console.log('  DB Match: NONE - key not found');
        
        // Show similar keys
        const similar = await pool.query(
          "SELECT pattern_key FROM tire_pattern_specs WHERE pattern_key LIKE $1 FETCH FIRST 5 ROWS ONLY",
          [`${normBrand}%`]
        );
        console.log('  Similar keys:', similar.rows.map(r => r.pattern_key));
      }
      
      await pool.end();
    } else {
      console.log('No tire found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

main();
