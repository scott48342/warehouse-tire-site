const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  // Check offset distribution for 8-lug wheels (HD trucks)
  const results = await prisma.$queryRaw`
    SELECT 
      bolt_pattern_metric,
      offset::int as offset,
      COUNT(*)::int as count
    FROM techfeed_wheels
    WHERE bolt_pattern_metric IN ('8x165.1', '8x180', '8x170', '8x200')
      AND offset IS NOT NULL
    GROUP BY bolt_pattern_metric, offset
    ORDER BY bolt_pattern_metric, offset::int
  `;
  
  console.log('8-lug wheel offset distribution:');
  for (const row of results) {
    console.log(`  ${row.bolt_pattern_metric}: offset ${row.offset}mm (${row.count} wheels)`);
  }
  
  // Also check what DRW-specific wheels exist (typically narrower widths)
  const drwCandidates = await prisma.$queryRaw`
    SELECT 
      bolt_pattern_metric,
      offset::int as offset,
      width,
      COUNT(*)::int as count
    FROM techfeed_wheels
    WHERE bolt_pattern_metric IN ('8x165.1', '8x180', '8x170', '8x200')
      AND offset IS NOT NULL
      AND (offset::int >= 75 OR offset::int <= -150)
    GROUP BY bolt_pattern_metric, offset, width
    ORDER BY bolt_pattern_metric, offset::int
  `;
  
  console.log('\nWheels with DRW-style offsets (>=+75 or <=-150):');
  for (const row of drwCandidates) {
    console.log(`  ${row.bolt_pattern_metric}: ${row.width}"x offset ${row.offset}mm (${row.count} wheels)`);
  }
  
  await prisma.$disconnect();
}

check().catch(console.error);
