/**
 * Check current vehicle configuration coverage
 */

import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import pg from "pg";
const { Pool } = pg;

async function main() {
  const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
  
  try {
    // Get coverage by make
    const byMakeResult = await pool.query(`
      SELECT make_key, COUNT(DISTINCT CONCAT(year, '-', model_key)) as vehicle_combos, COUNT(*) as configs
      FROM vehicle_fitment_configurations
      GROUP BY make_key
      ORDER BY configs DESC
    `);
    
    console.log('=== Current Coverage by Make ===');
    for (const row of byMakeResult.rows) {
      console.log(`${row.make_key}: ${row.vehicle_combos} vehicles, ${row.configs} configs`);
    }
    
    // Check Ram, GMC, Subaru, Mazda specifically
    const targetMakes = ['ram', 'gmc', 'subaru', 'mazda'];
    console.log('\n=== Target Makes for Batch 6 ===');
    
    for (const make of targetMakes) {
      const countResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations WHERE make_key = $1`,
        [make]
      );
      const modelsResult = await pool.query(
        `SELECT model_key, COUNT(*) as cnt FROM vehicle_fitment_configurations WHERE make_key = $1 GROUP BY model_key`,
        [make]
      );
      
      console.log(`${make}: ${countResult.rows[0].cnt} configs across ${modelsResult.rows.length} models`);
      for (const m of modelsResult.rows) {
        console.log(`  - ${m.model_key}: ${m.cnt} configs`);
      }
    }
    
    // Total count
    const totalResult = await pool.query(`SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations`);
    console.log(`\n=== TOTAL: ${totalResult.rows[0].cnt} configurations ===`);
    
    // Check existing models for targets
    console.log('\n=== Checking Target Models Already Covered ===');
    const targetModels = [
      { make: 'ram', models: ['1500', '2500', '3500'] },
      { make: 'gmc', models: ['sierra-1500', 'yukon', 'yukon-xl', 'terrain'] },
      { make: 'subaru', models: ['outback', 'forester', 'crosstrek', 'legacy'] },
      { make: 'mazda', models: ['cx-5', 'cx-9', 'mazda3', 'mazda6'] }
    ];
    
    for (const { make, models } of targetModels) {
      console.log(`\n${make.toUpperCase()}:`);
      for (const model of models) {
        const result = await pool.query(
          `SELECT COUNT(*) as cnt FROM vehicle_fitment_configurations WHERE make_key = $1 AND model_key = $2`,
          [make, model]
        );
        const status = result.rows[0].cnt > 0 ? `✅ ${result.rows[0].cnt} configs` : '❌ NOT COVERED';
        console.log(`  ${model}: ${status}`);
      }
    }
    
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
