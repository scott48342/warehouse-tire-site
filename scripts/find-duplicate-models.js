const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function check() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  // Get all make/model combinations
  const r = await pool.query(`
    SELECT make, model, COUNT(*) as records
    FROM vehicle_fitments
    GROUP BY make, model
    ORDER BY make, model
  `);
  
  console.log('=== CHECKING FOR DUPLICATE MODEL NAMES ===\n');
  
  // Group by make
  const byMake = {};
  r.rows.forEach(row => {
    if (!byMake[row.make]) byMake[row.make] = [];
    byMake[row.make].push({ model: row.model, records: parseInt(row.records) });
  });
  
  let issues = [];
  
  for (const [make, models] of Object.entries(byMake)) {
    // Check for similar model names within same make
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const m1 = models[i].model;
        const m2 = models[j].model;
        
        // Check if one is a variant of the other
        const m1Clean = m1.replace(/-/g, '').replace(/ /g, '').toLowerCase();
        const m2Clean = m2.replace(/-/g, '').replace(/ /g, '').toLowerCase();
        
        if (m1Clean === m2Clean || 
            m1.replace(/-/g, ' ') === m2 || 
            m2.replace(/-/g, ' ') === m1 ||
            m1.replace(/ /g, '-') === m2 ||
            m2.replace(/ /g, '-') === m1) {
          issues.push({
            make,
            model1: m1,
            records1: models[i].records,
            model2: m2,
            records2: models[j].records
          });
        }
      }
    }
  }
  
  if (issues.length > 0) {
    console.log('⚠️ POTENTIAL DUPLICATES FOUND:\n');
    issues.forEach(i => {
      console.log(`${i.make}:`);
      console.log(`  "${i.model1}" (${i.records1} records)`);
      console.log(`  "${i.model2}" (${i.records2} records)`);
      console.log('');
    });
  } else {
    console.log('✅ No duplicate model names found!\n');
  }
  
  // Also list all models with spaces (should be none)
  const spaces = await pool.query(`
    SELECT DISTINCT make, model FROM vehicle_fitments WHERE model LIKE '% %' ORDER BY make, model
  `);
  
  if (spaces.rows.length > 0) {
    console.log('⚠️ MODELS WITH SPACES:\n');
    spaces.rows.forEach(r => console.log(`  ${r.make} ${r.model}`));
  } else {
    console.log('✅ No models with spaces!\n');
  }
  
  // Check for models that differ only by hyphens vs no hyphens
  console.log('\n=== ALL MODELS BY MAKE (checking manually) ===\n');
  
  const makes = ['chevrolet', 'gmc', 'ford', 'ram', 'toyota', 'honda', 'nissan', 'jeep', 'dodge'];
  
  for (const make of makes) {
    const models = byMake[make];
    if (models) {
      console.log(`${make.toUpperCase()}: ${models.map(m => m.model).join(', ')}`);
    }
  }
  
  console.log(`\nTotal: ${r.rows.length} unique make/model combinations`);
  
  await pool.end();
}

check();
