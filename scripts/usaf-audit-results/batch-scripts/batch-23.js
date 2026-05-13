// Batch 23 of 25
// Generated: 2026-05-13T17:33:17.331Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch23() {
  const updates = [
    {
      year: 2017,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["255/70R17","265/60R17","265/65R18","265/70R17","275/55R20","285/45R22"],
      // Added: ["265/60R17","255/70R17","265/70R17"]
    },
    {
      year: 2016,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["255/70R17","265/60R17","265/65R18","265/70R17","275/55R20","285/45R22"],
      // Added: ["265/60R17","255/70R17","265/70R17"]
    },
    {
      year: 2015,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["255/70R17","265/60R17","265/65R18","265/70R17","275/55R20","285/45R22"],
      // Added: ["265/60R17","255/70R17","265/70R17"]
    },
    {
      year: 2009,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2008,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2007,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2005,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["245/75R16","265/65R17","265/70R16","265/70R17","LT245/75R16"],
      // Added: ["LT245/75R16"]
    },
    {
      year: 2017,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","245/45R20","255/45R19"],
      // Added: ["255/45R19","245/45R20"]
    },
    {
      year: 2016,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","245/45R20","255/45R19"],
      // Added: ["245/45R20","255/45R19"]
    },
    {
      year: 2015,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["235/60R17","255/45R19","245/45R20"]
    },
    {
      year: 2014,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["255/45R19","235/60R17","245/45R20"]
    },
    {
      year: 2013,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["235/60R17","255/45R19","245/45R20"]
    },
    {
      year: 2012,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["255/45R19","235/60R17","245/45R20"]
    },
    {
      year: 2011,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["235/60R17","255/45R19","245/45R20"]
    },
    {
      year: 2010,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["235/55R18","235/60R17","245/45R20","255/45R19"],
      // Added: ["235/60R17","255/45R19","245/45R20"]
    },
    {
      year: 2009,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["215/60R17","225/55R18"],
      // Added: ["225/55R18"]
    },
    {
      year: 2008,
      make: "Ford",
      model: "taurus",
      oem_tire_sizes: ["215/60R17","225/55R18"],
      // Added: ["225/55R18"]
    },
    {
      year: 2013,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/40R18","265/40R18","245/35R19","265/35R19"]
    },
    {
      year: 2012,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/35R19","265/35R19","245/40R18","265/40R18"]
    },
    {
      year: 2011,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/40R18","265/40R18","245/35R19","265/35R19"]
    },
    {
      year: 2010,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/40R18","265/40R18","245/35R19","265/35R19"]
    },
    {
      year: 2009,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/40R18","265/40R18","245/35R19","265/35R19"]
    },
    {
      year: 2008,
      make: "BMW",
      model: "M3",
      oem_tire_sizes: ["245/35R19","245/40R18","255/35R19","255/40R18","265/35R19","265/40R18","275/30R20","275/35R19","275/40R18","285/30R20"],
      // Added: ["245/40R18","265/40R18","245/35R19","265/35R19"]
    },
    {
      year: 2026,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","275/40R19","305/30R19"],
      // Added: ["265/35R20","305/30R19"]
    },
    {
      year: 2025,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","275/40R19","305/30R19"],
      // Added: ["305/30R19","265/35R20"]
    },
  ];

  console.log('Applying batch 23...');
  let updated = 0;
  let errors = 0;

  for (const upd of updates) {
    try {
      // Find matching records
      const records = await prisma.vehicle_fitments.findMany({
        where: {
          year: upd.year,
          make: { equals: upd.make, mode: 'insensitive' },
          model: { equals: upd.model, mode: 'insensitive' },
        },
        select: { id: true, oem_tire_sizes: true },
      });

      for (const record of records) {
        // Merge existing + new sizes
        const existing = record.oem_tire_sizes || [];
        const merged = [...new Set([...existing, ...upd.oem_tire_sizes])].sort();

        await prisma.vehicle_fitments.update({
          where: { id: record.id },
          data: { oem_tire_sizes: merged },
        });
        updated++;
      }
    } catch (err) {
      console.error(`Error updating ${upd.year} ${upd.make} ${upd.model}:`, err.message);
      errors++;
    }
  }

  console.log(`Batch 23 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch23()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());