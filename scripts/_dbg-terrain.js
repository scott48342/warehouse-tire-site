const pg = require('pg');
const { Pool } = pg;

(async () => {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) throw new Error('DATABASE_URL missing');
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const { rows } = await pool.query(
    `select terrain, count(*)::int as c
     from wp_tires
     group by terrain
     order by c desc nulls last
     limit 50`
  );

  console.log(rows);
  await pool.end();
})();
