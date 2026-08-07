/**
 * Add dual bolt pattern support for G-Body (5x120 and 5x114.3)
 * 
 * Scott confirmed these fit safely on G-Body cars:
 * - 5x120.65 (OEM)
 * - 5x120 (BMW pattern, close enough)
 * - 5x114.3 (common Japanese/Ford pattern)
 * 
 * We'll add records for each additional pattern to classic_fitments.
 */

require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const DRY_RUN = process.argv.includes('--dry-run');

// G-Body models that support these patterns
const GBODY_MODELS = [
  { make: 'buick', model: 'regal', yearStart: 1978, yearEnd: 1987 },
  { make: 'buick', model: 'grand-national', yearStart: 1982, yearEnd: 1987 },
  { make: 'chevrolet', model: 'monte-carlo', yearStart: 1978, yearEnd: 1988 },
  { make: 'chevrolet', model: 'el-camino', yearStart: 1978, yearEnd: 1987 },
  { make: 'chevrolet', model: 'malibu', yearStart: 1978, yearEnd: 1983 },
  { make: 'oldsmobile', model: 'cutlass-supreme', yearStart: 1978, yearEnd: 1988 },
  { make: 'oldsmobile', model: 'cutlass', yearStart: 1978, yearEnd: 1988 },
  { make: 'pontiac', model: 'grand-prix', yearStart: 1978, yearEnd: 1987 },
  { make: 'pontiac', model: 'bonneville', yearStart: 1978, yearEnd: 1986 },
];

// Additional bolt patterns to support
const ADDITIONAL_PATTERNS = [
  { pattern: '5x120', notes: 'BMW pattern - fits G-Body with hub rings' },
  { pattern: '5x114.3', notes: 'Japanese/Ford pattern - fits G-Body with adapters or hub rings' },
];

async function main() {
  const client = await pool.connect();
  
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== ADDING DUAL BOLT PATTERN SUPPORT ===');
  
  try {
    let added = 0;
    
    for (const pattern of ADDITIONAL_PATTERNS) {
      console.log(`\n--- Adding ${pattern.pattern} support ---`);
      
      for (const model of GBODY_MODELS) {
        const record = {
          id: uuidv4(),
          platform_code: 'G-BODY',
          platform_name: 'GM G-Body (RWD Mid-Size)',
          generation_name: 'G-Body Generation',
          make: model.make,
          model: model.model,
          year_start: model.yearStart,
          year_end: model.yearEnd,
          fitment_level: 'classic-platform',
          fitment_source: 'manual-seed',
          fitment_style: 'stock_baseline',
          confidence: 'high',
          verification_note: pattern.notes,
          requires_clearance_check: true,
          common_modifications: [],
          common_bolt_pattern: pattern.pattern,
          common_center_bore: '70.3', // Still need correct hub rings
          common_thread_size: 'M12x1.5',
          common_seat_type: 'conical',
          rec_wheel_diameter_min: 14,
          rec_wheel_diameter_max: 24, // Expanded to 24" for aftermarket
          rec_wheel_width_min: '6.0',
          rec_wheel_width_max: '12.0', // Expanded width for bigger wheels
          rec_offset_min_mm: -10,
          rec_offset_max_mm: 45, // Slightly expanded offset for modern wheels
          stock_wheel_diameter: model.model === 'grand-national' ? 15 : 14,
          stock_wheel_width: '6.0',
          stock_tire_size: model.model === 'grand-national' ? '215/65R15' : '195/75R14',
          modification_risk: 'medium',
          batch_tag: 'gbody-dual-bolt-2026-07',
          version: 1,
          is_active: true,
          notes: `G-Body with ${pattern.pattern} adapter/hub-ring compatibility. ${pattern.notes}`,
        };
        
        console.log(`  ${model.make} ${model.model}: ${pattern.pattern}`);
        
        if (!DRY_RUN) {
          await client.query(`
            INSERT INTO classic_fitments (
              id, platform_code, platform_name, generation_name, make, model,
              year_start, year_end, fitment_level, fitment_source, fitment_style,
              confidence, verification_note, requires_clearance_check, common_modifications,
              common_bolt_pattern, common_center_bore, common_thread_size, common_seat_type,
              rec_wheel_diameter_min, rec_wheel_diameter_max, rec_wheel_width_min, rec_wheel_width_max,
              rec_offset_min_mm, rec_offset_max_mm, stock_wheel_diameter, stock_wheel_width,
              stock_tire_size, modification_risk, batch_tag, version, is_active, notes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
            )
          `, [
            record.id, record.platform_code, record.platform_name, record.generation_name,
            record.make, record.model, record.year_start, record.year_end,
            record.fitment_level, record.fitment_source, record.fitment_style,
            record.confidence, record.verification_note, record.requires_clearance_check,
            JSON.stringify(record.common_modifications),
            record.common_bolt_pattern, record.common_center_bore, record.common_thread_size,
            record.common_seat_type, record.rec_wheel_diameter_min, record.rec_wheel_diameter_max,
            record.rec_wheel_width_min, record.rec_wheel_width_max,
            record.rec_offset_min_mm, record.rec_offset_max_mm,
            record.stock_wheel_diameter, record.stock_wheel_width,
            record.stock_tire_size, record.modification_risk, record.batch_tag,
            record.version, record.is_active, record.notes
          ]);
        }
        added++;
      }
    }
    
    // Also update existing G-BODY records to expand diameter/width/offset
    console.log('\n--- Updating existing G-BODY records with expanded ranges ---');
    
    if (!DRY_RUN) {
      const { rowCount } = await client.query(`
        UPDATE classic_fitments 
        SET 
          rec_wheel_diameter_max = 24,
          rec_wheel_width_max = '12.0',
          rec_offset_max_mm = 45,
          updated_at = NOW()
        WHERE platform_code = 'G-BODY' 
          AND common_bolt_pattern = '5x120.65'
      `);
      console.log(`Updated ${rowCount} existing G-BODY records`);
    }
    
    console.log(`\n=== ADDED ${added} NEW RECORDS ===`);
    
    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - no changes made. Run without --dry-run to apply.');
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); pool.end(); process.exit(1); });
