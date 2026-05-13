#!/usr/bin/env node
/**
 * Migration Status Report - Test Vehicles
 * 
 * Compares data between vehicle_fitments and vehicle_fitment_configurations tables
 * for specific test vehicles to validate migration integrity.
 */

import pg from 'pg';
const { Client } = pg;

const POSTGRES_URL = "postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require";

// Test vehicles to check
const TEST_VEHICLES = [
  { year: 2022, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2023, make: 'Ford', model: 'F-150 Lightning' },
  { year: 2022, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2023, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Chevrolet', model: 'Silverado 2500 HD' },
  { year: 2024, make: 'Toyota', model: 'Tacoma' },
  { year: 2024, make: 'Ford', model: 'Bronco' },
  { year: 2024, make: 'Chevrolet', model: 'Corvette' },
  { year: 2024, make: 'BMW', model: 'M3' },
  { year: 2024, make: 'Ram', model: '3500' },
];

async function main() {
  const client = new Client({ connectionString: POSTGRES_URL });
  await client.connect();
  
  console.log('# Migration Status Report - Test Vehicles');
  console.log(`\nGenerated: ${new Date().toISOString()}\n`);
  console.log('---\n');

  // Summary counters
  const summary = {
    total: TEST_VEHICLES.length,
    inFitments: 0,
    inConfigurations: 0,
    inBoth: 0,
    inNeither: 0,
    duplicates: 0,
    conflictingTireSizes: 0,
  };

  for (const vehicle of TEST_VEHICLES) {
    const report = await analyzeVehicle(client, vehicle);
    printVehicleReport(report);
    
    // Update summary
    if (report.fitments.count > 0) summary.inFitments++;
    if (report.configurations.count > 0) summary.inConfigurations++;
    if (report.fitments.count > 0 && report.configurations.count > 0) summary.inBoth++;
    if (report.fitments.count === 0 && report.configurations.count === 0) summary.inNeither++;
    if (report.fitments.duplicates.length > 0 || report.configurations.duplicates.length > 0) summary.duplicates++;
    if (report.conflictingTireSizes.length > 0) summary.conflictingTireSizes++;
  }

  // Print summary
  console.log('\n---\n');
  console.log('## Summary\n');
  console.log(`| Metric | Count |`);
  console.log(`|--------|-------|`);
  console.log(`| Total vehicles tested | ${summary.total} |`);
  console.log(`| In vehicle_fitments | ${summary.inFitments} |`);
  console.log(`| In vehicle_fitment_configurations | ${summary.inConfigurations} |`);
  console.log(`| In both tables | ${summary.inBoth} |`);
  console.log(`| In neither table | ${summary.inNeither} |`);
  console.log(`| With duplicate records | ${summary.duplicates} |`);
  console.log(`| With conflicting tire sizes | ${summary.conflictingTireSizes} |`);

  await client.end();
}

async function analyzeVehicle(client, vehicle) {
  const { year, make, model } = vehicle;
  
  // Query vehicle_fitments table
  const fitmentResult = await client.query(`
    SELECT 
      id, year, make, model, trim, modification,
      bolt_pattern, center_bore, front_wheel_size, rear_wheel_size,
      front_tire_size, rear_tire_size, offset_range,
      created_at, updated_at
    FROM vehicle_fitments
    WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
    ORDER BY trim, modification
  `, [year, make, model]);

  // Query vehicle_fitment_configurations table
  const configResult = await client.query(`
    SELECT 
      id, year, make, model, trim, modification,
      bolt_pattern, center_bore, front_wheel_size, rear_wheel_size,
      front_tire_size, rear_tire_size, offset_range,
      source, created_at, updated_at
    FROM vehicle_fitment_configurations
    WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
    ORDER BY trim, modification
  `, [year, make, model]);

  // Find duplicates in fitments (same trim + modification)
  const fitmentDuplicates = findDuplicates(fitmentResult.rows);
  const configDuplicates = findDuplicates(configResult.rows);

  // Check for conflicting tire sizes between tables
  const conflictingTireSizes = findConflictingTireSizes(fitmentResult.rows, configResult.rows);

  // Extract unique trims/modifications
  const fitmentTrims = extractTrimsModifications(fitmentResult.rows);
  const configTrims = extractTrimsModifications(configResult.rows);

  return {
    vehicle,
    fitments: {
      count: fitmentResult.rows.length,
      rows: fitmentResult.rows,
      trims: fitmentTrims,
      duplicates: fitmentDuplicates,
    },
    configurations: {
      count: configResult.rows.length,
      rows: configResult.rows,
      trims: configTrims,
      duplicates: configDuplicates,
    },
    conflictingTireSizes,
    dataMatches: compareData(fitmentResult.rows, configResult.rows),
  };
}

function findDuplicates(rows) {
  const seen = new Map();
  const duplicates = [];
  
  for (const row of rows) {
    const key = `${row.trim || 'null'}|${row.modification || 'null'}`;
    if (seen.has(key)) {
      duplicates.push({
        trim: row.trim,
        modification: row.modification,
        ids: [seen.get(key).id, row.id],
      });
    } else {
      seen.set(key, row);
    }
  }
  
  return duplicates;
}

function findConflictingTireSizes(fitmentRows, configRows) {
  const conflicts = [];
  
  for (const fit of fitmentRows) {
    const trimMod = `${fit.trim || 'null'}|${fit.modification || 'null'}`;
    
    for (const cfg of configRows) {
      const cfgTrimMod = `${cfg.trim || 'null'}|${cfg.modification || 'null'}`;
      
      if (trimMod === cfgTrimMod) {
        // Same trim/modification - check tire sizes
        if (fit.front_tire_size !== cfg.front_tire_size || 
            fit.rear_tire_size !== cfg.rear_tire_size) {
          conflicts.push({
            trim: fit.trim,
            modification: fit.modification,
            fitmentFront: fit.front_tire_size,
            fitmentRear: fit.rear_tire_size,
            configFront: cfg.front_tire_size,
            configRear: cfg.rear_tire_size,
          });
        }
      }
    }
  }
  
  return conflicts;
}

function extractTrimsModifications(rows) {
  const trims = new Map();
  
  for (const row of rows) {
    const trim = row.trim || '(base)';
    if (!trims.has(trim)) {
      trims.set(trim, new Set());
    }
    if (row.modification) {
      trims.get(trim).add(row.modification);
    }
  }
  
  return Array.from(trims.entries()).map(([trim, mods]) => ({
    trim,
    modifications: Array.from(mods),
  }));
}

function compareData(fitmentRows, configRows) {
  if (fitmentRows.length === 0 || configRows.length === 0) {
    return { comparable: false, matches: 0, mismatches: 0, details: [] };
  }
  
  let matches = 0;
  let mismatches = 0;
  const details = [];
  
  for (const fit of fitmentRows) {
    const trimMod = `${fit.trim || 'null'}|${fit.modification || 'null'}`;
    const matching = configRows.find(cfg => 
      `${cfg.trim || 'null'}|${cfg.modification || 'null'}` === trimMod
    );
    
    if (matching) {
      const fieldsMatch = 
        fit.bolt_pattern === matching.bolt_pattern &&
        fit.front_wheel_size === matching.front_wheel_size &&
        fit.rear_wheel_size === matching.rear_wheel_size &&
        fit.front_tire_size === matching.front_tire_size &&
        fit.rear_tire_size === matching.rear_tire_size;
      
      if (fieldsMatch) {
        matches++;
      } else {
        mismatches++;
        details.push({
          trim: fit.trim,
          modification: fit.modification,
          differences: getDifferences(fit, matching),
        });
      }
    }
  }
  
  return { comparable: true, matches, mismatches, details };
}

function getDifferences(a, b) {
  const diffs = [];
  const fields = ['bolt_pattern', 'front_wheel_size', 'rear_wheel_size', 'front_tire_size', 'rear_tire_size', 'center_bore', 'offset_range'];
  
  for (const field of fields) {
    if (a[field] !== b[field]) {
      diffs.push({ field, fitment: a[field], config: b[field] });
    }
  }
  
  return diffs;
}

function printVehicleReport(report) {
  const { vehicle, fitments, configurations, conflictingTireSizes, dataMatches } = report;
  
  console.log(`## ${vehicle.year} ${vehicle.make} ${vehicle.model}\n`);
  
  // Table existence
  console.log(`### Table Presence\n`);
  console.log(`| Table | Records |`);
  console.log(`|-------|---------|`);
  console.log(`| vehicle_fitments | ${fitments.count} |`);
  console.log(`| vehicle_fitment_configurations | ${configurations.count} |`);
  console.log('');
  
  // Trims/modifications in each table
  if (fitments.trims.length > 0 || configurations.trims.length > 0) {
    console.log(`### Trims & Modifications\n`);
    
    if (fitments.trims.length > 0) {
      console.log(`**vehicle_fitments:**`);
      for (const t of fitments.trims) {
        const mods = t.modifications.length > 0 ? ` → [${t.modifications.join(', ')}]` : '';
        console.log(`- ${t.trim}${mods}`);
      }
      console.log('');
    }
    
    if (configurations.trims.length > 0) {
      console.log(`**vehicle_fitment_configurations:**`);
      for (const t of configurations.trims) {
        const mods = t.modifications.length > 0 ? ` → [${t.modifications.join(', ')}]` : '';
        console.log(`- ${t.trim}${mods}`);
      }
      console.log('');
    }
  }
  
  // Duplicates
  if (fitments.duplicates.length > 0 || configurations.duplicates.length > 0) {
    console.log(`### ⚠️ Duplicate Records\n`);
    
    if (fitments.duplicates.length > 0) {
      console.log(`**vehicle_fitments duplicates:**`);
      for (const d of fitments.duplicates) {
        console.log(`- Trim: "${d.trim || '(null)'}", Mod: "${d.modification || '(null)'}" - IDs: ${d.ids.join(', ')}`);
      }
      console.log('');
    }
    
    if (configurations.duplicates.length > 0) {
      console.log(`**vehicle_fitment_configurations duplicates:**`);
      for (const d of configurations.duplicates) {
        console.log(`- Trim: "${d.trim || '(null)'}", Mod: "${d.modification || '(null)'}" - IDs: ${d.ids.join(', ')}`);
      }
      console.log('');
    }
  }
  
  // Conflicting tire sizes
  if (conflictingTireSizes.length > 0) {
    console.log(`### ⚠️ Conflicting Tire Sizes Between Tables\n`);
    console.log(`| Trim | Modification | Fitments Front | Fitments Rear | Config Front | Config Rear |`);
    console.log(`|------|--------------|----------------|---------------|--------------|-------------|`);
    for (const c of conflictingTireSizes) {
      console.log(`| ${c.trim || '(null)'} | ${c.modification || '(null)'} | ${c.fitmentFront || '-'} | ${c.fitmentRear || '-'} | ${c.configFront || '-'} | ${c.configRear || '-'} |`);
    }
    console.log('');
  }
  
  // Data matching summary
  if (dataMatches.comparable) {
    console.log(`### Data Comparison (Both Tables)\n`);
    console.log(`- Matching records: ${dataMatches.matches}`);
    console.log(`- Mismatched records: ${dataMatches.mismatches}`);
    
    if (dataMatches.details.length > 0) {
      console.log('\n**Field differences:**');
      for (const d of dataMatches.details) {
        console.log(`\n*${d.trim || '(null)'} / ${d.modification || '(null)'}:*`);
        for (const diff of d.differences) {
          console.log(`  - ${diff.field}: fitment="${diff.fitment}" vs config="${diff.config}"`);
        }
      }
    }
    console.log('');
  }
  
  // Sample data from fitments
  if (fitments.rows.length > 0) {
    console.log(`### Sample Data (vehicle_fitments)\n`);
    const sample = fitments.rows[0];
    console.log(`| Field | Value |`);
    console.log(`|-------|-------|`);
    console.log(`| Bolt Pattern | ${sample.bolt_pattern || '-'} |`);
    console.log(`| Center Bore | ${sample.center_bore || '-'} |`);
    console.log(`| Front Wheel | ${sample.front_wheel_size || '-'} |`);
    console.log(`| Rear Wheel | ${sample.rear_wheel_size || '-'} |`);
    console.log(`| Front Tire | ${sample.front_tire_size || '-'} |`);
    console.log(`| Rear Tire | ${sample.rear_tire_size || '-'} |`);
    console.log(`| Offset Range | ${sample.offset_range || '-'} |`);
    console.log('');
  }
  
  console.log('---\n');
}

main().catch(console.error);
