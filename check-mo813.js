const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const count = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as count FROM wheels WHERE style ILIKE '%mo813%' OR part_number ILIKE '%mo813%'`);
  console.log('Total SKUs matching MO813:', count[0].count);
  
  const samples = await p.$queryRawUnsafe(`SELECT part_number, style, diameter, width, bolt_pattern FROM wheels WHERE style ILIKE '%mo813%' OR part_number ILIKE '%mo813%' LIMIT 10`);
  console.log('\nSample SKUs:');
  samples.forEach(s => console.log(`  ${s.part_number} - ${s.style} - ${s.diameter}x${s.width} - ${s.bolt_pattern}`));
}

main().finally(() => p.$disconnect());
