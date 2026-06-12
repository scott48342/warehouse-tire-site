import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_c0FpKTmNB3qR@ep-aged-dust-an7vnet1-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    // Test consent check - same logic as hasEmailConsent()
    const dustinEmail = 'dustin1271@gmail.com';
    const consent = await pool.query(`
      SELECT id, email, source, marketing_consent, unsubscribed
      FROM email_subscribers 
      WHERE LOWER(email) = LOWER($1)
        AND unsubscribed = false
        AND (
          marketing_consent = true
          OR source = 'cart_save'
          OR source = 'exit_intent'
          OR source = 'checkout'
        )
      LIMIT 1
    `, [dustinEmail]);
    
    console.log('=== CONSENT CHECK FOR DUSTIN ===');
    console.log('Has consent:', consent.rows.length > 0);
    if (consent.rows.length > 0) {
      console.log('Subscriber record:', JSON.stringify(consent.rows[0], null, 2));
    }

    // Check if there's a case mismatch between cart email and subscriber email
    const cartEmail = await pool.query(`
      SELECT customer_email FROM abandoned_carts WHERE cart_id = 'mq78w49f-1s645dva'
    `);
    const subEmail = await pool.query(`
      SELECT email FROM email_subscribers WHERE email ILIKE '%dustin%'
    `);
    console.log('\n=== EMAIL COMPARISON ===');
    console.log('Cart email:', JSON.stringify(cartEmail.rows[0]?.customer_email));
    console.log('Subscriber email:', JSON.stringify(subEmail.rows[0]?.email));
    console.log('Match:', cartEmail.rows[0]?.customer_email?.toLowerCase() === subEmail.rows[0]?.email?.toLowerCase());
    
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

check();
