// Batch 11 of 25
// Generated: 2026-05-13T17:33:17.318Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch11() {
  const updates = [
    {
      year: 2011,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","235/45R18"],
      // Added: ["235/45R18"]
    },
    {
      year: 2011,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/60R20","275/65R18","285/45R22","305/45R22","LT275/70R17"],
      // Added: ["LT275/70R17"]
    },
    {
      year: 2011,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","225/50R17","235/45R17"],
      // Added: ["215/55R16","235/45R17","225/50R17"]
    },
    {
      year: 2011,
      make: "Saab",
      model: "9-5",
      oem_tire_sizes: ["215/55R16","225/50R17","225/55R17","235/45R18","245/45R18"],
      // Added: ["225/55R17","245/45R18"]
    },
    {
      year: 2011,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["215/50R17","225/45R18","225/50R17","225/50R18","225/55R17"],
      // Added: ["215/50R17","225/45R18","225/50R17"]
    },
    {
      year: 2011,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2011,
      make: "Toyota",
      model: "yaris",
      oem_tire_sizes: ["175/65R15","185/60R15"],
      // Added: ["185/60R15"]
    },
    {
      year: 2011,
      make: "Volvo",
      model: "s40",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2011,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2011,
      make: "Volvo",
      model: "v50",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2010,
      make: "BMW",
      model: "X3",
      oem_tire_sizes: ["235/45R19","235/50R18","235/55R17","235/55R18","235/65R17","255/40R19","255/45R19","255/50R18"],
      // Added: ["235/55R17","235/50R18","235/45R19","255/40R19"]
    },
    {
      year: 2010,
      make: "Buick",
      model: "lucerne",
      oem_tire_sizes: ["225/55R17","225/60R16","235/50R18","235/55R17","245/50R18"],
      // Added: ["235/55R17","245/50R18"]
    },
    {
      year: 2010,
      make: "Chevrolet",
      model: "Suburban 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT245/75R16","LT265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2010,
      make: "Chrysler",
      model: "sebring",
      oem_tire_sizes: ["215/55R17","215/60R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2010,
      make: "Dodge",
      model: "caliber",
      oem_tire_sizes: ["195/65R15","205/70R15","215/45R18","215/50R17","215/55R17","215/55R18","215/60R17","225/40R19"],
      // Added: ["205/70R15","215/60R17","215/55R18"]
    },
    {
      year: 2010,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","225/60R18","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["225/60R18","255/45R20"]
    },
    {
      year: 2010,
      make: "Dodge",
      model: "charger",
      oem_tire_sizes: ["215/55R17","215/65R17","225/50R17","225/55R18","225/60R17","225/60R18","235/50R20","235/55R18","245/45R20","255/45R20"],
      // Added: ["225/60R18"]
    },
    {
      year: 2010,
      make: "Ford",
      model: "mustang",
      oem_tire_sizes: ["215/60R17","235/50R18","235/55R17","255/40R19","255/45R18","285/35R19","285/40R18"],
      // Added: ["215/60R17","255/45R18","285/40R18","255/40R19","285/35R19"]
    },
    {
      year: 2010,
      make: "Jeep",
      model: "Grand Cherokee",
      oem_tire_sizes: ["245/60R18","255/45R20","265/50R20","265/60R18","275/45R21","285/40R20"],
      // Added: ["245/60R18","255/45R20","285/40R20"]
    },
    {
      year: 2010,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/45R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2010,
      make: "Kia",
      model: "soul",
      oem_tire_sizes: ["205/55R16","205/60R16","215/55R17","225/45R18","235/45R18"],
      // Added: ["205/55R16","225/45R18"]
    },
    {
      year: 2010,
      make: "Lincoln",
      model: "mkz",
      oem_tire_sizes: ["225/50R17","235/50R17"],
      // Added: ["225/50R17"]
    },
    {
      year: 2010,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/65R18","235/70R16","245/60R18","245/65R17"],
      // Added: ["245/65R17","235/65R18"]
    },
    {
      year: 2010,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","225/50R17","235/45R18"],
      // Added: ["225/50R17","235/45R18"]
    },
    {
      year: 2010,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","225/50R17","235/45R17","235/45R18"],
      // Added: ["215/55R16","235/45R17","225/50R17","235/45R18"]
    },
  ];

  console.log('Applying batch 11...');
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

  console.log(`Batch 11 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch11()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());