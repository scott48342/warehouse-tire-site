const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function search() {
  // Find black wheels in 5x120, staggered-friendly sizes
  const wheels = await prisma.wheelProduct.findMany({
    where: {
      boltPattern: '5x120',
      finish: { contains: 'Black', mode: 'insensitive' },
      diameter: { in: [18, 19, 20] },
      width: { gte: 8, lte: 10 },
    },
    select: {
      sku: true,
      brand: true,
      model: true,
      finish: true,
      diameter: true,
      width: true,
      offset: true,
      boltPattern: true,
      msrp: true
    },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }, { width: 'asc' }],
    take: 60
  });
  
  // Group by model to find staggered pairs
  const byModel = {};
  wheels.forEach(w => {
    const key = `${w.brand} ${w.model} ${w.finish}`;
    if (!byModel[key]) byModel[key] = [];
    byModel[key].push(w);
  });
  
  // Find models with multiple widths (staggered potential)
  console.log('\n=== STAGGERED-CAPABLE BLACK WHEELS (5x120) ===\n');
  
  Object.entries(byModel).forEach(([model, sizes]) => {
    const widths = [...new Set(sizes.map(s => s.width))].sort((a,b) => a-b);
    if (widths.length >= 2) {
      console.log(`\n${model}`);
      console.log('-'.repeat(50));
      sizes.forEach(s => {
        console.log(`  ${s.diameter}x${s.width} ET${s.offset} - $${s.msrp} (${s.sku})`);
      });
    }
  });
  
  // Also show single-width options
  console.log('\n\n=== SINGLE WIDTH OPTIONS ===\n');
  Object.entries(byModel).forEach(([model, sizes]) => {
    const widths = [...new Set(sizes.map(s => s.width))];
    if (widths.length === 1) {
      const s = sizes[0];
      console.log(`${model}: ${s.diameter}x${s.width} ET${s.offset} - $${s.msrp}`);
    }
  });
  
  console.log('\n\nTotal wheels found:', wheels.length);
  await prisma.$disconnect();
}

search().catch(e => { console.error(e); process.exit(1); });
