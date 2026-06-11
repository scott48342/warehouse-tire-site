import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const prisma = new PrismaClient();

async function main() {
  // Get basic stats
  const stats = await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int as total_records,
      MIN(year)::int as min_year,
      MAX(year)::int as max_year,
      COUNT(DISTINCT make)::int as unique_makes,
      COUNT(DISTINCT model)::int as unique_models
    FROM vehicle_fitments
  `;
  
  // Get year coverage
  const yearCoverage = await prisma.$queryRaw`
    SELECT year, COUNT(*)::int as count
    FROM vehicle_fitments
    WHERE year >= 2000
    GROUP BY year
    ORDER BY year
  `;
  
  // Get makes
  const makes = await prisma.$queryRaw`
    SELECT DISTINCT make
    FROM vehicle_fitments
    WHERE year >= 2000
    ORDER BY make
  `;
  
  // Sample of data structure
  const sample = await prisma.vehicle_fitments.findMany({
    take: 5,
    where: { year: { gte: 2020 } }
  });
  
  console.log('=== DATABASE STATS ===');
  console.log(JSON.stringify(stats[0], null, 2));
  
  console.log('\n=== YEAR COVERAGE (2000+) ===');
  console.log(JSON.stringify(yearCoverage, null, 2));
  
  console.log('\n=== MAKES ===');
  console.log(makes.map(m => m.make).join(', '));
  
  console.log('\n=== SAMPLE RECORD STRUCTURE ===');
  if (sample[0]) {
    console.log(JSON.stringify(sample[0], null, 2));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
