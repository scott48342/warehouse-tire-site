import pg from 'pg';

const client = new pg.Client({
  connectionString: 'postgresql://neondb_owner:***@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
});

await client.connect();

// Check recent orders that need attention
const orders = await client.query(`
  SELECT id, status, customer_email, created_at, 
         (snapshot_json->'totals'->>'total')::numeric as total
  FROM orders 
  WHERE status IN ('parts_ordered', 'paid', 'pending')
  AND created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC
`);

console.log('Recent orders needing attention:');
for (const o of orders.rows) {
  console.log(`  ${o.id} - ${o.status} - $${o.total} - ${o.customer_email}`);
}

await client.end();
