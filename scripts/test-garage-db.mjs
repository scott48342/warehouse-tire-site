/**
 * Test script to debug garage sync issues
 * Uses Prisma client for Prisma Postgres
 */
import 'dotenv/config';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  console.log('Testing garage database...\n');
  
  try {
    // 1. Check if table exists
    console.log('1. Checking if user_garage table exists...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_garage'
    `;
    console.log('   Tables found:', tables.length > 0 ? tables : 'TABLE NOT FOUND!');
    
    if (tables.length === 0) {
      console.log('\n❌ user_garage table does NOT exist!');
      console.log('   Migration 0041_user_garage.sql was never applied to production.');
      return;
    }
    
    // 2. Check table columns
    console.log('\n2. Checking table columns...');
    const columns = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_garage'
      ORDER BY ordinal_position
    `;
    console.log('   Columns:', JSON.stringify(columns, null, 2));
    
    // 3. Check indexes/constraints
    console.log('\n3. Checking indexes/constraints...');
    const indexes = await prisma.$queryRaw`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'user_garage'
    `;
    console.log('   Indexes:', JSON.stringify(indexes, null, 2));
    
    // 4. Check if there's data for the test user
    const testUserId = 'dbfb5182-485b-4a4f-a29b-5759da2519a9';
    console.log(`\n4. Checking vehicles for user ${testUserId}...`);
    const vehicles = await prisma.$queryRaw`
      SELECT * FROM user_garage 
      WHERE user_id = ${testUserId}
    `;
    console.log('   Vehicles:', vehicles.length > 0 ? JSON.stringify(vehicles, null, 2) : 'None');
    
    // 5. Total row count
    console.log('\n5. Total vehicles in database...');
    const total = await prisma.$queryRaw`SELECT COUNT(*) as count FROM user_garage`;
    console.log('   Total:', total[0].count);
    
    // 6. Check specific ID that's failing
    const problemId = 'v_1785849050484_t6kgtf5rf';
    console.log(`\n6. Checking for problem ID ${problemId}...`);
    const existing = await prisma.$queryRaw`
      SELECT * FROM user_garage WHERE id = ${problemId}
    `;
    console.log('   Existing:', existing.length > 0 ? JSON.stringify(existing, null, 2) : 'Not found');
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  await prisma.$disconnect();
}

main();
