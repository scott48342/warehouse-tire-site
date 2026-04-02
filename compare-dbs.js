const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const prismaUrl = process.env.POSTGRES_URL;
const railwayUrl = process.env.DATABASE_URL;

async function getTables(pool) {
  const res = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return res.rows.map(r => r.table_name);
}

async function getRowCounts(pool, tables) {
  const counts = {};
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
      counts[table] = parseInt(res.rows[0].count);
    } catch (e) {
      counts[table] = 'ERR';
    }
  }
  return counts;
}

async function main() {
  console.log('Connecting to both databases...\n');
  
  if (!prismaUrl) throw new Error('POSTGRES_URL not set');
  if (!railwayUrl) throw new Error('DATABASE_URL not set');
  
  console.log('Prisma URL:', prismaUrl.slice(0, 30) + '...');
  console.log('Railway URL:', railwayUrl.slice(0, 30) + '...\n');
  
  // Prisma requires SSL, Railway doesn't
  const prisma = new Pool({ 
    connectionString: prismaUrl, 
    ssl: prismaUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : false 
  });
  const railway = new Pool({ 
    connectionString: railwayUrl, 
    ssl: false  // Railway internal doesn't use SSL
  });

  const prismaTables = await getTables(prisma);
  const railwayTables = await getTables(railway);
  
  console.log(`Prisma (db.prisma.io): ${prismaTables.length} tables`);
  console.log(`Railway (ballast.proxy.rlwy.net): ${railwayTables.length} tables\n`);

  const prismaCounts = await getRowCounts(prisma, prismaTables);
  const railwayCounts = await getRowCounts(railway, railwayTables);

  console.log('TABLE                                   PRISMA      RAILWAY     STATUS');
  console.log('------------------------------------------------------------------------');
  
  const allTables = [...new Set([...prismaTables, ...railwayTables])].sort();
  const issues = [];
  
  for (const table of allTables) {
    const p = prismaCounts[table] ?? '-';
    const r = railwayCounts[table] ?? '-';
    let status = '';
    
    if (p === '-') {
      status = '!! RAILWAY ONLY';
      issues.push({ table, type: 'railway-only', count: r });
    } else if (r === '-') {
      status = 'prisma only';
    } else if (p === r) {
      status = 'MATCH';
    } else if (p > r) {
      status = `prisma +${p - r}`;
    } else {
      status = `!! RAILWAY +${r - p}`;
      issues.push({ table, type: 'railway-more', prisma: p, railway: r, diff: r - p });
    }
    
    console.log(table.padEnd(40) + String(p).padEnd(12) + String(r).padEnd(12) + status);
  }

  if (issues.length > 0) {
    console.log('\n========== ATTENTION ==========\n');
    console.log('These tables need review before removing Railway:\n');
    for (const issue of issues) {
      if (issue.type === 'railway-only') {
        console.log(`  ${issue.table}: EXISTS ONLY IN RAILWAY (${issue.count} rows)`);
      } else {
        console.log(`  ${issue.table}: Railway has ${issue.diff} more rows (P:${issue.prisma} vs R:${issue.railway})`);
      }
    }
  } else {
    console.log('\n✓ Safe to remove Railway - Prisma has all data.');
  }

  await prisma.end();
  await railway.end();
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
