/**
 * Setup Funnel Events Table
 * 
 * Creates the funnel_events table and indexes for analytics.
 * 
 * Usage: npx tsx scripts/analytics/setup-funnel-events.ts
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  console.log('='.repeat(60));
  console.log('SETTING UP FUNNEL EVENTS TABLE');
  console.log('='.repeat(60));
  console.log('');
  
  const client = await pool.connect();
  
  try {
    // Check if table exists
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name = 'funnel_events'
    `);
    
    if (tables.length > 0) {
      console.log('⏭️  funnel_events table already exists');
      
      // Get current count
      const { rows: counts } = await client.query('SELECT COUNT(*)::int as count FROM funnel_events');
      console.log(`   Current events: ${counts[0].count.toLocaleString()}`);
    } else {
      console.log('Creating funnel_events table...');
      
      await client.query(`
        CREATE TABLE funnel_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_name VARCHAR(100) NOT NULL,
          session_id VARCHAR(100) NOT NULL,
          user_id VARCHAR(100),
          traffic_source VARCHAR(100),
          device_type VARCHAR(50),
          store_mode VARCHAR(20),
          page_url TEXT,
          product_sku VARCHAR(100),
          product_type VARCHAR(50),
          cart_value DECIMAL(10,2),
          order_id VARCHAR(100),
          coupon_code VARCHAR(50),
          user_agent TEXT,
          ip_address VARCHAR(50),
          referrer TEXT,
          utm_source VARCHAR(100),
          utm_medium VARCHAR(100),
          utm_campaign VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          metadata JSONB DEFAULT '{}'::jsonb
        )
      `);
      console.log('✅ Created funnel_events table');
    }
    
    // Create indexes
    console.log('\nCreating indexes...');
    
    const indexes = [
      { name: 'idx_funnel_events_event_name', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_event_name ON funnel_events(event_name)' },
      { name: 'idx_funnel_events_session_id', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_session_id ON funnel_events(session_id)' },
      { name: 'idx_funnel_events_created_at', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at)' },
      { name: 'idx_funnel_events_store_mode', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_store_mode ON funnel_events(store_mode)' },
      { name: 'idx_funnel_events_device_type', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_device_type ON funnel_events(device_type)' },
      { name: 'idx_funnel_events_traffic_source', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_traffic_source ON funnel_events(traffic_source)' },
      { name: 'idx_funnel_events_funnel_query', sql: 'CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel_query ON funnel_events(event_name, created_at, store_mode, device_type)' },
    ];
    
    for (const idx of indexes) {
      await client.query(idx.sql);
      console.log(`  ✅ ${idx.name}`);
    }
    
    // Insert sample data for testing (optional)
    const { rows: countCheck } = await client.query('SELECT COUNT(*)::int as count FROM funnel_events');
    
    if (countCheck[0].count === 0) {
      console.log('\n📝 Inserting sample data for testing...');
      
      const sampleSessions = 100;
      const events = [
        { name: 'session_start', dropRate: 0 },
        { name: 'product_view', dropRate: 0.3 },
        { name: 'add_to_cart', dropRate: 0.5 },
        { name: 'begin_checkout', dropRate: 0.4 },
        { name: 'checkout_step2', dropRate: 0.2 },
        { name: 'add_shipping_info', dropRate: 0.1 },
        { name: 'add_payment_info', dropRate: 0.1 },
        { name: 'purchase', dropRate: 0.05 },
      ];
      
      const devices = ['mobile', 'desktop', 'tablet'];
      const modes = ['local', 'national'];
      const sources = ['google', 'direct', 'facebook', 'bing', 'instagram'];
      
      let remaining = sampleSessions;
      
      for (const event of events) {
        remaining = Math.floor(remaining * (1 - event.dropRate));
        
        for (let i = 0; i < remaining; i++) {
          const sessionId = `sample-${i}`;
          const device = devices[Math.floor(Math.random() * devices.length)];
          const mode = modes[Math.floor(Math.random() * modes.length)];
          const source = sources[Math.floor(Math.random() * sources.length)];
          
          await client.query(`
            INSERT INTO funnel_events (event_name, session_id, device_type, store_mode, traffic_source)
            VALUES ($1, $2, $3, $4, $5)
          `, [event.name, sessionId, device, mode, source]);
        }
      }
      
      console.log(`  ✅ Inserted sample events for ${sampleSessions} sessions`);
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ FUNNEL EVENTS SETUP COMPLETE');
    console.log('='.repeat(60));
    
    const { rows: finalCount } = await client.query('SELECT COUNT(*)::int as count FROM funnel_events');
    console.log(`Total events: ${finalCount[0].count.toLocaleString()}`);
    
    console.log('\nNext steps:');
    console.log('  1. Add tracking to your pages:');
    console.log('     import { trackEvent } from "@/lib/analytics/tracker"');
    console.log('  2. Visit dashboard: /admin/analytics');
    
  } finally {
    client.release();
  }
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
