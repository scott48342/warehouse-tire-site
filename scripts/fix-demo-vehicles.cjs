const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

const envPath = path.join(__dirname, '../.env.local');
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
});

const client = postgres(process.env.POSTGRES_URL);

// 2024 Chevy Trax specs:
// - LS: 205/65R16 (16" wheels)
// - LT/1RS: 215/55R17 (17" wheels)
// - ACTIV/RS: 225/55R18 (18" wheels)

const TRAX_2024_TRIMS = [
  {
    trim: 'LS',
    tires: ['205/65R16'],
    wheels: [{ diameter: 16, width: 6.5, offset: 41 }],
  },
  {
    trim: 'LT',
    tires: ['215/55R17'],
    wheels: [{ diameter: 17, width: 7, offset: 44 }],
  },
  {
    trim: '1RS',
    tires: ['215/55R17'],
    wheels: [{ diameter: 17, width: 7, offset: 44 }],
  },
  {
    trim: 'ACTIV',
    tires: ['225/55R18'],
    wheels: [{ diameter: 18, width: 7, offset: 44 }],
  },
  {
    trim: 'RS',
    tires: ['225/55R18'],
    wheels: [{ diameter: 18, width: 7, offset: 44 }],
  },
];

async function fix() {
  console.log('=== Fixing 2024 Chevy Trax ===\n');
  
  // Get the base record to copy common fields
  const [baseRecord] = await client`
    SELECT bolt_pattern, center_bore_mm, thread_size, seat_type, offset_min_mm, offset_max_mm, source
    FROM vehicle_fitments 
    WHERE year = 2024 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax'
    LIMIT 1
  `;
  
  if (!baseRecord) {
    console.log('No base record found for 2024 Trax, creating from scratch...');
  }
  
  // Common specs for 2024 Trax (GM subcompact platform)
  const commonSpecs = {
    boltPattern: baseRecord?.bolt_pattern || '5x105',
    centerBore: baseRecord?.center_bore_mm || 56.6,
    threadSize: baseRecord?.thread_size || 'M12x1.5',
    seatType: baseRecord?.seat_type || 'conical',
    offsetMin: 35,
    offsetMax: 50,
  };
  
  for (const trim of TRAX_2024_TRIMS) {
    // Check if exists
    const [existing] = await client`
      SELECT id FROM vehicle_fitments
      WHERE year = 2024 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax'
        AND LOWER(display_trim) = LOWER(${trim.trim})
    `;
    
    if (existing) {
      // Update existing
      await client`
        UPDATE vehicle_fitments SET
          oem_tire_sizes = ${JSON.stringify(trim.tires)}::jsonb,
          oem_wheel_sizes = ${JSON.stringify(trim.wheels)}::jsonb,
          bolt_pattern = ${commonSpecs.boltPattern},
          center_bore_mm = ${commonSpecs.centerBore},
          thread_size = ${commonSpecs.threadSize},
          seat_type = ${commonSpecs.seatType},
          offset_min_mm = ${commonSpecs.offsetMin},
          offset_max_mm = ${commonSpecs.offsetMax},
          updated_at = NOW()
        WHERE id = ${existing.id}
      `;
      console.log(`✓ Updated 2024 Trax ${trim.trim}: ${trim.tires.join(', ')}`);
    } else {
      // Insert new
      await client`
        INSERT INTO vehicle_fitments (
          year, make, model, modification_id, display_trim,
          bolt_pattern, center_bore_mm, thread_size, seat_type,
          offset_min_mm, offset_max_mm,
          oem_wheel_sizes, oem_tire_sizes, source
        ) VALUES (
          2024, 'Chevrolet', 'Trax', ${`trax_2024_${trim.trim.toLowerCase()}`}, ${trim.trim},
          ${commonSpecs.boltPattern}, ${commonSpecs.centerBore}, ${commonSpecs.threadSize}, ${commonSpecs.seatType},
          ${commonSpecs.offsetMin}, ${commonSpecs.offsetMax},
          ${JSON.stringify(trim.wheels)}::jsonb, ${JSON.stringify(trim.tires)}::jsonb,
          'demo-fix'
        )
      `;
      console.log(`+ Inserted 2024 Trax ${trim.trim}: ${trim.tires.join(', ')}`);
    }
  }
  
  // Also fix the base record if it has empty data
  await client`
    UPDATE vehicle_fitments SET
      oem_tire_sizes = '["205/65R16"]'::jsonb,
      oem_wheel_sizes = '[{"diameter":16,"width":6.5,"offset":41}]'::jsonb,
      bolt_pattern = ${commonSpecs.boltPattern},
      center_bore_mm = ${commonSpecs.centerBore},
      updated_at = NOW()
    WHERE year = 2024 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax'
      AND (oem_tire_sizes IS NULL OR oem_tire_sizes = '[]'::jsonb)
  `;
  
  console.log('\n=== Verification ===');
  const verify = await client`
    SELECT display_trim, oem_tire_sizes, bolt_pattern
    FROM vehicle_fitments
    WHERE year = 2024 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'trax'
    ORDER BY display_trim
  `;
  verify.forEach(r => console.log(`  ${r.display_trim}: ${JSON.stringify(r.oem_tire_sizes)} (${r.bolt_pattern})`));
  
  await client.end();
  console.log('\nDone!');
}

fix().catch(e => { console.error(e); process.exit(1); });
