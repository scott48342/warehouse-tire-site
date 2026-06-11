import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.POSTGRES_URL
});

async function main() {
  await client.connect();
  
  const result = await client.query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'vehicle_fitments'
    ORDER BY ordinal_position
  `);
  
  console.log('vehicle_fitments schema:');
  result.rows.forEach(r => {
    console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
  });
  
  await client.end();
}

main().catch(console.error);
