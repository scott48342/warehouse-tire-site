/**
 * Seed test subscribers for campaign testing
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});

const testSubscribers = [
  { email: 'ford.mustang.fan@test.local', source: 'newsletter', make: 'Ford', model: 'Mustang', year: '2020' },
  { email: 'chevy.camaro.owner@test.local', source: 'checkout', make: 'Chevrolet', model: 'Camaro', year: '2022' },
  { email: 'dodge.challenger@test.local', source: 'cart_save', make: 'Dodge', model: 'Challenger', year: '2021' },
  { email: 'toyota.camry@test.local', source: 'exit_intent', make: 'Toyota', model: 'Camry', year: '2023' },
  { email: 'honda.accord@test.local', source: 'newsletter', make: 'Honda', model: 'Accord', year: '2019' },
  { email: 'f150.truck@test.local', source: 'checkout', make: 'Ford', model: 'F-150', year: '2024' },
  { email: 'silverado.owner@test.local', source: 'newsletter', make: 'Chevrolet', model: 'Silverado', year: '2023' },
  { email: 'ram.1500@test.local', source: 'cart_save', make: 'RAM', model: '1500', year: '2022' },
  { email: 'bmw.m3@test.local', source: 'quote', make: 'BMW', model: 'M3', year: '2021' },
  { email: 'porsche.911@test.local', source: 'newsletter', make: 'Porsche', model: '911', year: '2020' },
];

async function seed() {
  console.log('🌱 Seeding test subscribers...\n');
  
  try {
    let created = 0;
    let existing = 0;
    
    for (const sub of testSubscribers) {
      const result = await pool.query(`
        INSERT INTO email_subscribers (
          email, source, vehicle_make, vehicle_model, vehicle_year,
          marketing_consent, unsubscribed, is_test,
          unsubscribe_token
        ) VALUES ($1, $2, $3, $4, $5, true, false, true, md5(random()::text))
        ON CONFLICT (email, source) DO NOTHING
        RETURNING id
      `, [sub.email, sub.source, sub.make, sub.model, sub.year]);
      
      if (result.rows.length > 0) {
        created++;
        console.log(`   ✅ ${sub.email} (${sub.make} ${sub.model})`);
      } else {
        existing++;
      }
    }
    
    console.log(`\n📊 Results: ${created} created, ${existing} already existed`);
    
    // Show count by vehicle
    const byMake = await pool.query(`
      SELECT vehicle_make as make, COUNT(*) as count
      FROM email_subscribers
      WHERE is_test = true AND vehicle_make IS NOT NULL
      GROUP BY vehicle_make
      ORDER BY count DESC
    `);
    
    console.log('\nTest subscribers by make:');
    for (const row of byMake.rows) {
      console.log(`   ${row.make}: ${row.count}`);
    }
    
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
