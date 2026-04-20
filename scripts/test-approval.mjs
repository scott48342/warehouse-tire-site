import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.POSTGRES_URL
});

await client.connect();

// Approve the build
await client.query(`UPDATE customer_builds SET status = 'approved', moderated_at = NOW() WHERE id = 1`);
console.log('✅ Build approved');

// Check result
const result = await client.query(`SELECT id, status, vehicle_make, vehicle_model FROM customer_builds WHERE id = 1`);
console.log('Build:', result.rows[0]);

// Check if images exist
const images = await client.query(`SELECT id, original_url FROM customer_build_images WHERE build_id = 1`);
console.log('Images:', images.rows.length);

await client.end();
