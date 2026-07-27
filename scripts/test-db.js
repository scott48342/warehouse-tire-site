require('dotenv').config({path:'.env.local'});
const {Pool}=require('pg');

const p=new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: {rejectUnauthorized:false}
});

p.query('SELECT count(*) as count FROM vehicle_fitments WHERE make=$1', ["Buick"])
  .then(r => console.log('Count:', r.rows[0].count))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.end());
