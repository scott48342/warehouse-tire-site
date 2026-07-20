const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

async function search() {
  // 5x5 = 5x127mm bolt pattern
  const results16x7 = await prisma.$queryRaw`
    SELECT DISTINCT brand, style, finish, part_number, diameter, width, bolt_pattern, offset_mm, msrp, map_price, cost
    FROM wheel_inventory
    WHERE diameter = 16 AND width = 7 AND bolt_pattern = '5x127'
    ORDER BY brand, style
    LIMIT 50
  `;
  
  const results17x8 = await prisma.$queryRaw`
    SELECT DISTINCT brand, style, finish, part_number, diameter, width, bolt_pattern, offset_mm, msrp, map_price, cost
    FROM wheel_inventory
    WHERE diameter = 17 AND width = 8 AND bolt_pattern = '5x127'
    ORDER BY brand, style
    LIMIT 50
  `;
  
  console.log('=== 16x7 5x127 (5x5) Wheels ===');
  console.log('Count:', results16x7.length);
  results16x7.forEach(w => console.log(`${w.brand} ${w.style} ${w.finish} | ${w.part_number} | Offset: ${w.offset_mm}mm | MSRP: $${w.msrp}`));
  
  console.log('\n=== 17x8 5x127 (5x5) Wheels ===');
  console.log('Count:', results17x8.length);
  results17x8.forEach(w => console.log(`${w.brand} ${w.style} ${w.finish} | ${w.part_number} | Offset: ${w.offset_mm}mm | MSRP: $${w.msrp}`));
  
  await prisma.$disconnect();
}

search().catch(e => { console.error(e); process.exit(1); });
