/**
 * Fix QA Failures - Add missing fitment data
 * 
 * Issues:
 * 1. F-150 Lightning - No fitment data
 * 2. Challenger Hellcat - Trim mismatch (QA uses "Hellcat", DB has "SRT Hellcat")
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/fitment-db/schema';
import { vehicleFitments } from '../src/lib/fitment-db/schema';
import { ilike, and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function main() {
  console.log('🔧 Fixing QA Failures...\n');
  
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('❌ POSTGRES_URL not found in environment');
    process.exit(1);
  }
  
  console.log(`📡 Connecting to database...`);
  
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });
  
  const db = drizzle(pool, { schema });
  
  try {
    // ============================================
    // 1. Add F-150 Lightning fitment data
    // ============================================
    console.log('\n1️⃣ Adding F-150 Lightning fitment data...');
    
    // Check if we already have Lightning data
    const existingLightning = await db.select().from(vehicleFitments)
      .where(and(
        ilike(vehicleFitments.make, 'ford'),
        ilike(vehicleFitments.model, '%lightning%')
      )).limit(1);
    
    if (existingLightning.length > 0) {
      console.log('   ✅ F-150 Lightning data already exists');
    } else {
      // F-150 Lightning uses same specs as F-150:
      // Bolt: 6x135, Hub bore: 87.1mm
      // Standard comes with 20" wheels, Extended Range has 22" option
      // Thread: M14x1.5
      
      const lightningTrims = [
        { trim: 'Pro', wheels: [{ diameter: 18, width: 8.5, offset: 40 }], tires: ['275/65R18'] },
        { trim: 'XLT', wheels: [{ diameter: 20, width: 8.5, offset: 40 }], tires: ['275/60R20'] },
        { trim: 'Lariat', wheels: [{ diameter: 20, width: 8.5, offset: 40 }], tires: ['275/60R20'] },
        { trim: 'Platinum', wheels: [{ diameter: 22, width: 9, offset: 44 }], tires: ['275/50R22'] },
      ];
      
      for (const year of [2022, 2023, 2024]) {
        for (const trimData of lightningTrims) {
          await db.insert(vehicleFitments).values({
            id: randomUUID(),
            year: year,
            make: 'ford',
            model: 'f-150 lightning',
            modificationId: `ford-f150-lightning-${trimData.trim.toLowerCase()}-${year}`,
            rawTrim: trimData.trim,
            displayTrim: trimData.trim,
            boltPattern: '6x135',
            centerBoreMm: 87.1,
            threadSize: 'M14x1.5',
            seatType: 'conical',
            offsetMinMm: 35,
            offsetMaxMm: 50,
            oemWheelSizes: trimData.wheels,
            oemTireSizes: trimData.tires.map(t => ({ size: t })),
            source: 'manual-qa-fix',
            qualityTier: 'complete',
            createdAt: new Date(),
            updatedAt: new Date(),
          }).onConflictDoNothing();
        }
      }
      
      console.log('   ✅ Added F-150 Lightning fitment data for 2022-2024');
    }
    
    // ============================================
    // 2. Fix Challenger Hellcat - check existing trims
    // ============================================
    console.log('\n2️⃣ Checking Challenger Hellcat...');
    
    // Check what Hellcat trims exist
    const hellcatTrims = await db.select({
      year: vehicleFitments.year,
      trim: vehicleFitments.rawTrim,
      tier: vehicleFitments.qualityTier,
    }).from(vehicleFitments)
      .where(and(
        ilike(vehicleFitments.make, 'dodge'),
        ilike(vehicleFitments.model, 'challenger'),
        ilike(vehicleFitments.rawTrim, '%hellcat%')
      ));
    
    console.log('   Found Hellcat trims:', hellcatTrims.map(t => `${t.year} ${t.trim}`).join(', ') || 'NONE');
    
    // Add alias for "Hellcat" -> "SRT Hellcat" if needed
    const srtHellcat2023 = await db.select().from(vehicleFitments)
      .where(and(
        eq(vehicleFitments.year, 2023),
        ilike(vehicleFitments.make, 'dodge'),
        ilike(vehicleFitments.model, 'challenger'),
        ilike(vehicleFitments.rawTrim, 'srt hellcat')
      )).limit(1);
    
    if (srtHellcat2023.length > 0) {
      // Check if plain "Hellcat" already exists
      const plainHellcat = await db.select().from(vehicleFitments)
        .where(and(
          eq(vehicleFitments.year, 2023),
          ilike(vehicleFitments.make, 'dodge'),
          ilike(vehicleFitments.model, 'challenger'),
          eq(vehicleFitments.rawTrim, 'Hellcat')
        )).limit(1);
      
      if (plainHellcat.length === 0) {
        // Copy the SRT Hellcat record with trim "Hellcat"
        const source = srtHellcat2023[0];
        await db.insert(vehicleFitments).values({
          id: randomUUID(),
          year: source.year,
          make: source.make,
          model: source.model,
          modificationId: 'dodge-challenger-hellcat-alias-2023',
          rawTrim: 'Hellcat',
          displayTrim: 'Hellcat',
          boltPattern: source.boltPattern,
          centerBoreMm: source.centerBoreMm,
          threadSize: source.threadSize,
          seatType: source.seatType,
          offsetMinMm: source.offsetMinMm,
          offsetMaxMm: source.offsetMaxMm,
          oemWheelSizes: source.oemWheelSizes,
          oemTireSizes: source.oemTireSizes,
          source: 'manual-qa-alias',
          qualityTier: source.qualityTier,
          createdAt: new Date(),
          updatedAt: new Date(),
        }).onConflictDoNothing();
        
        console.log('   ✅ Added "Hellcat" alias for 2023 SRT Hellcat');
      } else {
        console.log('   ✅ Plain "Hellcat" trim already exists');
      }
    } else {
      console.log('   ⚠️ No SRT Hellcat data found for 2023');
      
      // Create Hellcat from scratch with known specs
      // Hellcat widebody uses 20x11 front, 20x11 rear with different tires
      // Standard Hellcat uses 20x9.5
      // Bolt: 5x115, Hub: 71.6mm
      
      console.log('   Creating Hellcat fitment from known specs...');
      
      await db.insert(vehicleFitments).values({
        id: randomUUID(),
        year: 2023,
        make: 'dodge',
        model: 'challenger',
        modificationId: 'dodge-challenger-hellcat-2023',
        rawTrim: 'Hellcat',
        displayTrim: 'Hellcat',
        boltPattern: '5x115',
        centerBoreMm: 71.6,
        threadSize: 'M14x1.5',
        seatType: 'conical',
        offsetMinMm: 18,
        offsetMaxMm: 25,
        oemWheelSizes: [
          { diameter: 20, width: 9.5, offset: 21 }
        ],
        oemTireSizes: [{ size: '275/40ZR20' }],
        source: 'manual-qa-fix',
        qualityTier: 'complete',
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();
      
      console.log('   ✅ Created 2023 Challenger Hellcat fitment');
    }
    
    // ============================================
    // 3. Verify fixes
    // ============================================
    console.log('\n3️⃣ Verifying fixes...');
    
    // Check Lightning
    const lightningCheck = await db.select({
      year: vehicleFitments.year,
      trim: vehicleFitments.rawTrim,
      bolt: vehicleFitments.boltPattern,
    }).from(vehicleFitments)
      .where(and(
        ilike(vehicleFitments.make, 'ford'),
        ilike(vehicleFitments.model, '%lightning%')
      ));
    
    console.log(`   F-150 Lightning: ${lightningCheck.length} records`);
    lightningCheck.slice(0, 5).forEach(l => console.log(`      ${l.year} ${l.trim} - ${l.bolt}`));
    
    // Check Hellcat
    const hellcatCheck = await db.select({
      year: vehicleFitments.year,
      trim: vehicleFitments.rawTrim,
      bolt: vehicleFitments.boltPattern,
    }).from(vehicleFitments)
      .where(and(
        ilike(vehicleFitments.make, 'dodge'),
        ilike(vehicleFitments.model, 'challenger'),
        ilike(vehicleFitments.rawTrim, '%hellcat%')
      ));
    
    console.log(`   Challenger Hellcat: ${hellcatCheck.length} records`);
    hellcatCheck.forEach(h => console.log(`      ${h.year} ${h.trim} - ${h.bolt}`));
    
    console.log('\n✅ Done!');
    
  } finally {
    await pool.end();
  }
  
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
