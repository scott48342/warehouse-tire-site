require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Expected domestic models by make (2000-2026)
// This represents what a typical tire shop customer would search for
const expectedModels = {
  'Ford': {
    // Trucks
    'F-150': { start: 2000, end: 2026 },
    'F-250': { start: 2000, end: 2026 },
    'F-350': { start: 2000, end: 2026 },
    'Ranger': { start: 2000, end: 2012, gap: [2013, 2018], resume: 2019 },
    'Maverick': { start: 2022, end: 2026 },
    // SUVs
    'Bronco': { start: 2021, end: 2026 },
    'Bronco Sport': { start: 2021, end: 2026 },
    'Explorer': { start: 2000, end: 2026 },
    'Expedition': { start: 2000, end: 2026 },
    'Escape': { start: 2001, end: 2026 },
    'Edge': { start: 2007, end: 2024 },
    'Flex': { start: 2009, end: 2019 },
    'Excursion': { start: 2000, end: 2005 },
    'Explorer Sport Trac': { start: 2001, end: 2010 },
    // Cars
    'Mustang': { start: 2000, end: 2026 },
    'Fusion': { start: 2006, end: 2020 },
    'Focus': { start: 2000, end: 2018 },
    'Taurus': { start: 2000, end: 2019 },
    'Fiesta': { start: 2011, end: 2019 },
    'GT': { start: 2005, end: 2006, gap: [2007, 2016], resume: 2017 },
    // Vans
    'Transit': { start: 2015, end: 2026 },
    'E-150': { start: 2000, end: 2014 },
    'E-250': { start: 2000, end: 2014 },
    'E-350': { start: 2000, end: 2014 },
  },
  'Chevrolet': {
    // Trucks
    'Silverado 1500': { start: 2000, end: 2026 },
    // Vans
    'Express 1500': { start: 2000, end: 2014 },
    'Express 2500': { start: 2000, end: 2026 },
    'Express 3500': { start: 2000, end: 2026 },
    'Silverado 2500HD': { start: 2000, end: 2026 },
    'Silverado 3500HD': { start: 2000, end: 2026 },
    'Colorado': { start: 2004, end: 2026 },
    'Avalanche': { start: 2002, end: 2013 },
    // SUVs
    'Tahoe': { start: 2000, end: 2026 },
    'Suburban': { start: 2000, end: 2026 },
    'Traverse': { start: 2009, end: 2026 },
    'Equinox': { start: 2005, end: 2026 },
    'Blazer': { start: 2019, end: 2026 },
    'Trailblazer': { start: 2002, end: 2009, gap: [2010, 2020], resume: 2021 },
    'Trax': { start: 2015, end: 2026 },
    // Cars
    'Camaro': { start: 2010, end: 2024 },
    'Corvette': { start: 2000, end: 2026 },
    'Malibu': { start: 2000, end: 2026 },
    'Impala': { start: 2000, end: 2020 },
    'Cruze': { start: 2011, end: 2019 },
    'Sonic': { start: 2012, end: 2020 },
    'Spark': { start: 2013, end: 2022 },

  },
  'Dodge': {
    'Challenger': { start: 2008, end: 2024 },
    'Charger': { start: 2006, end: 2024 },
    'Durango': { start: 2000, end: 2026 },
    'Journey': { start: 2009, end: 2020 },
    'Grand Caravan': { start: 2000, end: 2020 },
    'Caravan': { start: 2000, end: 2007 },
    'Nitro': { start: 2007, end: 2011 },
    'Caliber': { start: 2007, end: 2012 },
    'Avenger': { start: 2008, end: 2014 },
    'Dart': { start: 2013, end: 2016 },
    'Hornet': { start: 2023, end: 2026 },
  },
  'RAM': {
    '1500': { start: 2011, end: 2026 },
    '2500': { start: 2011, end: 2026 },
    '3500': { start: 2011, end: 2026 },
    '1500 Classic': { start: 2019, end: 2026 },
    '1500 TRX': { start: 2021, end: 2025 },
    'ProMaster': { start: 2014, end: 2026 },
    'ProMaster City': { start: 2015, end: 2022 },
  },
  'GMC': {
    'Sierra 1500': { start: 2000, end: 2026 },
    // Vans  
    'Savana 1500': { start: 2000, end: 2014 },
    'Savana 2500': { start: 2000, end: 2026 },
    'Savana 3500': { start: 2000, end: 2026 },
    'Sierra 2500HD': { start: 2000, end: 2026 },
    'Sierra 3500HD': { start: 2000, end: 2026 },
    'Canyon': { start: 2004, end: 2026 },
    'Yukon': { start: 2000, end: 2026 },
    'Yukon XL': { start: 2000, end: 2026 },
    'Acadia': { start: 2007, end: 2026 },
    'Terrain': { start: 2010, end: 2026 },
    'Envoy': { start: 2000, end: 2009 },

    'Hummer EV': { start: 2022, end: 2026 },
  },
  'Jeep': {
    'Wrangler': { start: 2000, end: 2026 },
    'Grand Cherokee': { start: 2000, end: 2026 },
    'Cherokee': { start: 2000, end: 2026 },
    'Gladiator': { start: 2020, end: 2026 },
    'Compass': { start: 2007, end: 2026 },
    'Patriot': { start: 2007, end: 2017 },
    'Liberty': { start: 2002, end: 2012 },
    'Commander': { start: 2006, end: 2010 },
    'Renegade': { start: 2015, end: 2026 },
    'Wagoneer': { start: 2022, end: 2026 },
    'Grand Wagoneer': { start: 2022, end: 2026 },
  },
  'Cadillac': {
    'Escalade': { start: 2000, end: 2026 },
    'Escalade ESV': { start: 2003, end: 2026 },
    'CT5': { start: 2020, end: 2026 },
    'CT4': { start: 2020, end: 2026 },
    'XT5': { start: 2017, end: 2026 },
    'XT4': { start: 2019, end: 2026 },
    'XT6': { start: 2020, end: 2026 },
    'CTS': { start: 2003, end: 2019 },
    'ATS': { start: 2013, end: 2019 },
    'SRX': { start: 2004, end: 2016 },
    'DeVille': { start: 2000, end: 2005 },
    'Seville': { start: 2000, end: 2004 },
    'Lyriq': { start: 2023, end: 2026 },
  },
  'Lincoln': {
    'Navigator': { start: 2000, end: 2026 },
    'Aviator': { start: 2020, end: 2026 },
    'Corsair': { start: 2020, end: 2026 },
    'Nautilus': { start: 2019, end: 2026 },
    'MKX': { start: 2007, end: 2018 },
    'MKC': { start: 2015, end: 2019 },
    'MKZ': { start: 2006, end: 2020 },
    'MKS': { start: 2009, end: 2016 },
    'Continental': { start: 2017, end: 2020 },
    'Town Car': { start: 2000, end: 2011 },
  },
  'Buick': {
    'Enclave': { start: 2008, end: 2026 },
    'Encore': { start: 2013, end: 2026 },
    'Encore GX': { start: 2020, end: 2026 },
    'Envision': { start: 2016, end: 2026 },
    'LaCrosse': { start: 2005, end: 2019 },
    'Regal': { start: 2000, end: 2020 },
    'Verano': { start: 2012, end: 2017 },
    'LeSabre': { start: 2000, end: 2005 },
    'Century': { start: 2000, end: 2005 },
    'Rendezvous': { start: 2002, end: 2007 },
    'Lucerne': { start: 2006, end: 2011 },
  },
  'Chrysler': {
    'Pacifica': { start: 2017, end: 2026 },
    '300': { start: 2005, end: 2024 },
    'Town & Country': { start: 2000, end: 2016 },
    'Sebring': { start: 2000, end: 2010 },
    'PT Cruiser': { start: 2001, end: 2010 },
    'Aspen': { start: 2007, end: 2009 },
    '200': { start: 2011, end: 2017 },
    'Voyager': { start: 2020, end: 2024 },
  },
};

async function main() {
  const client = await pool.connect();
  
  try {
    console.log('=== DOMESTIC VEHICLE COVERAGE ANALYSIS (2000-2026) ===\n');
    
    let totalExpectedYears = 0;
    let totalCoveredYears = 0;
    let totalExpectedModels = 0;
    let totalCoveredModels = 0;
    
    const makeStats = {};
    
    for (const [make, models] of Object.entries(expectedModels)) {
      let makeExpectedYears = 0;
      let makeCoveredYears = 0;
      let makeExpectedModels = Object.keys(models).length;
      let makeCoveredModels = 0;
      const missingModels = [];
      const partialModels = [];
      
      for (const [model, yearRange] of Object.entries(models)) {
        // Calculate expected years
        let expectedYears = [];
        if (yearRange.gap) {
          // Has a gap
          for (let y = yearRange.start; y <= yearRange.end; y++) {
            if (y < yearRange.gap[0] || y > yearRange.gap[1]) {
              expectedYears.push(y);
            }
          }
          if (yearRange.resume) {
            for (let y = yearRange.resume; y <= 2026; y++) {
              if (!expectedYears.includes(y)) expectedYears.push(y);
            }
          }
        } else {
          for (let y = yearRange.start; y <= yearRange.end; y++) {
            expectedYears.push(y);
          }
        }
        
        makeExpectedYears += expectedYears.length;
        
        // Check actual coverage
        const result = await client.query(`
          SELECT COUNT(DISTINCT year) as years, MIN(year) as min_y, MAX(year) as max_y
          FROM vehicle_fitments
          WHERE make = $1 AND model ILIKE $2 AND year >= 2000 AND year <= 2026
        `, [make, model]);
        
        const actualYears = parseInt(result.rows[0].years) || 0;
        makeCoveredYears += Math.min(actualYears, expectedYears.length);
        
        if (actualYears === 0) {
          missingModels.push(model);
        } else if (actualYears < expectedYears.length * 0.8) {
          partialModels.push(`${model} (${result.rows[0].min_y}-${result.rows[0].max_y}, ${actualYears}/${expectedYears.length} years)`);
          makeCoveredModels++;
        } else {
          makeCoveredModels++;
        }
      }
      
      totalExpectedYears += makeExpectedYears;
      totalCoveredYears += makeCoveredYears;
      totalExpectedModels += makeExpectedModels;
      totalCoveredModels += makeCoveredModels;
      
      const coverage = makeExpectedYears > 0 ? (makeCoveredYears / makeExpectedYears * 100).toFixed(1) : 0;
      const modelCoverage = (makeCoveredModels / makeExpectedModels * 100).toFixed(0);
      
      makeStats[make] = { 
        coverage, 
        modelCoverage,
        expectedModels: makeExpectedModels, 
        coveredModels: makeCoveredModels,
        missing: missingModels,
        partial: partialModels
      };
      
      console.log(`${make}: ${coverage}% year coverage, ${modelCoverage}% model coverage (${makeCoveredModels}/${makeExpectedModels} models)`);
      if (missingModels.length > 0) {
        console.log(`  ❌ Missing: ${missingModels.join(', ')}`);
      }
      if (partialModels.length > 0) {
        console.log(`  ⚠️  Partial: ${partialModels.join('; ')}`);
      }
    }
    
    const overallYearCoverage = (totalCoveredYears / totalExpectedYears * 100).toFixed(1);
    const overallModelCoverage = (totalCoveredModels / totalExpectedModels * 100).toFixed(1);
    
    console.log('\n========================================');
    console.log('OVERALL DOMESTIC COVERAGE SUMMARY');
    console.log('========================================');
    console.log(`Total expected models: ${totalExpectedModels}`);
    console.log(`Total covered models: ${totalCoveredModels} (${overallModelCoverage}%)`);
    console.log(`Total expected year-models: ${totalExpectedYears}`);
    console.log(`Total covered year-models: ${totalCoveredYears} (${overallYearCoverage}%)`);
    
    // Check trim/submodel coverage
    console.log('\n\n--- TRIM/SUBMODEL COVERAGE ---\n');
    
    const trimStats = await client.query(`
      SELECT make, 
        COUNT(DISTINCT model) as models,
        COUNT(DISTINCT CONCAT(model, '-', display_trim)) as model_trims,
        COUNT(*) as total_records
      FROM vehicle_fitments
      WHERE make IN ('Ford', 'Chevrolet', 'Dodge', 'RAM', 'GMC', 'Jeep', 'Cadillac', 'Lincoln', 'Buick', 'Chrysler')
        AND year >= 2000 AND year <= 2026
      GROUP BY make
      ORDER BY total_records DESC
    `);
    
    console.log('Make          | Models | Model+Trims | Total Records | Avg Trims/Model');
    console.log('--------------|--------|-------------|---------------|----------------');
    trimStats.rows.forEach(r => {
      const avgTrims = (parseInt(r.model_trims) / parseInt(r.models)).toFixed(1);
      console.log(`${r.make.padEnd(13)} | ${String(r.models).padStart(6)} | ${String(r.model_trims).padStart(11)} | ${String(r.total_records).padStart(13)} | ${avgTrims}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}
main();
