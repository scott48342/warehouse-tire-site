/**
 * Fix Buick and Chevrolet Missing Fitment Data
 * 
 * Fills missing wheel/tire sizes for 313 records based on Google AI Overview research
 * 
 * Run with: npx tsx scripts/fix-buick-chevy-remaining.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

// ================================================================================
// BUICK FITMENT DATA
// ================================================================================

const buickFitments: Record<string, {
  wheelSizes: Array<{diameter: number, width: number}>,
  tireSizes: string[],
  yearRange?: [number, number]
}> = {
  // Enclave 2008-2017 (1st gen)
  'enclave_2008_2017': {
    wheelSizes: [
      {diameter: 18, width: 7.5},
      {diameter: 19, width: 8},
      {diameter: 20, width: 8}
    ],
    tireSizes: ['255/65R18', '255/60R19', '255/55R20'],
    yearRange: [2008, 2017]
  },
  // Enclave 2018-2021 (2nd gen)
  'enclave_2018_2021': {
    wheelSizes: [
      {diameter: 18, width: 7.5},
      {diameter: 19, width: 8},
      {diameter: 20, width: 8.5},
      {diameter: 21, width: 8.5}
    ],
    tireSizes: ['255/65R18', '255/60R19', '255/55R20', '265/50R21'],
    yearRange: [2018, 2021]
  },
  // Enclave 2022-2026 (2nd gen facelift)
  'enclave_2022_2026': {
    wheelSizes: [
      {diameter: 18, width: 7.5},
      {diameter: 20, width: 8},
      {diameter: 21, width: 9}
    ],
    tireSizes: ['255/65R18', '255/55R20', '265/45R21'],
    yearRange: [2022, 2026]
  },
  
  // LaCrosse 2010-2016 (all trims)
  'lacrosse_2010_2016': {
    wheelSizes: [
      {diameter: 17, width: 7},
      {diameter: 18, width: 8},
      {diameter: 19, width: 8}
    ],
    tireSizes: ['235/50R17', '235/50R18', '245/45R19'],
    yearRange: [2010, 2016]
  },
  // LaCrosse 2017-2019 (all trims including Avenir)
  'lacrosse_2017_2019': {
    wheelSizes: [
      {diameter: 18, width: 8},
      {diameter: 19, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['235/50R18', '245/45R19', '245/40R20'],
    yearRange: [2017, 2019]
  },
  
  // Regal 2011-2017 (all trims)
  'regal_2011_2017': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 19, width: 8.5}
    ],
    tireSizes: ['225/55R17', '235/50R18', '245/40R19'],
    yearRange: [2011, 2017]
  },
  // Regal 2018-2020 (Sportback/TourX)
  'regal_2018_2020': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8.5},
      {diameter: 19, width: 8.5}
    ],
    tireSizes: ['225/55R17', '245/45R18', '245/40R19'],
    yearRange: [2018, 2020]
  },
  
  // Envision 2016-2021 (all trims)
  'envision_2016_2021': {
    wheelSizes: [
      {diameter: 18, width: 7.5},
      {diameter: 19, width: 8},
      {diameter: 20, width: 8}
    ],
    tireSizes: ['235/60R18', '235/55R19', '245/45R20'],
    yearRange: [2016, 2021]
  },
  // Envision 2022-2026 (2nd gen)
  'envision_2022_2026': {
    wheelSizes: [
      {diameter: 18, width: 7.5},
      {diameter: 20, width: 8}
    ],
    tireSizes: ['235/60R18', '245/45R20'],
    yearRange: [2022, 2026]
  },
  
  // Encore 2013-2022
  'encore': {
    wheelSizes: [
      {diameter: 17, width: 7},
      {diameter: 18, width: 7}
    ],
    tireSizes: ['215/55R17', '215/50R18']
  },
  
  // Encore GX 2020-2026
  'encore_gx': {
    wheelSizes: [
      {diameter: 18, width: 7},
      {diameter: 19, width: 7.5}
    ],
    tireSizes: ['225/55R18', '245/45R19']
  },
  
  // Envista 2024-2026
  'envista': {
    wheelSizes: [
      {diameter: 17, width: 7},
      {diameter: 18, width: 7.5}
    ],
    tireSizes: ['225/60R17', '225/55R18']
  },
  
  // Cascada 2016-2019
  'cascada': {
    wheelSizes: [
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['235/45R18', '245/35R20']
  },
  
  // Verano 2012-2017
  'verano': {
    wheelSizes: [
      {diameter: 17, width: 7},
      {diameter: 18, width: 8}
    ],
    tireSizes: ['225/50R17', '235/45R18']
  },
  
  // Lucerne 2006-2011
  'lucerne': {
    wheelSizes: [
      {diameter: 16, width: 7},
      {diameter: 17, width: 7},
      {diameter: 18, width: 8}
    ],
    tireSizes: ['225/60R16', '225/55R17', '235/50R18']
  },
  
  // Terraza 2005-2007
  'terraza': {
    wheelSizes: [
      {diameter: 17, width: 6.5}
    ],
    tireSizes: ['225/60R17']
  },
  
  // Rendezvous 2002-2007
  'rendezvous': {
    wheelSizes: [
      {diameter: 16, width: 6.5},
      {diameter: 17, width: 6.5}
    ],
    tireSizes: ['225/60R16', '225/55R17']
  },
  
  // Rainier 2004-2007
  'rainier': {
    wheelSizes: [
      {diameter: 17, width: 7},
      {diameter: 18, width: 7.5}
    ],
    tireSizes: ['245/65R17', '245/60R18']
  }
};

// ================================================================================
// CHEVROLET FITMENT DATA
// ================================================================================

const chevroletFitments: Record<string, {
  wheelSizes: Array<{diameter: number, width: number}>,
  tireSizes: string[],
  yearRange?: [number, number]
}> = {
  // Blazer 2000-2005 (S-10 era)
  'blazer_2000_2005': {
    wheelSizes: [
      {diameter: 15, width: 7},
      {diameter: 16, width: 7}
    ],
    tireSizes: ['235/70R15', '235/65R16', '215/70R16'],
    yearRange: [2000, 2005]
  },
  // Blazer 2019-2023 (modern crossover)
  'blazer_2019_2023': {
    wheelSizes: [
      {diameter: 18, width: 8},
      {diameter: 20, width: 8},
      {diameter: 21, width: 8.5}
    ],
    tireSizes: ['235/65R18', '235/55R20', '265/45R21'],
    yearRange: [2019, 2023]
  },
  // Blazer 2023-2026 (facelift)
  'blazer_2023_2026': {
    wheelSizes: [
      {diameter: 18, width: 8},
      {diameter: 19, width: 8},
      {diameter: 20, width: 8},
      {diameter: 21, width: 8.5}
    ],
    tireSizes: ['235/65R18', '235/60R19', '235/55R20', '265/45R21'],
    yearRange: [2023, 2026]
  },
  
  // Trailblazer 2002-2009 (SUV)
  'trailblazer_2002_2009': {
    wheelSizes: [
      {diameter: 16, width: 7},
      {diameter: 17, width: 7},
      {diameter: 18, width: 7.5}
    ],
    tireSizes: ['245/70R16', '245/65R17', '245/60R18'],
    yearRange: [2002, 2009]
  },
  // Trailblazer 2021-2026 (modern crossover)
  'trailblazer_2021_2026': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 7.5},
      {diameter: 19, width: 7.5}
    ],
    tireSizes: ['225/60R17', '225/55R18', '245/45R19'],
    yearRange: [2021, 2026]
  },
  
  // Silverado 1500 (all years - generic)
  'silverado_1500': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5},
      {diameter: 22, width: 9}
    ],
    tireSizes: ['265/70R17', '265/65R18', '275/60R20', '275/50R22']
  },
  
  // Silverado 2500/2500 HD (all years)
  'silverado_2500': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['LT265/70R17', 'LT275/70R18', 'LT275/65R20']
  },
  
  // Silverado 3500/3500 HD (all years - SRW)
  'silverado_3500_srw': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['LT265/70R17', 'LT275/70R18', 'LT275/65R20']
  },
  // Silverado 3500 HD (DRW)
  'silverado_3500_drw': {
    wheelSizes: [
      {diameter: 17, width: 6}
    ],
    tireSizes: ['LT235/80R17']
  },
  
  // Suburban 1500 2000-2014
  'suburban_1500_2000_2014': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['265/70R17', '265/65R18', '275/55R20'],
    yearRange: [2000, 2014]
  },
  // Suburban 2015-2020
  'suburban_2015_2020': {
    wheelSizes: [
      {diameter: 18, width: 8.5},
      {diameter: 20, width: 9},
      {diameter: 22, width: 9}
    ],
    tireSizes: ['265/65R18', '275/55R20', '285/45R22'],
    yearRange: [2015, 2020]
  },
  
  // Suburban 2500 (all years - 8-lug)
  'suburban_2500': {
    wheelSizes: [
      {diameter: 16, width: 6.5},
      {diameter: 17, width: 7.5},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['LT245/75R16', 'LT265/70R17', '275/55R20']
  },
  
  // Avalanche 1500 (2002-2013)
  'avalanche_1500': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['265/70R17', '265/65R18', '275/55R20']
  },
  
  // Avalanche 2500 (2002-2006)
  'avalanche_2500': {
    wheelSizes: [
      {diameter: 16, width: 6.5},
      {diameter: 17, width: 7.5}
    ],
    tireSizes: ['LT245/75R16', 'LT265/70R17']
  },
  
  // Avalanche 2007-2013 (no 2500 model, all 1500)
  'avalanche_2007_2013': {
    wheelSizes: [
      {diameter: 17, width: 7.5},
      {diameter: 18, width: 8},
      {diameter: 20, width: 8.5}
    ],
    tireSizes: ['265/70R17', '265/65R18', '275/55R20'],
    yearRange: [2007, 2013]
  },
  
  // Astro 1995-2005
  'astro': {
    wheelSizes: [
      {diameter: 15, width: 6.5},
      {diameter: 16, width: 6.5}
    ],
    tireSizes: ['215/70R15', '215/65R16']
  },
  
  // Bolt EUV 2022-2023
  'bolt_euv': {
    wheelSizes: [
      {diameter: 17, width: 6.5}
    ],
    tireSizes: ['215/50R17']
  },
  
  // Trax 2015-2024
  'trax': {
    wheelSizes: [
      {diameter: 16, width: 6.5},
      {diameter: 17, width: 7},
      {diameter: 18, width: 7}
    ],
    tireSizes: ['205/70R16', '205/65R17', '215/55R18']
  },
  
  // Volt 2011-2019
  'volt': {
    wheelSizes: [
      {diameter: 17, width: 7}
    ],
    tireSizes: ['215/50R17', '215/45R17']
  }
};

// ================================================================================
// HELPER FUNCTIONS
// ================================================================================

function selectFitment(model: string, year: number, make: string): {
  wheelSizes: Array<{diameter: number, width: number}>,
  tireSizes: string[]
} | null {
  const modelLower = model.toLowerCase();
  
  if (make === 'Buick') {
    // Enclave
    if (modelLower.includes('enclave')) {
      if (year >= 2022) return buickFitments['enclave_2022_2026'];
      if (year >= 2018) return buickFitments['enclave_2018_2021'];
      return buickFitments['enclave_2008_2017'];
    }
    
    // LaCrosse
    if (modelLower.includes('lacrosse')) {
      if (year >= 2017) return buickFitments['lacrosse_2017_2019'];
      return buickFitments['lacrosse_2010_2016'];
    }
    
    // Regal
    if (modelLower.includes('regal')) {
      if (year >= 2018) return buickFitments['regal_2018_2020'];
      return buickFitments['regal_2011_2017'];
    }
    
    // Envision
    if (modelLower.includes('envision')) {
      if (year >= 2022) return buickFitments['envision_2022_2026'];
      return buickFitments['envision_2016_2021'];
    }
    
    // Simple models
    if (modelLower.includes('encore gx')) return buickFitments['encore_gx'];
    if (modelLower.includes('encore')) return buickFitments['encore'];
    if (modelLower.includes('envista')) return buickFitments['envista'];
    if (modelLower.includes('cascada')) return buickFitments['cascada'];
    if (modelLower.includes('verano')) return buickFitments['verano'];
    if (modelLower.includes('lucerne')) return buickFitments['lucerne'];
    if (modelLower.includes('terraza')) return buickFitments['terraza'];
    if (modelLower.includes('rendezvous')) return buickFitments['rendezvous'];
    if (modelLower.includes('rainier')) return buickFitments['rainier'];
  }
  
  if (make === 'Chevrolet') {
    // Blazer
    if (modelLower === 'blazer') {
      if (year <= 2005) return chevroletFitments['blazer_2000_2005'];
      if (year >= 2023) return chevroletFitments['blazer_2023_2026'];
      return chevroletFitments['blazer_2019_2023'];
    }
    
    // Trailblazer
    if (modelLower.includes('trailblazer')) {
      if (year <= 2009) return chevroletFitments['trailblazer_2002_2009'];
      return chevroletFitments['trailblazer_2021_2026'];
    }
    
    // Silverado variants
    if (modelLower.includes('silverado 3500')) return chevroletFitments['silverado_3500_srw'];
    if (modelLower.includes('silverado 2500')) return chevroletFitments['silverado_2500'];
    if (modelLower.includes('silverado 1500')) return chevroletFitments['silverado_1500'];
    if (modelLower.includes('silverado')) return chevroletFitments['silverado_1500'];
    
    // Suburban
    if (modelLower.includes('suburban 2500')) return chevroletFitments['suburban_2500'];
    if (modelLower.includes('suburban 1500')) {
      if (year >= 2015) return chevroletFitments['suburban_2015_2020'];
      return chevroletFitments['suburban_1500_2000_2014'];
    }
    if (modelLower.includes('suburban')) {
      if (year >= 2015) return chevroletFitments['suburban_2015_2020'];
      return chevroletFitments['suburban_1500_2000_2014'];
    }
    
    // Avalanche
    if (modelLower.includes('avalanche 2500')) return chevroletFitments['avalanche_2500'];
    if (modelLower.includes('avalanche 1500')) return chevroletFitments['avalanche_1500'];
    if (modelLower.includes('avalanche')) {
      if (year >= 2007) return chevroletFitments['avalanche_2007_2013'];
      return chevroletFitments['avalanche_1500'];
    }
    
    // Simple models
    if (modelLower.includes('astro')) return chevroletFitments['astro'];
    if (modelLower.includes('bolt euv')) return chevroletFitments['bolt_euv'];
    if (modelLower.includes('trax')) return chevroletFitments['trax'];
    if (modelLower.includes('volt')) return chevroletFitments['volt'];
  }
  
  return null;
}

// ================================================================================
// MAIN SCRIPT
// ================================================================================

async function main() {
  console.log('Connecting to database...');
  
  const connStr = process.env.POSTGRES_URL || '';
  const pool = new Pool({
    connectionString: connStr,
    ssl: connStr.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });
  
  const client = await pool.connect();
  
  try {
    // Get all missing Buick and Chevrolet records
    const result = await client.query(`
      SELECT id, year, make, model, display_trim, modification_id,
             oem_wheel_sizes, oem_tire_sizes, bolt_pattern
      FROM vehicle_fitments
      WHERE (oem_wheel_sizes = '[]'::jsonb OR oem_wheel_sizes IS NULL 
             OR oem_tire_sizes = '[]'::jsonb OR oem_tire_sizes IS NULL)
        AND make IN ('Buick', 'Chevrolet')
      ORDER BY make, model, year, display_trim
    `);
    
    const records = result.rows;
    console.log(`Found ${records.length} missing records to fix`);
    
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];
    
    for (const record of records) {
      const { id, year, make, model, display_trim } = record;
      
      const fitment = selectFitment(model, year, make);
      
      if (!fitment) {
        errors.push(`No fitment data for ${year} ${make} ${model} (${display_trim})`);
        skipped++;
        continue;
      }
      
      // Format wheel sizes as JSON
      const wheelSizesJson = JSON.stringify(fitment.wheelSizes);
      const tireSizesJson = JSON.stringify(fitment.tireSizes);
      
      // Update the record
      await client.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb,
            oem_tire_sizes = $2::jsonb,
            updated_at = NOW(),
            quality_tier = 'complete'
        WHERE id = $3
      `, [wheelSizesJson, tireSizesJson, id]);
      
      updated++;
      
      if (updated % 50 === 0) {
        console.log(`Progress: ${updated}/${records.length} updated`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total records: ${records.length}`);
    console.log(`Updated: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    
    if (errors.length > 0) {
      console.log('\nErrors/Missing fitment data:');
      // Group errors by model
      const errorsByModel: Record<string, number> = {};
      for (const e of errors) {
        const parts = e.match(/No fitment data for \d+ (\w+) (.+?) \(/);
        if (parts) {
          const key = `${parts[1]} ${parts[2]}`;
          errorsByModel[key] = (errorsByModel[key] || 0) + 1;
        }
      }
      for (const [model, count] of Object.entries(errorsByModel)) {
        console.log(`  ${model}: ${count} records`);
      }
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
