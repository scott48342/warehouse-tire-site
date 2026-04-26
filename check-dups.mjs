import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();

const total = await prisma.vehicle_fitments.count();

const dups = await prisma.$queryRaw`
  SELECT year, make, model, trim, "boltPattern", COUNT(*) as cnt
  FROM vehicle_fitments
  GROUP BY year, make, model, trim, "boltPattern"
  HAVING COUNT(*) > 1
  LIMIT 20
`;

console.log('Total records:', total);
console.log('Duplicate groups (same year/make/model/trim/bolt):', dups.length);
if (dups.length > 0) {
  console.log('Sample duplicates:');
  console.log(JSON.stringify(dups.slice(0, 5), (k, v) => typeof v === 'bigint' ? Number(v) : v, 2));
}

await prisma.$disconnect();
