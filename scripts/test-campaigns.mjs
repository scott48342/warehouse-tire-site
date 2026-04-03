/**
 * Quick integration test for email campaigns
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function runTests() {
  console.log('🧪 Testing Email Campaign System\n');
  
  try {
    // Test 1: Create campaign
    console.log('1. Creating test campaign...');
    const createResult = await pool.query(`
      INSERT INTO email_campaigns (
        name, campaign_type, status, subject, preview_text,
        content_json, audience_rules_json, is_test
      ) VALUES (
        'Test Summer Sale', 'tire_promo', 'draft', 'Summer Tire Sale!', 'Big savings',
        '{"blocks":[{"type":"hero","data":{"headline":"Summer Sale"}}]}'::jsonb,
        '{"includeTest":true}'::jsonb,
        true
      ) RETURNING id, name, status
    `);
    const campaign = createResult.rows[0];
    console.log(`   ✅ Created: ${campaign.name} (${campaign.id})\n`);
    
    // Test 2: Read campaign
    console.log('2. Reading campaign...');
    const readResult = await pool.query(`
      SELECT id, name, campaign_type, status, subject, content_json 
      FROM email_campaigns WHERE id = $1
    `, [campaign.id]);
    console.log(`   ✅ Found: ${readResult.rows[0].name}`);
    console.log(`   Content blocks: ${JSON.stringify(readResult.rows[0].content_json.blocks.length)}\n`);
    
    // Test 3: Update campaign
    console.log('3. Updating campaign...');
    await pool.query(`
      UPDATE email_campaigns 
      SET subject = 'Updated Summer Sale!', updated_at = NOW()
      WHERE id = $1
    `, [campaign.id]);
    console.log('   ✅ Updated subject\n');
    
    // Test 4: Test audience query (simulated)
    console.log('4. Testing audience query...');
    const audienceResult = await pool.query(`
      SELECT COUNT(DISTINCT email) as count
      FROM email_subscribers
      WHERE unsubscribed = false
      AND marketing_consent = true
      AND suppression_reason IS NULL
    `);
    console.log(`   ✅ Eligible subscribers: ${audienceResult.rows[0].count}\n`);
    
    // Test 5: Create recipient snapshot
    console.log('5. Creating recipient snapshot...');
    const subscribers = await pool.query(`
      SELECT id, email FROM email_subscribers
      WHERE unsubscribed = false AND marketing_consent = true
      LIMIT 3
    `);
    
    for (const sub of subscribers.rows) {
      await pool.query(`
        INSERT INTO email_campaign_recipients (campaign_id, subscriber_id, email, status)
        VALUES ($1, $2, $3, 'pending')
        ON CONFLICT DO NOTHING
      `, [campaign.id, sub.id, sub.email]);
    }
    console.log(`   ✅ Added ${subscribers.rows.length} recipients\n`);
    
    // Test 6: Simulate send (update status)
    console.log('6. Simulating send...');
    await pool.query(`
      UPDATE email_campaigns SET status = 'sending', started_at = NOW() WHERE id = $1
    `, [campaign.id]);
    
    await pool.query(`
      UPDATE email_campaign_recipients 
      SET status = 'sent', sent_at = NOW()
      WHERE campaign_id = $1
    `, [campaign.id]);
    
    await pool.query(`
      UPDATE email_campaigns SET status = 'sent', completed_at = NOW(), sent_count = 3 WHERE id = $1
    `, [campaign.id]);
    console.log('   ✅ Campaign marked as sent\n');
    
    // Test 7: Log event
    console.log('7. Logging events...');
    await pool.query(`
      INSERT INTO email_campaign_events (campaign_id, event_type, email)
      SELECT $1, 'sent', email FROM email_campaign_recipients WHERE campaign_id = $1
    `, [campaign.id]);
    console.log('   ✅ Events logged\n');
    
    // Test 8: Check stats
    console.log('8. Checking stats...');
    const statsResult = await pool.query(`
      SELECT 
        c.total_recipients,
        c.sent_count,
        (SELECT COUNT(*) FROM email_campaign_events WHERE campaign_id = c.id AND event_type = 'sent') as events
      FROM email_campaigns c WHERE c.id = $1
    `, [campaign.id]);
    console.log(`   ✅ Stats: sent=${statsResult.rows[0].sent_count}, events=${statsResult.rows[0].events}\n`);
    
    // Cleanup
    console.log('9. Cleaning up test data...');
    await pool.query(`DELETE FROM email_campaigns WHERE id = $1`, [campaign.id]);
    console.log('   ✅ Cleaned up\n');
    
    console.log('═══════════════════════════════════');
    console.log('✅ ALL TESTS PASSED');
    console.log('═══════════════════════════════════');
    
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
