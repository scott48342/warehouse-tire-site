import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL);

const models = await sql`
  SELECT DISTINCT make, model, year_start, year_end 
  FROM suspension_fitments 
  WHERE make ILIKE '%chev%' OR make ILIKE '%gmc%'
  ORDER BY make, model, year_start
`;

console.log('Chevy/GMC vehicles with lift kit data:');
console.table(models);

await sql.end();
