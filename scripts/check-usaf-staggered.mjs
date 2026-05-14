/**
 * Check USAF for staggered tire/wheel data on curated vehicles
 * 
 * Uses GetVehicleOptions to find explicit front/rear tire pairings.
 * DRY-RUN ONLY - No DB writes
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

// Top staggered vehicles to check
const VEHICLES_TO_CHECK = [
  // High priority - most records missing
  { year: 2024, make: 'Porsche', model: '911' },
  { year: 2024, make: 'Porsche', model: 'Boxster' },
  { year: 2024, make: 'Porsche', model: '718 Boxster' },
  { year: 2024, make: 'Porsche', model: 'Cayman' },
  { year: 2024, make: 'Porsche', model: '718 Cayman' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'Nissan', model: 'GT-R' },
  { year: 2024, make: 'Nissan', model: 'Z' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'BMW', model: 'M4' },
  { year: 2024, make: 'BMW', model: 'M5' },
  { year: 2024, make: 'Chevrolet', model: 'Camaro' },
  { year: 2024, make: 'Ford', model: 'Mustang' },
  { year: 2024, make: 'Dodge', model: 'Challenger' },
  { year: 2024, make: 'Dodge', model: 'Charger' },
  { year: 2024, make: 'Toyota', model: 'Supra' },
  { year: 2024, make: 'Toyota', model: 'GR Supra' },
  { year: 2024, make: 'Alfa Romeo', model: 'Giulia' },
  { year: 2024, make: 'Audi', model: 'R8' },
  { year: 2024, make: 'Mercedes-Benz', model: 'AMG GT' },
  { year: 2023, make: 'Nissan', model: '370Z' },
  { year: 2020, make: 'Nissan', model: '370Z' },
  { year: 2023, make: 'Lamborghini', model: 'Huracan' },
  { year: 2023, make: 'Ferrari', model: '296' },
  { year: 2023, make: 'McLaren', model: 'Artura' },
];

// USAF SOAP client
async function callUSAF(action, body) {
  const username = process.env.USAUTOFORCE_USERNAME;
  const password = process.env.USAUTOFORCE_PASSWORD;
  
  if (!username || !password) {
    throw new Error('USAUTOFORCE credentials not configured');
  }

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" 
               xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
               xmlns:tns="https://services.usautoforce.com">
  <soap:Header>
    <tns:AuthHeader>
      <tns:UserName>${username}</tns:UserName>
      <tns:Password>${password}</tns:Password>
    </tns:AuthHeader>
  </soap:Header>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch('https://services.usautoforce.com/tws/aiservices.asmx', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `https://services.usautoforce.com/${action}`,
    },
    body: soapEnvelope,
  });

  if (!response.ok) {
    throw new Error(`USAF API error: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

// Parse USAF GetVehicleOptions response
function parseVehicleOptions(xmlText) {
  // Extract tire sizes from the response
  const results = [];
  
  // Look for TireOptionDto entries
  const optionRegex = /<TireOptionDto>([\s\S]*?)<\/TireOptionDto>/g;
  let match;
  
  while ((match = optionRegex.exec(xmlText)) !== null) {
    const optionXml = match[1];
    
    const getValue = (tag) => {
      const m = optionXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return m ? m[1] : null;
    };
    
    results.push({
      position: getValue('Position'),
      tireSize: getValue('TireSize'),
      rimSize: getValue('RimSize'),
      rimWidth: getValue('RimWidth'),
      aspectRatio: getValue('AspectRatio'),
      sectionWidth: getValue('SectionWidth'),
    });
  }
  
  return results;
}

// Check if USAF has front/rear differentiation
function analyzeStaggered(options) {
  const frontSizes = options.filter(o => o.position === 'Front' || o.position === 'F');
  const rearSizes = options.filter(o => o.position === 'Rear' || o.position === 'R');
  const allSizes = options.filter(o => !o.position || o.position === 'All' || o.position === 'A');
  
  const hasExplicitFrontRear = frontSizes.length > 0 && rearSizes.length > 0;
  
  // Check for different front/rear sizes
  let isDifferentSizes = false;
  if (hasExplicitFrontRear) {
    const frontTires = new Set(frontSizes.map(f => f.tireSize));
    const rearTires = new Set(rearSizes.map(r => r.tireSize));
    isDifferentSizes = ![...frontTires].every(t => rearTires.has(t));
  }
  
  return {
    hasExplicitFrontRear,
    isDifferentSizes,
    frontSizes: frontSizes.map(f => ({ tire: f.tireSize, rim: f.rimSize, width: f.rimWidth })),
    rearSizes: rearSizes.map(r => ({ tire: r.tireSize, rim: r.rimSize, width: r.rimWidth })),
    allSizes: allSizes.map(a => ({ tire: a.tireSize, rim: a.rimSize, width: a.rimWidth })),
    totalOptions: options.length,
  };
}

async function main() {
  console.log('\n🔍 USAF Staggered Data Check');
  console.log('Mode: DRY-RUN (Query Only)');
  console.log('='.repeat(80));
  console.log(`\nChecking ${VEHICLES_TO_CHECK.length} curated staggered vehicles against USAF...\n`);

  const results = [];
  const errors = [];
  let hasStaggeredData = 0;
  let noStaggeredData = 0;

  for (const vehicle of VEHICLES_TO_CHECK) {
    const label = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    process.stdout.write(`  Checking ${label}... `);

    try {
      // Call USAF GetVehicleOptions
      const body = `<tns:GetVehicleOptions>
        <tns:year>${vehicle.year}</tns:year>
        <tns:make>${vehicle.make}</tns:make>
        <tns:model>${vehicle.model}</tns:model>
      </tns:GetVehicleOptions>`;

      const response = await callUSAF('GetVehicleOptions', body);
      const options = parseVehicleOptions(response);
      const analysis = analyzeStaggered(options);

      if (analysis.hasExplicitFrontRear) {
        hasStaggeredData++;
        console.log(`✅ HAS FRONT/REAR DATA (${analysis.frontSizes.length}F/${analysis.rearSizes.length}R)`);
        
        results.push({
          ...vehicle,
          status: 'HAS_STAGGERED',
          ...analysis,
        });
      } else if (options.length > 0) {
        noStaggeredData++;
        console.log(`⚠️  Has data but NO front/rear split (${options.length} options)`);
        
        results.push({
          ...vehicle,
          status: 'NO_FRONT_REAR_SPLIT',
          ...analysis,
        });
      } else {
        noStaggeredData++;
        console.log(`❌ No data from USAF`);
        
        results.push({
          ...vehicle,
          status: 'NO_DATA',
          ...analysis,
        });
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errors.push({ ...vehicle, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 USAF CHECK SUMMARY');
  console.log('='.repeat(80));
  console.log(`
Vehicles checked: ${VEHICLES_TO_CHECK.length}
  ✅ Has explicit front/rear data: ${hasStaggeredData}
  ⚠️  No front/rear differentiation: ${noStaggeredData}
  ❌ Errors: ${errors.length}
`);

  // Show vehicles with staggered data
  const withStaggered = results.filter(r => r.status === 'HAS_STAGGERED');
  if (withStaggered.length > 0) {
    console.log('\n✅ USAF HAS STAGGERED DATA FOR:');
    console.log('-'.repeat(80));
    for (const v of withStaggered) {
      console.log(`\n${v.year} ${v.make} ${v.model}:`);
      console.log('  Front:');
      for (const f of v.frontSizes.slice(0, 3)) {
        console.log(`    ${f.tire} on ${f.rim}" x ${f.width}"`);
      }
      console.log('  Rear:');
      for (const r of v.rearSizes.slice(0, 3)) {
        console.log(`    ${r.tire} on ${r.rim}" x ${r.width}"`);
      }
      if (v.frontSizes.length > 3 || v.rearSizes.length > 3) {
        console.log(`  ... and more options`);
      }
    }
  }

  // Show vehicles without front/rear split
  const noSplit = results.filter(r => r.status === 'NO_FRONT_REAR_SPLIT');
  if (noSplit.length > 0) {
    console.log('\n\n⚠️  USAF HAS DATA BUT NO FRONT/REAR SPLIT:');
    console.log('-'.repeat(80));
    for (const v of noSplit) {
      console.log(`  ${v.year} ${v.make} ${v.model}: ${v.totalOptions} options (all same position)`);
      if (v.allSizes.length > 0) {
        console.log(`    Sample: ${v.allSizes[0].tire}`);
      }
    }
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      checked: VEHICLES_TO_CHECK.length,
      hasStaggeredData,
      noStaggeredData,
      errors: errors.length,
    },
    results,
    errors,
  };

  const reportPath = join(__dirname, 'usaf-staggered-check.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);

  console.log('\n' + '='.repeat(80));
  console.log('📋 NEXT STEPS');
  console.log('='.repeat(80));
  console.log(`
1. For vehicles WITH USAF staggered data:
   → Can create verified staggered records
   → Use USAF as authoritative source for front/rear specs

2. For vehicles WITHOUT front/rear split:
   → Need WheelPros/Techfeed cross-reference
   → Or manual OEM verification

3. For errors/no data:
   → Try alternative years
   → Manual research required
`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
