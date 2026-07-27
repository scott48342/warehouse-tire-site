const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRaw`
    SELECT modification_id, bolt_pattern, center_bore_mm, offset_min, offset_max, display_trim
    FROM vehicle_fitments 
    WHERE year = 1965 AND LOWER(make) = 'chevrolet' AND LOWER(model) = 'malibu'
  `;
  console.log(JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}
main();
