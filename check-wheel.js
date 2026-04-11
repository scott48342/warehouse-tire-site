const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  
  try {
    const results = await p.$queryRaw`
      SELECT sku, product_desc, diameter, width, "offset", bolt_pattern_metric 
      FROM techfeed_wheels 
      WHERE product_desc ILIKE '%overlook%' OR product_desc ILIKE '%xd860%' OR product_desc ILIKE '%legacy%xd%'
      LIMIT 20
    `;
    console.log(JSON.stringify(results, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await p.$disconnect();
  }
}

main();
