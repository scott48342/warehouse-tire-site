const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const f = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM vehicle_fitments');
  const w = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM wheels');
  const t = await p.$queryRawUnsafe('SELECT COUNT(*) as c FROM tires');
  console.log('Fitments:', Number(f[0].c));
  console.log('Wheels:', Number(w[0].c));
  console.log('Tires:', Number(t[0].c));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
