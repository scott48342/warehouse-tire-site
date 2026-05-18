const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = await prisma.vehicle_fitments.findMany({
    where: {
      year: '2007',
      make: { contains: 'BMW', mode: 'insensitive' },
      model: { contains: '328', mode: 'insensitive' }
    },
    orderBy: [{ trim: 'asc' }, { modification: 'asc' }]
  });
  
  console.log(`Found ${results.length} fitments for 2007 BMW 328i:\n`);
  
  results.forEach(r => {
    console.log(`=== ${r.trim || 'Base'} - ${r.modification || 'Stock'} ===`);
    console.log(`Bolt Pattern: ${r.bolt_pattern}`);
    console.log(`Center Bore: ${r.center_bore}mm`);
    console.log(`Front Wheel: ${r.front_wheel_width}x${r.front_wheel_diameter} ET${r.front_offset}`);
    console.log(`Rear Wheel: ${r.rear_wheel_width}x${r.rear_wheel_diameter} ET${r.rear_offset}`);
    console.log(`Front Tire: ${r.front_tire_width}/${r.front_tire_aspect}R${r.front_tire_diameter}`);
    console.log(`Rear Tire: ${r.rear_tire_width}/${r.rear_tire_aspect}R${r.rear_tire_diameter}`);
    console.log(`Staggered: ${r.is_staggered ? 'Yes' : 'No'}`);
    console.log('');
  });
}

main().finally(() => prisma.$disconnect());
