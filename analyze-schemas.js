const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const prismaUrl = process.env.POSTGRES_URL;
const railwayUrl = process.env.DATABASE_URL;

async function getTableSchema(pool, tableName) {
  const res = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, [tableName]);
  return res.rows;
}

async function getSampleRows(pool, tableName, limit = 3) {
  try {
    const res = await pool.query(`SELECT * FROM "${tableName}" LIMIT ${limit}`);
    return res.rows;
  } catch (e) {
    return [{ error: e.message }];
  }
}

async function main() {
  const prisma = new Pool({ 
    connectionString: prismaUrl, 
    ssl: { rejectUnauthorized: false }
  });
  const railway = new Pool({ 
    connectionString: railwayUrl, 
    ssl: false
  });

  console.log('='.repeat(80));
  console.log('PRISMA SCHEMA: vehicle_fitments');
  console.log('='.repeat(80));
  const prismaSchema = await getTableSchema(prisma, 'vehicle_fitments');
  console.table(prismaSchema);
  
  console.log('\nSample rows:');
  const prismaSample = await getSampleRows(prisma, 'vehicle_fitments', 2);
  console.log(JSON.stringify(prismaSample, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('RAILWAY SCHEMA: vehicles');
  console.log('='.repeat(80));
  const vehiclesSchema = await getTableSchema(railway, 'vehicles');
  console.table(vehiclesSchema);
  const vehiclesSample = await getSampleRows(railway, 'vehicles', 2);
  console.log('\nSample:');
  console.log(JSON.stringify(vehiclesSample, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('RAILWAY SCHEMA: vehicle_fitment');
  console.log('='.repeat(80));
  const vfSchema = await getTableSchema(railway, 'vehicle_fitment');
  console.table(vfSchema);
  const vfSample = await getSampleRows(railway, 'vehicle_fitment', 2);
  console.log('\nSample:');
  console.log(JSON.stringify(vfSample, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('RAILWAY SCHEMA: vehicle_wheel_specs');
  console.log('='.repeat(80));
  const vwsSchema = await getTableSchema(railway, 'vehicle_wheel_specs');
  console.table(vwsSchema);
  const vwsSample = await getSampleRows(railway, 'vehicle_wheel_specs', 2);
  console.log('\nSample:');
  console.log(JSON.stringify(vwsSample, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('RAILWAY SCHEMA: vehicle_oem_tire_size');
  console.log('='.repeat(80));
  const votsSchema = await getTableSchema(railway, 'vehicle_oem_tire_size');
  console.table(votsSchema);
  const votsSample = await getSampleRows(railway, 'vehicle_oem_tire_size', 2);
  console.log('\nSample:');
  console.log(JSON.stringify(votsSample, null, 2));

  await prisma.end();
  await railway.end();
}

main().catch(e => console.error(e));
