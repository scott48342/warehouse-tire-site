// Batch 9 of 25
// Generated: 2026-05-13T17:33:17.313Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch9() {
  const updates = [
    {
      year: 2015,
      make: "GMC",
      model: "Sierra 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","275/60R20","285/45R22","LT265/70R17"],
      // Added: ["LT265/70R17"]
    },
    {
      year: 2015,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/70R18","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2015,
      make: "Mazda",
      model: "cx-9",
      oem_tire_sizes: ["245/50R20","245/60R18","255/50R20","255/60R18"],
      // Added: ["245/60R18","245/50R20"]
    },
    {
      year: 2015,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","285/70R17","305/45R22","LT265/70R17","LT285/70R17"],
      // Added: ["LT265/70R17","LT285/70R17"]
    },
    {
      year: 2015,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2015,
      make: "Toyota",
      model: "tacoma",
      oem_tire_sizes: ["245/75R16","255/45R18","265/65R17","265/70R16","LT265/70R16"],
      // Added: ["LT265/70R16"]
    },
    {
      year: 2015,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["235/40R18","245/45R18"],
      // Added: ["235/40R18"]
    },
    {
      year: 2014,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R20","265/35R20"],
      // Added: ["255/35R20"]
    },
    {
      year: 2014,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2014,
      make: "Chevrolet",
      model: "volt",
      oem_tire_sizes: ["215/45R17","215/50R17","215/55R17"],
      // Added: ["215/55R17"]
    },
    {
      year: 2014,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["255/45R20"]
    },
    {
      year: 2014,
      make: "Dodge",
      model: "charger",
      oem_tire_sizes: ["215/55R17","215/65R17","225/50R17","225/60R17","225/60R18","235/50R20","235/55R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["225/60R18"]
    },
    {
      year: 2014,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["215/65R17","225/60R17","235/50R18","235/55R17","255/40R19","265/40R19"],
      // Added: ["215/65R17","225/60R17","265/40R19","255/40R19"]
    },
    {
      year: 2014,
      make: "GMC",
      model: "Sierra 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","275/60R20","285/45R22","LT265/70R17"],
      // Added: ["LT265/70R17"]
    },
    {
      year: 2014,
      make: "Honda",
      model: "fit",
      oem_tire_sizes: ["175/65R15","185/55R16","185/65R15"],
      // Added: ["185/65R15"]
    },
    {
      year: 2014,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/45R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2014,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","305/45R22","LT265/70R17"],
      // Added: ["LT265/70R17"]
    },
    {
      year: 2014,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2014,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2013,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R20","265/35R20"],
      // Added: ["255/35R20"]
    },
    {
      year: 2013,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2013,
      make: "Chevrolet",
      model: "Suburban 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT245/75R16","LT265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2013,
      make: "Chevrolet",
      model: "volt",
      oem_tire_sizes: ["215/45R17","215/50R17","215/55R17"],
      // Added: ["215/55R17"]
    },
    {
      year: 2013,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["255/45R20"]
    },
    {
      year: 2013,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["215/65R17","225/60R17","235/50R18","235/55R17","255/40R19","265/40R19","285/35R19"],
      // Added: ["215/65R17","225/60R17","255/40R19","285/35R19","265/40R19"]
    },
  ];

  console.log('Applying batch 9...');
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

  console.log(`Batch 9 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch9()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());