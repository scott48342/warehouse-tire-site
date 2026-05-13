// Batch 10 of 25
// Generated: 2026-05-13T17:33:17.316Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch10() {
  const updates = [
    {
      year: 2013,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/45R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2013,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","305/45R22","LT265/70R17"],
      // Added: ["LT265/70R17"]
    },
    {
      year: 2013,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["215/50R17","225/50R17","225/50R18","225/55R17"],
      // Added: ["215/50R17","225/50R17"]
    },
    {
      year: 2013,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2013,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2012,
      make: "Chevrolet",
      model: "Suburban 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT245/75R16","LT265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2012,
      make: "Chevrolet",
      model: "volt",
      oem_tire_sizes: ["215/45R17","215/50R17","215/55R17"],
      // Added: ["215/55R17"]
    },
    {
      year: 2012,
      make: "Dodge",
      model: "caliber",
      oem_tire_sizes: ["195/65R15","205/70R15","215/45R18","215/50R17","215/55R17","215/55R18","215/60R17","225/40R19"],
      // Added: ["205/70R15","215/60R17","215/55R18"]
    },
    {
      year: 2012,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["255/45R20"]
    },
    {
      year: 2012,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["215/65R17","225/60R17","235/50R18","235/55R17","255/40R19","265/40R19","285/35R19"],
      // Added: ["215/65R17","225/60R17","255/40R19","285/35R19","265/40R19"]
    },
    {
      year: 2012,
      make: "GMC",
      model: "canyon",
      oem_tire_sizes: ["215/70R15","215/70R16","215/75R15","235/50R18","235/75R15","235/75R16","245/65R17","265/65R18","265/70R17"],
      // Added: ["215/70R16","235/75R16","265/70R17","235/50R18","265/65R18"]
    },
    {
      year: 2012,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/45R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17","LT265/70R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2012,
      make: "Lincoln",
      model: "mkz",
      oem_tire_sizes: ["225/50R17","235/50R17"],
      // Added: ["225/50R17"]
    },
    {
      year: 2012,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","235/45R18"],
      // Added: ["235/45R18"]
    },
    {
      year: 2012,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","305/45R22","LT245/70R17","LT265/70R17"],
      // Added: ["LT265/70R17","LT245/70R17"]
    },
    {
      year: 2012,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2011,
      make: "Buick",
      model: "lucerne",
      oem_tire_sizes: ["225/55R17","225/60R16","235/50R18","235/55R17","245/50R18"],
      // Added: ["235/55R17","245/50R18"]
    },
    {
      year: 2011,
      make: "Chevrolet",
      model: "Suburban 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT245/75R16","LT265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2011,
      make: "Chevrolet",
      model: "volt",
      oem_tire_sizes: ["215/45R17","215/50R17","215/55R17"],
      // Added: ["215/55R17"]
    },
    {
      year: 2011,
      make: "Dodge",
      model: "caliber",
      oem_tire_sizes: ["195/65R15","205/70R15","215/45R18","215/50R17","215/55R17","215/55R18","215/60R17","225/40R19"],
      // Added: ["205/70R15","215/60R17","215/55R18"]
    },
    {
      year: 2011,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["255/45R20"]
    },
    {
      year: 2011,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["215/65R17","225/60R17","235/50R18","235/55R17","255/40R19","265/40R19","285/35R19"],
      // Added: ["215/65R17","225/60R17","255/40R19","285/35R19","265/40R19"]
    },
    {
      year: 2011,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/45R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2011,
      make: "Kia",
      model: "soul",
      oem_tire_sizes: ["205/55R16","205/60R16","215/55R17","225/45R18","235/45R18"],
      // Added: ["205/55R16","225/45R18"]
    },
    {
      year: 2011,
      make: "Lincoln",
      model: "mkz",
      oem_tire_sizes: ["225/50R17","235/50R17"],
      // Added: ["225/50R17"]
    },
  ];

  console.log('Applying batch 10...');
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

  console.log(`Batch 10 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch10()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());