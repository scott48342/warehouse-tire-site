/**
 * Curated Staggered Vehicle Audit
 * 
 * Uses a hand-curated list of KNOWN staggered vehicles (not keyword heuristics).
 * Checks WTD DB for missing rear wheel data, then verifies against USAF/WheelPros.
 * 
 * DRY-RUN ONLY - No DB writes
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env.local') });

// =============================================================================
// CURATED STAGGERED VEHICLES
// These are KNOWN factory staggered fitments, not keyword guesses.
// Format: { make, model, trims: [...], years: [start, end], notes }
// =============================================================================

const CURATED_STAGGERED_VEHICLES = [
  // ===== CHEVROLET =====
  {
    make: 'Chevrolet',
    model: 'Corvette',
    trims: ['Stingray', 'Z51', 'Grand Sport', 'Z06', 'ZR1', 'ZL1'],
    years: [1997, 2026],
    notes: 'All Corvettes since C5 are staggered. C8 is 19F/20R or 20F/21R.'
  },
  {
    make: 'Chevrolet',
    model: 'Camaro',
    trims: ['SS', 'SS 1LE', 'ZL1', 'ZL1 1LE', 'Z/28'],
    years: [2010, 2024],
    notes: '5th/6th gen performance trims. SS 1LE and ZL1 are definitely staggered.'
  },
  
  // ===== FORD =====
  {
    make: 'Ford',
    model: 'Mustang',
    trims: ['GT Performance Pack', 'GT Performance Package', 'Shelby GT350', 'Shelby GT350R', 'Shelby GT500', 'Mach 1', 'Dark Horse'],
    years: [2015, 2026],
    notes: 'S550/S650 performance trims. Base GT is square, PP adds stagger.'
  },
  {
    make: 'Ford',
    model: 'GT',
    trims: ['Base', 'Heritage Edition', 'Studio Collection'],
    years: [2005, 2006],
    notes: 'Ford GT supercar - all staggered.'
  },
  {
    make: 'Ford',
    model: 'GT',
    trims: ['Base', 'Heritage Edition', 'Carbon Series'],
    years: [2017, 2022],
    notes: 'Second gen Ford GT - all staggered.'
  },
  
  // ===== DODGE =====
  {
    make: 'Dodge',
    model: 'Challenger',
    trims: ['Scat Pack Widebody', 'Hellcat', 'Hellcat Widebody', 'Hellcat Redeye', 'SRT Demon', 'SRT Demon 170'],
    years: [2015, 2024],
    notes: 'Widebody and Hellcat variants. Standard Scat Pack is square.'
  },
  {
    make: 'Dodge',
    model: 'Charger',
    trims: ['Scat Pack Widebody', 'Hellcat', 'Hellcat Widebody', 'Hellcat Redeye', 'SRT Jailbreak'],
    years: [2020, 2024],
    notes: 'Widebody variants only. Standard Charger/Scat Pack is square.'
  },
  {
    make: 'Dodge',
    model: 'Viper',
    trims: ['SRT', 'SRT-10', 'GTS', 'ACR', 'ACR-X', 'TA'],
    years: [1992, 2017],
    notes: 'All Vipers are staggered.'
  },
  
  // ===== BMW =====
  {
    make: 'BMW',
    model: 'M2',
    trims: ['M2', 'M2 Competition', 'M2 CS'],
    years: [2016, 2026],
    notes: 'All M2 variants are staggered.'
  },
  {
    make: 'BMW',
    model: 'M3',
    trims: ['M3', 'M3 Competition', 'M3 CS', 'M3 CSL'],
    years: [2000, 2026],
    notes: 'E46, E90, F80, G80 M3s are staggered.'
  },
  {
    make: 'BMW',
    model: 'M4',
    trims: ['M4', 'M4 Competition', 'M4 CS', 'M4 CSL', 'M4 GTS'],
    years: [2015, 2026],
    notes: 'All M4 variants are staggered.'
  },
  {
    make: 'BMW',
    model: 'M5',
    trims: ['M5', 'M5 Competition', 'M5 CS'],
    years: [2000, 2026],
    notes: 'E39, E60, F10, F90 M5s.'
  },
  {
    make: 'BMW',
    model: 'M6',
    trims: ['M6', 'M6 Competition', 'M6 Gran Coupe'],
    years: [2005, 2019],
    notes: 'E63/E64, F12/F13 M6.'
  },
  {
    make: 'BMW',
    model: 'M8',
    trims: ['M8', 'M8 Competition', 'M8 Gran Coupe'],
    years: [2020, 2026],
    notes: 'All M8 variants.'
  },
  {
    make: 'BMW',
    model: 'i8',
    trims: ['Base', 'Roadster'],
    years: [2014, 2020],
    notes: 'BMW i8 hybrid sports car - staggered.'
  },
  
  // ===== MERCEDES-BENZ =====
  {
    make: 'Mercedes-Benz',
    model: 'AMG GT',
    trims: ['AMG GT', 'AMG GT S', 'AMG GT C', 'AMG GT R', 'AMG GT R Pro', 'AMG GT Black Series'],
    years: [2016, 2026],
    notes: 'All AMG GT variants are staggered.'
  },
  {
    make: 'Mercedes-Benz',
    model: 'C-Class',
    trims: ['AMG C 43', 'AMG C 63', 'AMG C 63 S'],
    years: [2015, 2026],
    notes: 'C-Class AMG variants only. Standard C-Class is square.'
  },
  {
    make: 'Mercedes-Benz',
    model: 'E-Class',
    trims: ['AMG E 53', 'AMG E 63', 'AMG E 63 S'],
    years: [2017, 2026],
    notes: 'E-Class AMG variants.'
  },
  {
    make: 'Mercedes-Benz',
    model: 'SL-Class',
    trims: ['SL 55', 'SL 63', 'SL 65', 'AMG SL 55', 'AMG SL 63'],
    years: [2003, 2026],
    notes: 'SL AMG variants.'
  },
  {
    make: 'Mercedes-Benz',
    model: 'SLS AMG',
    trims: ['SLS AMG', 'SLS AMG GT', 'SLS AMG Black Series'],
    years: [2011, 2015],
    notes: 'All SLS AMG variants.'
  },
  
  // ===== PORSCHE =====
  {
    make: 'Porsche',
    model: '911',
    trims: ['Carrera', 'Carrera S', 'Carrera 4', 'Carrera 4S', 'Targa', 'Turbo', 'Turbo S', 'GT3', 'GT3 RS', 'GT2', 'GT2 RS'],
    years: [1999, 2026],
    notes: 'All 996, 997, 991, 992 911s are staggered.'
  },
  {
    make: 'Porsche',
    model: 'Boxster',
    trims: ['Base', 'S', 'GTS', 'Spyder', '25 Years'],
    years: [1997, 2026],
    notes: 'All Boxsters (986, 987, 981, 718) are staggered.'
  },
  {
    make: 'Porsche',
    model: 'Cayman',
    trims: ['Base', 'S', 'GTS', 'GT4', 'GT4 RS'],
    years: [2006, 2026],
    notes: 'All Caymans (987, 981, 718) are staggered.'
  },
  {
    make: 'Porsche',
    model: '718 Boxster',
    trims: ['Base', 'T', 'S', 'GTS', 'GTS 4.0', 'Spyder', 'Spyder RS'],
    years: [2017, 2026],
    notes: '718 Boxster variants.'
  },
  {
    make: 'Porsche',
    model: '718 Cayman',
    trims: ['Base', 'T', 'S', 'GTS', 'GTS 4.0', 'GT4', 'GT4 RS'],
    years: [2017, 2026],
    notes: '718 Cayman variants.'
  },
  
  // ===== NISSAN =====
  {
    make: 'Nissan',
    model: 'GT-R',
    trims: ['Premium', 'Black Edition', 'Track Edition', 'NISMO', 'T-spec'],
    years: [2009, 2026],
    notes: 'All R35 GT-Rs are staggered.'
  },
  {
    make: 'Nissan',
    model: '370Z',
    trims: ['Base', 'Sport', 'Touring', 'NISMO'],
    years: [2009, 2020],
    notes: 'All 370Zs are staggered.'
  },
  {
    make: 'Nissan',
    model: 'Z',
    trims: ['Sport', 'Performance', 'NISMO'],
    years: [2023, 2026],
    notes: 'New Z (RZ34) - all variants staggered.'
  },
  
  // ===== ALFA ROMEO =====
  {
    make: 'Alfa Romeo',
    model: 'Giulia',
    trims: ['Quadrifoglio'],
    years: [2017, 2026],
    notes: 'Only Quadrifoglio is staggered. Standard Giulia is square.'
  },
  {
    make: 'Alfa Romeo',
    model: 'Stelvio',
    trims: ['Quadrifoglio'],
    years: [2018, 2026],
    notes: 'Only Quadrifoglio is staggered.'
  },
  {
    make: 'Alfa Romeo',
    model: '4C',
    trims: ['Base', 'Spider', 'Launch Edition'],
    years: [2015, 2020],
    notes: 'All 4C variants are staggered.'
  },
  
  // ===== AUDI =====
  {
    make: 'Audi',
    model: 'R8',
    trims: ['V10', 'V10 Plus', 'V10 Performance', 'V10 Spyder', 'GT'],
    years: [2008, 2026],
    notes: 'All R8 variants are staggered.'
  },
  
  // ===== LEXUS =====
  {
    make: 'Lexus',
    model: 'LC',
    trims: ['LC 500', 'LC 500h'],
    years: [2018, 2026],
    notes: 'Lexus LC coupe - staggered.'
  },
  {
    make: 'Lexus',
    model: 'LFA',
    trims: ['Base', 'Nurburgring Package'],
    years: [2012, 2012],
    notes: 'Lexus LFA supercar.'
  },
  
  // ===== ACURA =====
  {
    make: 'Acura',
    model: 'NSX',
    trims: ['Base', 'Type S'],
    years: [2017, 2022],
    notes: 'Second gen NSX - staggered.'
  },
  {
    make: 'Acura',
    model: 'NSX',
    trims: ['Base', 'NSX-T', 'Zanardi Edition'],
    years: [1991, 2005],
    notes: 'First gen NSX - staggered.'
  },
  
  // ===== ASTON MARTIN =====
  {
    make: 'Aston Martin',
    model: 'DB11',
    trims: ['V8', 'V12', 'AMR'],
    years: [2017, 2026],
    notes: 'All DB11 variants.'
  },
  {
    make: 'Aston Martin',
    model: 'Vantage',
    trims: ['V8', 'V12', 'AMR', 'F1 Edition'],
    years: [2006, 2026],
    notes: 'All modern Vantage variants.'
  },
  {
    make: 'Aston Martin',
    model: 'DBS',
    trims: ['Superleggera', 'Volante'],
    years: [2019, 2026],
    notes: 'Aston Martin DBS.'
  },
  
  // ===== FERRARI =====
  {
    make: 'Ferrari',
    model: '488',
    trims: ['GTB', 'Spider', 'Pista', 'Pista Spider'],
    years: [2016, 2020],
    notes: 'All 488 variants.'
  },
  {
    make: 'Ferrari',
    model: 'F8',
    trims: ['Tributo', 'Spider'],
    years: [2020, 2026],
    notes: 'All F8 variants.'
  },
  {
    make: 'Ferrari',
    model: '812',
    trims: ['Superfast', 'GTS', 'Competizione'],
    years: [2018, 2026],
    notes: 'All 812 variants.'
  },
  {
    make: 'Ferrari',
    model: 'SF90',
    trims: ['Stradale', 'Spider', 'XX'],
    years: [2020, 2026],
    notes: 'SF90 hybrid supercar.'
  },
  {
    make: 'Ferrari',
    model: '296',
    trims: ['GTB', 'GTS'],
    years: [2022, 2026],
    notes: 'Ferrari 296.'
  },
  
  // ===== LAMBORGHINI =====
  {
    make: 'Lamborghini',
    model: 'Huracan',
    trims: ['LP 610-4', 'LP 580-2', 'Performante', 'EVO', 'STO', 'Tecnica', 'Sterrato'],
    years: [2015, 2026],
    notes: 'All Huracan variants.'
  },
  {
    make: 'Lamborghini',
    model: 'Aventador',
    trims: ['LP 700-4', 'LP 720-4', 'SV', 'S', 'SVJ', 'Ultimae'],
    years: [2012, 2022],
    notes: 'All Aventador variants.'
  },
  {
    make: 'Lamborghini',
    model: 'Revuelto',
    trims: ['Base'],
    years: [2024, 2026],
    notes: 'Aventador successor.'
  },
  
  // ===== MCLAREN =====
  {
    make: 'McLaren',
    model: '720S',
    trims: ['Coupe', 'Spider'],
    years: [2018, 2026],
    notes: 'McLaren 720S.'
  },
  {
    make: 'McLaren',
    model: '570S',
    trims: ['Coupe', 'Spider', 'GT'],
    years: [2016, 2021],
    notes: 'McLaren Sports Series.'
  },
  {
    make: 'McLaren',
    model: 'Artura',
    trims: ['Base', 'Spider'],
    years: [2022, 2026],
    notes: 'McLaren hybrid.'
  },
  
  // ===== LOTUS =====
  {
    make: 'Lotus',
    model: 'Evora',
    trims: ['Base', 'S', '400', 'GT', 'GT410'],
    years: [2010, 2021],
    notes: 'All Evora variants.'
  },
  {
    make: 'Lotus',
    model: 'Emira',
    trims: ['V6', 'i4'],
    years: [2022, 2026],
    notes: 'Lotus Emira.'
  },
  
  // ===== TOYOTA/SUPRA =====
  {
    make: 'Toyota',
    model: 'Supra',
    trims: ['2.0', '3.0', '3.0 Premium', 'A91 Edition'],
    years: [2020, 2026],
    notes: 'A90 Supra - all variants staggered.'
  },
  
  // ===== CHEVROLET CONTINUED =====
  {
    make: 'Chevrolet',
    model: 'Corvette',
    trims: ['E-Ray'],
    years: [2024, 2026],
    notes: 'C8 E-Ray hybrid - staggered.'
  },
];

function hasRearWheelData(wheelSizes) {
  if (!wheelSizes || !Array.isArray(wheelSizes)) return false;
  
  return wheelSizes.some(ws => {
    if (!ws || typeof ws !== 'object') return false;
    
    // Check for explicit rear data
    if (ws.rearWidth || ws.rearDiameter) return true;
    
    // Check for front/rear sub-objects with different widths
    if (ws.front && ws.rear) {
      if (ws.front.width && ws.rear.width) return true;
    }
    
    // Check for position-tagged entries
    if (ws.position === 'rear') return true;
    
    return false;
  });
}

function matchesCuratedVehicle(record, curatedList) {
  for (const curated of curatedList) {
    // Check make (case-insensitive)
    if (record.make.toLowerCase() !== curated.make.toLowerCase()) continue;
    
    // Check model (case-insensitive, partial match)
    const modelLower = record.model.toLowerCase();
    const curatedModelLower = curated.model.toLowerCase();
    if (!modelLower.includes(curatedModelLower) && !curatedModelLower.includes(modelLower)) continue;
    
    // Check year range
    if (record.year < curated.years[0] || record.year > curated.years[1]) continue;
    
    // Check trim (if specified, partial match)
    if (curated.trims && curated.trims.length > 0) {
      const trimLower = (record.trim || '').toLowerCase();
      const matchesTrim = curated.trims.some(t => 
        trimLower.includes(t.toLowerCase()) || t.toLowerCase().includes(trimLower)
      );
      // If trims specified but none match, this isn't a match
      // But be lenient - if trim is empty/Base, still consider it
      if (!matchesTrim && trimLower && trimLower !== 'base') {
        continue;
      }
    }
    
    return curated;
  }
  return null;
}

async function main() {
  console.log('\n🔍 Curated Staggered Vehicle Audit');
  console.log('Mode: DRY-RUN (Analysis Only)');
  console.log('='.repeat(80));
  console.log(`\nUsing curated list of ${CURATED_STAGGERED_VEHICLES.length} known staggered vehicle patterns\n`);

  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Step 1: Find all records matching curated staggered vehicles
    console.log('📊 Step 1: Finding records matching curated staggered vehicles...\n');
    
    const allRecords = await pool.query(`
      SELECT 
        id, year, make, model, display_trim, modification_id,
        oem_wheel_sizes, oem_tire_sizes, source, source_record_id,
        offset_min_mm, offset_max_mm, bolt_pattern, center_bore_mm
      FROM vehicle_fitments
      WHERE year >= 1990 AND year <= 2026
      ORDER BY year DESC, make, model, display_trim
    `);

    console.log(`Checking ${allRecords.rows.length} total records...\n`);

    const matchedRecords = [];
    const missingRear = [];
    const hasRear = [];
    
    for (const row of allRecords.rows) {
      const record = {
        id: row.id,
        year: row.year,
        make: row.make,
        model: row.model,
        trim: row.display_trim,
        modificationId: row.modification_id,
        source: row.source,
        wheelSizes: row.oem_wheel_sizes,
        tireSizes: row.oem_tire_sizes,
        offsetMin: row.offset_min_mm,
        offsetMax: row.offset_max_mm,
        boltPattern: row.bolt_pattern,
        centerBore: row.center_bore_mm,
      };
      
      const curatedMatch = matchesCuratedVehicle(record, CURATED_STAGGERED_VEHICLES);
      if (!curatedMatch) continue;
      
      record.curatedNotes = curatedMatch.notes;
      record.curatedTrims = curatedMatch.trims;
      matchedRecords.push(record);
      
      if (hasRearWheelData(row.oem_wheel_sizes)) {
        hasRear.push(record);
      } else {
        missingRear.push(record);
      }
    }

    console.log(`Found ${matchedRecords.length} records matching curated staggered vehicles`);
    console.log(`  ✅ With rear wheel data: ${hasRear.length}`);
    console.log(`  ❌ Missing rear wheel data: ${missingRear.length}\n`);

    // Step 2: Group missing records by Y/M/M/T
    console.log('📊 Step 2: Grouping gaps by vehicle...\n');
    
    const byMakeModel = new Map();
    for (const r of missingRear) {
      const key = `${r.make}|${r.model}`;
      if (!byMakeModel.has(key)) {
        byMakeModel.set(key, {
          make: r.make,
          model: r.model,
          years: new Set(),
          trims: new Set(),
          records: [],
          sources: new Set(),
          notes: r.curatedNotes,
        });
      }
      const mm = byMakeModel.get(key);
      mm.years.add(r.year);
      mm.trims.add(r.trim);
      mm.records.push(r);
      mm.sources.add(r.source);
    }

    // Sort by record count
    const sortedMM = [...byMakeModel.values()]
      .sort((a, b) => b.records.length - a.records.length);

    console.log('Vehicles Missing Rear Wheel Data:\n');
    console.log('Make/Model | Records | Years | Trims | Sources');
    console.log('-'.repeat(100));
    
    for (const mm of sortedMM) {
      const years = [...mm.years].sort();
      const yearRange = years.length > 5 
        ? `${Math.min(...years)}-${Math.max(...years)}` 
        : years.join(',');
      const trimList = [...mm.trims].slice(0, 4).join(', ');
      const sources = [...mm.sources].join(', ');
      console.log(`${mm.make} ${mm.model.padEnd(20)} | ${String(mm.records.length).padStart(7)} | ${yearRange.padEnd(12)} | ${trimList.padEnd(35)} | ${sources}`);
    }

    // Step 3: Check for existing rear data that can be used as evidence
    console.log('\n\n📊 Step 3: Checking for WTD evidence (same vehicle with rear data)...\n');
    
    const evidenceByYMMT = new Map();
    for (const r of hasRear) {
      const key = `${r.year}|${r.make}|${r.model}|${r.trim}`;
      if (!evidenceByYMMT.has(key)) {
        evidenceByYMMT.set(key, []);
      }
      evidenceByYMMT.get(key).push(r);
    }

    // Check missing records for exact match evidence
    let exactMatchCount = 0;
    let siblingMatchCount = 0;
    const exactMatches = [];
    const siblingMatches = [];
    
    for (const r of missingRear) {
      const exactKey = `${r.year}|${r.make}|${r.model}|${r.trim}`;
      
      // Check exact Y/M/M/T match
      if (evidenceByYMMT.has(exactKey)) {
        exactMatchCount++;
        exactMatches.push({
          ...r,
          evidenceRecords: evidenceByYMMT.get(exactKey),
        });
        continue;
      }
      
      // Check sibling (same Y/M/M, different trim)
      for (const [key, evidence] of evidenceByYMMT) {
        const [eYear, eMake, eModel, eTrim] = key.split('|');
        if (parseInt(eYear) === r.year && eMake === r.make && eModel === r.model && eTrim !== r.trim) {
          siblingMatchCount++;
          siblingMatches.push({
            ...r,
            siblingTrim: eTrim,
            siblingEvidence: evidence,
          });
          break;
        }
      }
    }

    console.log('WTD Internal Evidence:');
    console.log(`  ✅ Exact Y/M/M/T match available: ${exactMatchCount} records (SAFE to merge)`);
    console.log(`  ⚠️  Sibling trim has data: ${siblingMatchCount} records (supporting evidence only)`);
    console.log(`  ❌ No WTD evidence: ${missingRear.length - exactMatchCount - siblingMatchCount} records\n`);

    // Step 4: Summary and next steps
    console.log('='.repeat(80));
    console.log('📋 SUMMARY');
    console.log('='.repeat(80));
    
    const totalMissing = missingRear.length;
    const needsExternal = totalMissing - exactMatchCount;
    
    console.log(`
Total curated staggered records: ${matchedRecords.length}
  ├─ Already have rear data: ${hasRear.length}
  └─ Missing rear wheel data: ${missingRear.length}

Classification:
  ├─ SAFE AUTO-FIX (exact Y/M/M/T): ${exactMatchCount} records
  ├─ Sibling evidence (ref only): ${siblingMatchCount} records  
  └─ Needs USAF/WheelPros check: ${needsExternal - siblingMatchCount} records
`);

    // Show exact match details (these are safe to fix)
    if (exactMatches.length > 0) {
      console.log('\n✅ SAFE AUTO-FIX CANDIDATES (Exact Y/M/M/T Match):');
      console.log('-'.repeat(80));
      for (const m of exactMatches.slice(0, 20)) {
        const ev = m.evidenceRecords[0];
        console.log(`  ${m.year} ${m.make} ${m.model} ${m.trim}`);
        console.log(`    Missing source: ${m.source}`);
        console.log(`    Evidence source: ${ev.source}`);
        console.log(`    Evidence wheel sizes: ${JSON.stringify(ev.wheelSizes).slice(0, 100)}...`);
        console.log();
      }
      if (exactMatches.length > 20) {
        console.log(`  ... and ${exactMatches.length - 20} more\n`);
      }
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      curatedVehicleCount: CURATED_STAGGERED_VEHICLES.length,
      summary: {
        totalMatched: matchedRecords.length,
        hasRearData: hasRear.length,
        missingRearData: missingRear.length,
        safeAutoFix: exactMatchCount,
        siblingEvidence: siblingMatchCount,
        needsExternalCheck: needsExternal - siblingMatchCount,
      },
      byMakeModel: sortedMM.map(mm => ({
        make: mm.make,
        model: mm.model,
        recordCount: mm.records.length,
        years: [...mm.years].sort(),
        trims: [...mm.trims],
        sources: [...mm.sources],
        notes: mm.notes,
      })),
      exactMatches: exactMatches.map(m => ({
        id: m.id,
        year: m.year,
        make: m.make,
        model: m.model,
        trim: m.trim,
        source: m.source,
        evidenceSource: m.evidenceRecords[0].source,
        evidenceWheelSizes: m.evidenceRecords[0].wheelSizes,
      })),
      siblingMatches: siblingMatches.slice(0, 100).map(m => ({
        id: m.id,
        year: m.year,
        make: m.make,
        model: m.model,
        trim: m.trim,
        source: m.source,
        siblingTrim: m.siblingTrim,
      })),
      allMissingRecords: missingRear.map(r => ({
        id: r.id,
        year: r.year,
        make: r.make,
        model: r.model,
        trim: r.trim,
        source: r.source,
        wheelSizes: r.wheelSizes,
        tireSizes: r.tireSizes,
      })),
    };

    const reportPath = join(__dirname, 'curated-staggered-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Next steps
    console.log('\n' + '='.repeat(80));
    console.log('📋 RECOMMENDED NEXT STEPS');
    console.log('='.repeat(80));
    console.log(`
1. SAFE TO FIX NOW: ${exactMatchCount} records
   → Exact Y/M/M/T matches from different sources
   → Run merge script with --apply flag

2. QUERY USAF: ${needsExternal} records
   → Use GetVehicleOptions API for explicit front/rear tire pairings
   → Verify against curated list

3. CHECK WHEELPROS/TECHFEED:
   → Cross-reference with WheelPros fitment compatibility
   → Look for explicit staggered wheel specs

4. REMAINING → MANUAL REVIEW:
   → Check OEM service manuals
   → Verify with manufacturer specs
`);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();
