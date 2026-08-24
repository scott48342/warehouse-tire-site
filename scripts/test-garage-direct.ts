/**
 * Test garage sync using Drizzle directly (same as prod)
 * Run with: npx tsx scripts/test-garage-direct.ts
 */
import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { userGarage } from '../src/lib/auth-schema';
import { eq, desc, sql } from "drizzle-orm";

async function main() {
  console.log('Testing garage database with Drizzle...\n');
  
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    max: 1,
  });
  
  const db = drizzle(pool, { schema: { userGarage } });
  
  try {
    // 1. Test raw SQL first
    console.log('1. Testing raw SQL query...');
    const rawResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'user_garage'
    `);
    console.log('   Table exists:', rawResult.rows.length > 0 ? 'YES' : 'NO');
    
    if (rawResult.rows.length === 0) {
      console.log('\n❌ user_garage table does NOT exist!');
      console.log('   Need to run migrations.');
      await pool.end();
      return;
    }
    
    // 2. Test Drizzle SELECT (same query as sync route)
    const testUserId = 'dbfb5182-485b-4a4f-a29b-5759da2519a9';
    console.log(`\n2. Testing Drizzle SELECT for user ${testUserId}...`);
    
    const serverVehicles = await db
      .select()
      .from(userGarage)
      .where(eq(userGarage.userId, testUserId))
      .orderBy(desc(userGarage.lastActiveAt));
    
    console.log('   Found vehicles:', serverVehicles.length);
    if (serverVehicles.length > 0) {
      console.log('   First vehicle:', JSON.stringify(serverVehicles[0], null, 2));
    }
    
    // 3. Check for the specific problem ID
    const problemId = 'v_1785849050484_t6kgtf5rf';
    console.log(`\n3. Checking for problem ID ${problemId}...`);
    const rawExisting = await pool.query(
      'SELECT * FROM user_garage WHERE id = $1',
      [problemId]
    );
    console.log('   Exists:', rawExisting.rows.length > 0 ? 'YES' : 'NO');
    if (rawExisting.rows.length > 0) {
      console.log('   Data:', JSON.stringify(rawExisting.rows[0], null, 2));
    }
    
    // 4. Check duplicate detection logic
    console.log('\n4. Testing duplicate detection...');
    const testLocal = {
      id: problemId,
      year: '2020',
      make: 'Ford',
      model: 'F-150',
      modification: null,
    };
    
    function isDuplicate(a: any, b: any): boolean {
      if (a.modification && b.modification) {
        return a.modification === b.modification;
      }
      const normalize = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, '');
      return (
        a.year === b.year &&
        normalize(a.make) === normalize(b.make) &&
        normalize(a.model) === normalize(b.model)
      );
    }
    
    const existsInServer = serverVehicles.some(server => {
      const result = isDuplicate(server, testLocal);
      console.log(`   Comparing server(${server.year}/${server.make}/${server.model}) to local(${testLocal.year}/${testLocal.make}/${testLocal.model}): ${result}`);
      return result;
    });
    
    console.log('   Would skip INSERT:', existsInServer ? 'YES (duplicate found)' : 'NO (would INSERT)');
    
    // 5. Total count
    console.log('\n5. Total vehicles in database...');
    const total = await pool.query('SELECT COUNT(*) FROM user_garage');
    console.log('   Total:', total.rows[0].count);
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  await pool.end();
}

main();
