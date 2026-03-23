import pg from 'pg';

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error('Missing POSTGRES_URL');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function check() {
  const { rows: info } = await pool.query('SELECT current_database()');
  console.log('Database:', info[0].current_database);
  
  const { rows: tables } = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE 'admin%'
    ORDER BY table_name
  `);
  console.log('Admin tables:', tables.map(t => t.table_name));
  
  await pool.end();
}

check().catch(e => { console.error('Error:', e.message); process.exit(1); });
