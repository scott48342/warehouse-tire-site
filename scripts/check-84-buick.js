const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const rows = await prisma.vehicle_fitments.findMany({
    where: { year: 1984, make: 'Buick' },
    select: { model: true, display_trim: true, wheel_diameters: true, bolt_pattern: true, center_bore_mm: true }
  });
  console.log('1984 Buick fitments:');
  rows.forEach(r => console.log(JSON.stringify(r)));
  
  // Also check what wheel diameters we're storing
  console.log('\n--- Checking all 1980s Buicks wheel diameters ---');
  const all80s = await prisma.vehicle_fitments.findMany({
    where: { make: 'Buick', year: { gte: 1980, lte: 1989 } },
    select: { year: true, model: true, wheel_diameters: true }
  });
  const diameters = new Set();
  all80s.forEach(r => {
    if (r.wheel_diameters) {
      r.wheel_diameters.forEach(d => diameters.add(d));
    }
  });
  console.log('Unique wheel diameters in 1980s Buicks:', [...diameters].sort((a,b) => a-b));
}
check().then(() => prisma.$disconnect());
