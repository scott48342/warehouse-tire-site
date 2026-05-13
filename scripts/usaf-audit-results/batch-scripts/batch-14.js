// Batch 14 of 25
// Generated: 2026-05-13T17:33:17.320Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch14() {
  const updates = [
    {
      year: 2008,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["205/50R17","205/60R16","215/45R17","215/45R18","215/50R17","225/45R18"],
      // Added: ["215/45R17","215/45R18","205/50R17"]
    },
    {
      year: 2008,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2008,
      make: "Toyota",
      model: "yaris",
      oem_tire_sizes: ["175/65R14","175/65R15","185/60R15"],
      // Added: ["185/60R15","175/65R14"]
    },
    {
      year: 2008,
      make: "Volkswagen",
      model: "r32",
      oem_tire_sizes: ["215/55R17","225/40R18"],
      // Added: ["225/40R18"]
    },
    {
      year: 2008,
      make: "Volkswagen",
      model: "touareg",
      oem_tire_sizes: ["255/55R18","265/50R19","275/45R19","275/45R20"],
      // Added: ["275/45R19"]
    },
    {
      year: 2008,
      make: "Volvo",
      model: "s40",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2008,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2008,
      make: "Volvo",
      model: "v50",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2007,
      make: "Acura",
      model: "rl",
      oem_tire_sizes: ["225/55R17","245/45R18","245/50R17"],
      // Added: ["245/50R17"]
    },
    {
      year: 2007,
      make: "Audi",
      model: "s4",
      oem_tire_sizes: ["235/40R18","245/40R18","255/35R19"],
      // Added: ["235/40R18"]
    },
    {
      year: 2007,
      make: "BMW",
      model: "X3",
      oem_tire_sizes: ["235/45R19","235/50R18","235/55R17","235/55R18","235/65R17","255/40R19","255/45R19","255/50R18"],
      // Added: ["235/55R17","235/50R18","235/45R19","255/40R19"]
    },
    {
      year: 2007,
      make: "Buick",
      model: "rendezvous",
      oem_tire_sizes: ["225/55R17","225/60R16","225/60R17"],
      // Added: ["225/60R17"]
    },
    {
      year: 2007,
      make: "Chrysler",
      model: "sebring",
      oem_tire_sizes: ["215/55R17","215/60R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2007,
      make: "Dodge",
      model: "caliber",
      oem_tire_sizes: ["195/65R15","205/70R15","215/45R18","215/50R17","215/55R17","215/55R18","215/60R17","225/40R19"],
      // Added: ["205/70R15","215/60R17","215/55R18"]
    },
    {
      year: 2007,
      make: "Dodge",
      model: "charger",
      oem_tire_sizes: ["215/50R17","215/65R17","225/50R17","225/55R18","225/60R17","225/60R18","235/50R20","235/55R18","245/45R20","255/45R20"],
      // Added: ["225/60R18"]
    },
    {
      year: 2007,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/60R18","245/65R17"],
      // Added: ["245/65R17","245/60R18"]
    },
    {
      year: 2007,
      make: "Honda",
      model: "fit",
      oem_tire_sizes: ["175/65R15","185/55R16","195/55R15","205/45R16"],
      // Added: ["195/55R15","205/45R16"]
    },
    {
      year: 2007,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/50R18","245/75R16","245/75R17","255/70R16","255/70R18","255/75R17","265/55R19","265/65R18","265/70R17","285/50R20","LT245/75R16","LT255/75R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2007,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/65R18","235/70R16","245/60R18","245/65R17"],
      // Added: ["245/65R17","235/65R18"]
    },
    {
      year: 2007,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","225/50R17","235/45R18"],
      // Added: ["225/50R17","235/45R18"]
    },
    {
      year: 2007,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","235/45R17"],
      // Added: ["215/55R16","235/45R17"]
    },
    {
      year: 2007,
      make: "Saab",
      model: "9-5",
      oem_tire_sizes: ["215/55R16","225/50R17","235/45R17","235/45R18"],
      // Added: ["235/45R17"]
    },
    {
      year: 2007,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["205/50R17","205/60R16","215/45R17","215/45R18","215/50R17","225/45R18"],
      // Added: ["215/45R17","215/45R18","205/50R17"]
    },
    {
      year: 2007,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","275/60R18"],
      // Added: ["275/60R18"]
    },
    {
      year: 2007,
      make: "Toyota",
      model: "sequoia",
      oem_tire_sizes: ["265/65R17","265/70R17"],
      // Added: ["265/65R17"]
    },
  ];

  console.log('Applying batch 14...');
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

  console.log(`Batch 14 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch14()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());