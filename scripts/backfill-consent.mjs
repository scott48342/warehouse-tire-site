/**
 * Backfill all abandoned cart emails into email_subscribers with consent
 */
import pg from 'pg';
const { Pool } = pg;

async function backfillConsent() {
  const connString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const pool = new Pool({
    connectionString: connString,
    ssl: connString?.includes('prisma.io') || connString?.includes('neon') 
      ? { rejectUnauthorized: false } 
      : false
  });

  try {
    // First, update existing subscribers to have consent
    const updated = await pool.query(`
      UPDATE email_subscribers es
      SET marketing_consent = true, updated_at = NOW()
      WHERE marketing_consent = false
        AND EXISTS (
          SELECT 1 FROM abandoned_carts ac 
          WHERE LOWER(TRIM(ac.customer_email)) = LOWER(TRIM(es.email))
            AND ac.is_test = false
        )
      RETURNING email
    `);
    console.log(`Updated ${updated.rowCount} existing subscribers to have consent`);

    // Then insert new subscribers that don't exist yet
    const result = await pool.query(`
      INSERT INTO email_subscribers (email, source, marketing_consent, vehicle_year, vehicle_make, vehicle_model, vehicle_trim, cart_id, created_at, updated_at)
      SELECT DISTINCT ON (LOWER(TRIM(ac.customer_email)))
        LOWER(TRIM(ac.customer_email)) as email,
        'checkout' as source,
        true as marketing_consent,
        ac.vehicle_year,
        ac.vehicle_make,
        ac.vehicle_model,
        ac.vehicle_trim,
        ac.cart_id,
        NOW() as created_at,
        NOW() as updated_at
      FROM abandoned_carts ac
      WHERE ac.customer_email IS NOT NULL
        AND TRIM(ac.customer_email) != ''
        AND ac.is_test = false
        AND NOT EXISTS (
          SELECT 1 FROM email_subscribers es 
          WHERE LOWER(TRIM(es.email)) = LOWER(TRIM(ac.customer_email))
        )
      ORDER BY LOWER(TRIM(ac.customer_email)), ac.created_at DESC
      RETURNING email
    `);

    console.log(`✅ Subscribed ${result.rowCount} emails with consent`);
    if (result.rows.length > 0) {
      console.log('Emails added:');
      result.rows.forEach(r => console.log(`  - ${r.email}`));
    }
    
    // Also show total subscriber count
    const total = await pool.query(`
      SELECT COUNT(*) FROM email_subscribers 
      WHERE marketing_consent = true AND unsubscribed = false
    `);
    console.log(`\n📊 Total subscribers with consent: ${total.rows[0].count}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

backfillConsent();
