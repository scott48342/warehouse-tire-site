import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new pg.Pool({ 
  connectionString: process.env.POSTGRES_URL, 
  ssl: { rejectUnauthorized: false } 
});

const query = process.argv[2] || `
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND (table_name LIKE '%tire%' OR table_name LIKE '%wp_%')
  ORDER BY table_name
`;

pool.query(query)
  .then(r => {
    if (r.rows.length === 0) {
      console.log('(no rows)');
    } else {
      console.log(JSON.stringify(r.rows, null, 2));
    }
  })
  .catch(e => console.error(e))
  .finally(() => pool.end());
