const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.POSTGRES_URL } }
});

async function checkDRWWheels() {
  console.log('=== DRW WHEEL OFFSET DISTRIBUTION (8x180 bolt pattern) ===\n');
  
  // Get offset distribution
  const offsetDist = await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN offset::numeric < -150 THEN 'DRW Outer Extreme (<-150)'
        WHEN offset::numeric >= -150 AND offset::numeric < -50 THEN 'DRW Outer (-150 to -50)'
        WHEN offset::numeric >= -50 AND offset::numeric < 0 THEN 'Negative (-50 to 0)'
        WHEN offset::numeric >= 0 AND offset::numeric < 50 THEN 'Mild (0 to 50)'
        WHEN offset::numeric >= 50 AND offset::numeric < 100 THEN 'High (50 to 100)'
        WHEN offset::numeric >= 100 THEN 'DRW Inner/Front (100+)'
        ELSE 'Unknown'
      END as offset_range,
      COUNT(*)::int as count,
      MIN(offset::numeric)::int as min_offset,
      MAX(offset::numeric)::int as max_offset
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
    GROUP BY 1
    ORDER BY min_offset
  `;
  
  console.log('Offset Distribution:');
  offsetDist.forEach(row => {
    console.log(`  ${row.offset_range}: ${row.count} wheels (${row.min_offset} to ${row.max_offset})`);
  });
  
  // Get sample DRW-specific wheels (extreme offsets)
  console.log('\n=== SAMPLE DRW WHEELS (offset < -100 or > 100) ===\n');
  
  const drwWheels = await prisma.$queryRaw`
    SELECT sku, style_description, offset::int, diameter::int, width::numeric as width
    FROM techfeed_wheels
    WHERE bolt_pattern_metric = '8x180'
      AND (offset::numeric < -100 OR offset::numeric > 100)
    ORDER BY offset::numeric
    LIMIT 20
  `;
  
  drwWheels.forEach(w => {
    console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.diameter}x${w.width} | ${w.style_description?.substring(0,40)}`);
  });
  
  // Check for position indicators in style names
  console.log('\n=== WHEELS WITH POSITION INDICATORS (DF/DR/DI) ===\n');
  
  const positionWheels = await prisma.$queryRaw`
    SELECT sku, style_description, offset::int
    FROM techfeed_wheels
    WHERE bolt_pattern_metric IN ('8x180', '8x165.1', '8x170', '8x200', '8x210')
      AND (style_description ILIKE '%DRW%' OR style_description ILIKE '%DUALLY%')
    ORDER BY offset::numeric
    LIMIT 30
  `;
  
  positionWheels.forEach(w => {
    console.log(`  ${String(w.offset).padStart(5)} | ${w.sku} | ${w.style_description?.substring(0,50)}`);
  });
  
  await prisma.$disconnect();
}

checkDRWWheels().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
