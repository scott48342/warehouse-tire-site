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
      id, year, make, model, modification_id,
      raw_trim, display_trim, submodel,
      bolt_pattern, center_bore_mm, thread_size, seat_type,
      offset_min_mm, offset_max_mm,
      oem_wheel_sizes, oem_tire_sizes,
      source, quality_tier, certification_status,
      created_at, updated_at
    FROM vehicle_fitments
    WHERE year = $1 AND make ILIKE $2 AND model ILIKE $3
    ORDER BY display_trim, submodel
  `, [year, make, model]);

  // Query vehicle_fitment_configurations table (uses make_key/model_key)
  const configResult = await client.query(`
    SELECT 
      id, vehicle_fitment_id, year, make_key, model_key,
      modification_id, display_trim,
      configuration_key, configuration_label,
      wheel_diameter, wheel_width, wheel_offset_mm,
      tire_size, axle_position,
      is_default, is_optional,
      source, source_confidence, source_notes,
      created_at, updated_at
    FROM vehicle_fitment_configurations
    WHERE year = $1 AND (make_key ILIKE $2 OR make_key ILIKE $4) AND (model_key ILIKE $3 OR model_key ILIKE $5)
    ORDER BY display_trim, configuration_key
  `, [year, make, model, make.toLowerCase(), model.toLowerCase().replace(/ /g, '-')]);

  // Find duplicates in fitments (same display_trim + submodel)
  const fitmentDuplicates = findFitmentDuplicates(fitmentResult.rows);
  const configDuplicates = findConfigDuplicates(configResult.rows);

  // Extract unique trims/modifications
  const fitmentTrims = extractFitmentTrims(fitmentResult.rows);
  const configTrims = extractConfigTrims(configResult.rows);

  // Find conflicting tire sizes (between fitments oem_tire_sizes and config tire_size)
  const conflictingTireSizes = findConflictingTireSizes(fitmentResult.rows, configResult.rows);

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
    linkageStatus: checkLinkage(fitmentResult.rows, configResult.rows),
  };
}

function findFitmentDuplicates(rows) {
  const seen = new Map();
  const duplicates = [];
  
  for (const row of rows) {
    const key = `${row.display_trim || 'null'}|${row.submodel || 'null'}|${row.modification_id || 'null'}`;
    if (seen.has(key)) {
      duplicates.push({
        display_trim: row.display_trim,
        submodel: row.submodel,
        modification_id: row.modification_id,
        ids: [seen.get(key).id, row.id],
      });
    } else {
      seen.set(key, row);
    }
  }
  
  return duplicates;
}

function findConfigDuplicates(rows) {
  const seen = new Map();
  const duplicates = [];
  
  for (const row of rows) {
    const key = `${row.display_trim || 'null'}|${row.configuration_key || 'null'}|${row.axle_position || 'null'}`;
    if (seen.has(key)) {
      duplicates.push({
        display_trim: row.display_trim,
        configuration_key: row.configuration_key,
        axle_position: row.axle_position,
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
  
  // Group config rows by vehicle_fitment_id
  const configByFitmentId = new Map();
  for (const cfg of configRows) {
    if (cfg.vehicle_fitment_id) {
      if (!configByFitmentId.has(cfg.vehicle_fitment_id)) {
        configByFitmentId.set(cfg.vehicle_fitment_id, []);
      }
      configByFitmentId.get(cfg.vehicle_fitment_id).push(cfg);
    }
  }
  
  // Check each fitment's OEM sizes against linked configs
  for (const fit of fitmentRows) {
    const linkedConfigs = configByFitmentId.get(fit.id) || [];
    const oemSizes = fit.oem_tire_sizes || [];
    
    for (const cfg of linkedConfigs) {
      if (cfg.tire_size && oemSizes.length > 0 && !oemSizes.includes(cfg.tire_size)) {
        conflicts.push({
          fitment_id: fit.id,
          display_trim: fit.display_trim,
          oem_tire_sizes: oemSizes,
          config_tire_size: cfg.tire_size,
          config_key: cfg.configuration_key,
        });
      }
    }
  }
  
  return conflicts;
}

function extractFitmentTrims(rows) {
  const trims = new Map();
  
  for (const row of rows) {
    const trim = row.display_trim || '(base)';
    if (!trims.has(trim)) {
      trims.set(trim, { submodels: new Set(), modificationIds: new Set() });
    }
    if (row.submodel) trims.get(trim).submodels.add(row.submodel);
    if (row.modification_id) trims.get(trim).modificationIds.add(row.modification_id);
  }
  
  return Array.from(trims.entries()).map(([trim, data]) => ({
    trim,
    submodels: Array.from(data.submodels),
    modificationIds: Array.from(data.modificationIds),
  }));
}

function extractConfigTrims(rows) {
  const trims = new Map();
  
  for (const row of rows) {
    const trim = row.display_trim || '(base)';
    if (!trims.has(trim)) {
      trims.set(trim, new Set());
    }
    if (row.configuration_key) {
      trims.get(trim).add(row.configuration_key);
    }
  }
  
  return Array.from(trims.entries()).map(([trim, configs]) => ({
    trim,
    configurations: Array.from(configs),
  }));
}

function checkLinkage(fitmentRows, configRows) {
  const fitmentIds = new Set(fitmentRows.map(r => r.id));
  const linkedFitmentIds = new Set(configRows.filter(r => r.vehicle_fitment_id).map(r => r.vehicle_fitment_id));
  
  // Configs linked to fitments that exist
  const validLinks = [...linkedFitmentIds].filter(id => fitmentIds.has(id)).length;
  // Configs linked to non-existent fitments
  const brokenLinks = [...linkedFitmentIds].filter(id => !fitmentIds.has(id)).length;
  // Configs with no linkage
  const unlinked = configRows.filter(r => !r.vehicle_fitment_id).length;
  
  return {
    totalConfigs: configRows.length,
    validLinks,
    brokenLinks,
    unlinked,
    fitmentsCovered: [...fitmentIds].filter(id => linkedFitmentIds.has(id)).length,
    fitmentsUncovered: fitmentRows.length - [...fitmentIds].filter(id => linkedFitmentIds.has(id)).length,
  };
}

function printVehicleReport(report) {
  const { vehicle, fitments, configurations, conflictingTireSizes, linkageStatus } = report;
  
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
        let details = [];
        if (t.submodels.length > 0) details.push(`submodels: ${t.submodels.join(', ')}`);
        if (t.modificationIds.length > 0) details.push(`mods: ${t.modificationIds.length}`);
        const extra = details.length > 0 ? ` (${details.join('; ')})` : '';
        console.log(`- ${t.trim}${extra}`);
      }
      console.log('');
    }
    
    if (configurations.trims.length > 0) {
      console.log(`**vehicle_fitment_configurations:**`);
      for (const t of configurations.trims) {
        const configs = t.configurations.length > 0 ? ` → configs: ${t.configurations.join(', ')}` : '';
        console.log(`- ${t.trim}${configs}`);
      }
      console.log('');
    }
  }
  
  // Linkage status between tables
  if (configurations.count > 0 || fitments.count > 0) {
    console.log(`### Linkage Status\n`);
    console.log(`| Metric | Count |`);
    console.log(`|--------|-------|`);
    console.log(`| Configs with valid fitment link | ${linkageStatus.validLinks} |`);
    console.log(`| Configs with broken link | ${linkageStatus.brokenLinks} |`);
    console.log(`| Configs with no link | ${linkageStatus.unlinked} |`);
    console.log(`| Fitments covered by configs | ${linkageStatus.fitmentsCovered} |`);
    console.log(`| Fitments without configs | ${linkageStatus.fitmentsUncovered} |`);
    console.log('');
  }
  
  // Duplicates
  if (fitments.duplicates.length > 0 || configurations.duplicates.length > 0) {
    console.log(`### ⚠️ Duplicate Records\n`);
    
    if (fitments.duplicates.length > 0) {
      console.log(`**vehicle_fitments duplicates:**`);
      for (const d of fitments.duplicates) {
        console.log(`- Trim: "${d.display_trim || '(null)'}", Submodel: "${d.submodel || '(null)'}" - IDs: ${d.ids.join(', ')}`);
      }
      console.log('');
    }
    
    if (configurations.duplicates.length > 0) {
      console.log(`**vehicle_fitment_configurations duplicates:**`);
      for (const d of configurations.duplicates) {
        console.log(`- Trim: "${d.display_trim || '(null)'}", Config: "${d.configuration_key || '(null)'}" - IDs: ${d.ids.join(', ')}`);
      }
      console.log('');
    }
  }
  
  // Conflicting tire sizes
  if (conflictingTireSizes.length > 0) {
    console.log(`### ⚠️ Conflicting Tire Sizes\n`);
    console.log(`Config tire_size not in fitment's oem_tire_sizes:\n`);
    for (const c of conflictingTireSizes) {
      console.log(`- **${c.display_trim || '(base)'}** [${c.config_key}]: Config has "${c.config_tire_size}", OEM sizes: [${c.oem_tire_sizes.join(', ')}]`);
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
    console.log(`| Center Bore | ${sample.center_bore_mm || '-'} mm |`);
    console.log(`| Thread Size | ${sample.thread_size || '-'} |`);
    console.log(`| Offset Range | ${sample.offset_min_mm || '?'} - ${sample.offset_max_mm || '?'} mm |`);
    console.log(`| OEM Wheel Sizes | ${formatWheelSizes(sample.oem_wheel_sizes)} |`);
    console.log(`| OEM Tire Sizes | ${formatTireSizes(sample.oem_tire_sizes)} |`);
    console.log(`| Quality Tier | ${sample.quality_tier || '-'} |`);
    console.log(`| Certification | ${sample.certification_status || '-'} |`);
    console.log('');
  }
  
  // Sample config data
  if (configurations.rows.length > 0) {
    console.log(`### Sample Data (vehicle_fitment_configurations)\n`);
    const sample = configurations.rows[0];
    console.log(`| Field | Value |`);
    console.log(`|-------|-------|`);
    console.log(`| Configuration | ${sample.configuration_label || sample.configuration_key || '-'} |`);
    console.log(`| Wheel Diameter | ${sample.wheel_diameter || '-'}" |`);
    console.log(`| Wheel Width | ${sample.wheel_width || '-'}" |`);
    console.log(`| Wheel Offset | ${sample.wheel_offset_mm || '-'} mm |`);
    console.log(`| Tire Size | ${sample.tire_size || '-'} |`);
    console.log(`| Axle Position | ${sample.axle_position || '-'} |`);
    console.log(`| Source | ${sample.source || '-'} (${sample.source_confidence || '-'}) |`);
    console.log('');
  }
  
  console.log('---\n');
}

function formatWheelSizes(wheelSizes) {
  if (!wheelSizes || !Array.isArray(wheelSizes) || wheelSizes.length === 0) return '-';
  return wheelSizes.map(w => `${w.width}x${w.diameter}`).join(', ');
}

function formatTireSizes(tireSizes) {
  if (!tireSizes) return '-';
  if (typeof tireSizes === 'string') return tireSizes;
  if (Array.isArray(tireSizes)) {
    return tireSizes.map(t => {
      if (typeof t === 'string') return t;
      if (typeof t === 'object' && t !== null) {
        // Handle object format like {size: "275/70R18", axle: "front"}
        return t.size || t.tire_size || JSON.stringify(t);
      }
      return String(t);
    }).join(', ');
  }
  return String(tireSizes);
}

main().catch(console.error);
