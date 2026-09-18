// Check DB privileges - temporary script for audit
import pg from 'pg';
const { Client } = pg;

const c = new Client({ connectionString: process.env.POSTGRES_URL });
await c.connect();

const r1 = await c.query(`SELECT current_user, rolsuper, rolcreatedb, rolcanlogin FROM pg_roles WHERE rolname = current_user`);
console.log('Role info:', JSON.stringify(r1.rows[0]));

const r2 = await c.query(`
  SELECT 
    has_table_privilege(current_user,'vehicle_fitments','UPDATE') as can_update,
    has_table_privilege(current_user,'vehicle_fitments','DELETE') as can_delete,
    has_table_privilege(current_user,'vehicle_fitments','INSERT') as can_insert
`);
console.log('vehicle_fitments privs:', JSON.stringify(r2.rows[0]));

await c.end();
