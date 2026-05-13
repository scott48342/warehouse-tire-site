// Batch 8 of 25
// Generated: 2026-05-13T17:33:17.311Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch8() {
  const updates = [
    {
      year: 2019,
      make: "GMC",
      model: "Sierra 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","275/60R20","285/45R22","LT265/70R17","LT275/65R18"],
      // Added: ["LT265/70R17","LT275/65R18"]
    },
    {
      year: 2019,
      make: "GMC",
      model: "acadia",
      oem_tire_sizes: ["235/55R20","235/65R18","245/60R18","255/55R20","275/45R21"],
      // Added: ["235/55R20","235/65R18"]
    },
    {
      year: 2019,
      make: "Infiniti",
      model: "q60",
      oem_tire_sizes: ["225/55R18","245/40R19","255/40R19","275/35R19"],
      // Added: ["255/40R19"]
    },
    {
      year: 2019,
      make: "Lincoln",
      model: "mkc",
      oem_tire_sizes: ["235/45R19","235/50R18","235/50R19","235/55R18","245/45R19"],
      // Added: ["245/45R19","235/45R19","235/50R18"]
    },
    {
      year: 2019,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2019,
      make: "Volvo",
      model: "v90",
      oem_tire_sizes: ["245/45R19","255/40R19"],
      // Added: ["255/40R19"]
    },
    {
      year: 2017,
      make: "Buick",
      model: "cascada",
      oem_tire_sizes: ["235/45R18","245/35R20","245/40R20"],
      // Added: ["245/40R20"]
    },
    {
      year: 2017,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["265/70R17","275/45R22","275/55R20","275/65R18","315/70R17","LT245/70R17","LT275/65R18","LT315/70R17"],
      // Added: ["LT245/70R17","LT275/65R18","LT315/70R17"]
    },
    {
      year: 2017,
      make: "GMC",
      model: "acadia",
      oem_tire_sizes: ["235/55R20","235/65R17","235/65R18","245/60R18","245/65R17","255/55R20","275/45R21"],
      // Added: ["235/55R20","235/65R18","245/65R17"]
    },
    {
      year: 2017,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/70R18","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2017,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","285/70R17","305/45R22","LT265/70R17","LT285/70R17"],
      // Added: ["LT265/70R17","LT285/70R17"]
    },
    {
      year: 2017,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2016,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2016,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R20","245/45R19","245/50R18","245/50R19","275/35R20","275/40R19"],
      // Added: ["245/45R19","275/40R19","245/50R18","245/40R20","275/35R20"]
    },
    {
      year: 2016,
      make: "Buick",
      model: "cascada",
      oem_tire_sizes: ["235/45R18","245/35R20","245/40R20"],
      // Added: ["245/40R20"]
    },
    {
      year: 2016,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["245/70R17","265/70R17","275/45R22","275/55R20","275/65R18","LT245/70R17","LT275/65R18"],
      // Added: ["LT275/65R18"]
    },
    {
      year: 2016,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/70R18","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2016,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","285/70R17","305/45R22","LT265/70R17","LT285/70R17"],
      // Added: ["LT265/70R17","LT285/70R17"]
    },
    {
      year: 2016,
      make: "Scion",
      model: "ia",
      oem_tire_sizes: ["185/55R16","185/60R15","185/60R16"],
      // Added: ["185/60R16"]
    },
    {
      year: 2016,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2016,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["235/40R18","245/45R18"],
      // Added: ["235/40R18"]
    },
    {
      year: 2015,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2015,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R20","245/45R19","245/50R18","245/50R19","275/35R20","275/40R19"],
      // Added: ["245/45R19","275/40R19","245/40R20","275/35R20","245/50R18"]
    },
    {
      year: 2015,
      make: "Chevrolet",
      model: "volt",
      oem_tire_sizes: ["215/45R17","215/50R17","215/55R17"],
      // Added: ["215/55R17"]
    },
    {
      year: 2015,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["245/70R17","265/70R17","275/45R22","275/55R20","275/65R18","LT245/70R17","LT275/65R18"],
      // Added: ["LT275/65R18"]
    },
  ];

  console.log('Applying batch 8...');
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

  console.log(`Batch 8 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch8()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());