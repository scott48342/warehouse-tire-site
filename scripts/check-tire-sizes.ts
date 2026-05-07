import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import pg from 'pg';
const { Pool } = pg;

import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../src/lib/fitment-db/schema';
import { vehicleFitments } from '../src/lib/fitment-db/schema';
import { ilike, and, eq, gte, lte, sql } from 'drizzle-orm';

async function main() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });
  
  const db = drizzle(pool, { schema });
  
  console.log('=== Silverado 2500 HD (all years) ===');
  const silverado = await db.select({
    year: vehicleFitments.year,
    rawTrim: vehicleFitments.rawTrim,
    tires: vehicleFitments.oemTireSizes,
    wheels: vehicleFitments.oemWheelSizes,
    tier: vehicleFitments.qualityTier,
  }).from(vehicleFitments)
    .where(and(
      ilike(vehicleFitments.make, 'chevrolet'),
      ilike(vehicleFitments.model, '%silverado%2500%')
    ))
    .orderBy(vehicleFitments.year)
    .limit(10);
  
  silverado.forEach(r => {
    const tireCount = Array.isArray(r.tires) ? r.tires.length : 0;
    console.log(`  ${r.year} ${r.rawTrim} | tier=${r.tier} | tires=${tireCount}`);
    if (tireCount > 0) console.log(`    Tires: ${JSON.stringify(r.tires)}`);
  });
  
  console.log('\n=== Mazda 3 (2022-2024) ===');
  const mazda = await db.select({
    year: vehicleFitments.year,
    rawTrim: vehicleFitments.rawTrim,
    tires: vehicleFitments.oemTireSizes,
    wheels: vehicleFitments.oemWheelSizes,
    tier: vehicleFitments.qualityTier,
    model: vehicleFitments.model,
  }).from(vehicleFitments)
    .where(and(
      ilike(vehicleFitments.make, 'mazda'),
      ilike(vehicleFitments.model, '%3%'),
      gte(vehicleFitments.year, 2022),
      lte(vehicleFitments.year, 2024)
    ))
    .limit(10);
  
  mazda.forEach(r => {
    const tireCount = Array.isArray(r.tires) ? r.tires.length : 0;
    console.log(`  ${r.year} ${r.model} ${r.rawTrim} | tier=${r.tier} | tires=${tireCount}`);
    if (tireCount > 0) console.log(`    Tires: ${JSON.stringify(r.tires)}`);
  });
  
  console.log('\n=== Gladiator Rubicon tire search debug ===');
  // Check why tire search might fail
  const gladiator = await db.select().from(vehicleFitments)
    .where(and(
      eq(vehicleFitments.year, 2024),
      ilike(vehicleFitments.make, 'jeep'),
      ilike(vehicleFitments.model, 'gladiator'),
      ilike(vehicleFitments.rawTrim, '%rubicon%')
    )).limit(2);
  
  gladiator.forEach(r => {
    console.log(`  ID: ${r.id}`);
    console.log(`  Trim: ${r.rawTrim}`);
    console.log(`  Tier: ${r.qualityTier}`);
    console.log(`  Tires: ${JSON.stringify(r.oemTireSizes)}`);
    console.log(`  Wheels: ${JSON.stringify(r.oemWheelSizes)}`);
    console.log('---');
  });
  
  await pool.end();
}

main().catch(console.error);
