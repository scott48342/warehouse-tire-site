import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check OEM 22" tire sizes for GM trucks
  const sizes = await prisma.$queryRaw`
    SELECT DISTINCT tire_size 
    FROM vehicle_fitments 
    WHERE make IN ('Chevrolet', 'GMC') 
      AND (model LIKE '%Silverado%' OR model LIKE '%Sierra%')
      AND tire_size LIKE '%R22'
    ORDER BY tire_size
  `;
  
  console.log('OEM 22" tire sizes for GM Silverado/Sierra:');
  console.log(JSON.stringify(sizes, null, 2));
  
  // Also check what years have 22" wheels
  const years = await prisma.$queryRaw`
    SELECT DISTINCT year, model, tire_size, wheel_diameter
    FROM vehicle_fitments 
    WHERE make IN ('Chevrolet', 'GMC') 
      AND (model LIKE '%Silverado%' OR model LIKE '%Sierra%')
      AND wheel_diameter = 22
    ORDER BY year DESC, model, tire_size
    LIMIT 20
  `;
  
  console.log('\nYears with factory 22" wheels:');
  console.log(JSON.stringify(years, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
