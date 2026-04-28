const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check existing GMC fitments
  const existing = await prisma.vehicle_fitments.findMany({ 
    where: { make: 'GMC' }, 
    take: 5 
  });
  console.log('Existing GMC fitments:');
  console.log(JSON.stringify(existing, null, 2));
  
  // Check if Envoy exists
  const envoy = await prisma.vehicle_fitments.findMany({
    where: { make: 'GMC', model: 'Envoy' }
  });
  console.log('\nEnvoy fitments:', envoy.length);
}

main().finally(() => prisma.$disconnect());
