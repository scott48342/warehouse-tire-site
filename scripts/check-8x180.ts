import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function check() {
  // Check 8x180 wheels and their offsets
  const results = await db.execute(sql`
    SELECT 
      offset::int as offset,
      width,
      COUNT(*)::int as count
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
      AND offset IS NOT NULL
    GROUP BY offset, width
    ORDER BY offset::int
  `);
  
  console.log('8x180 (Chevy/GMC HD) wheel offset distribution:');
  for (const row of results.rows as any[]) {
    const isDrw = row.offset >= 65 || row.offset <= -65;
    const marker = isDrw ? ' [DRW]' : ' [SRW]';
    console.log(`  offset ${row.offset}mm, width ${row.width}" (${row.count} wheels)${marker}`);
  }
  
  // Count totals
  const drwCount = (results.rows as any[]).filter(r => r.offset >= 65 || r.offset <= -65).reduce((sum, r) => sum + r.count, 0);
  const srwCount = (results.rows as any[]).filter(r => r.offset > -65 && r.offset < 65).reduce((sum, r) => sum + r.count, 0);
  
  console.log(`\nTotal 8x180 wheels: DRW-compatible=${drwCount}, SRW-only=${srwCount}`);
  
  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
