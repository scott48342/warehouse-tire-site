// Batch 13 of 25
// Generated: 2026-05-13T17:33:17.320Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch13() {
  const updates = [
    {
      year: 2009,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","225/50R17","235/45R17","235/45R18"],
      // Added: ["215/55R16","235/45R17","225/50R17","235/45R18"]
    },
    {
      year: 2009,
      make: "Saab",
      model: "9-5",
      oem_tire_sizes: ["215/55R16","225/50R17","235/45R17","235/45R18"],
      // Added: ["235/45R17"]
    },
    {
      year: 2009,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["205/50R17","205/60R16","215/45R17","215/45R18","215/50R17","225/45R18"],
      // Added: ["205/50R17","215/45R17","215/45R18"]
    },
    {
      year: 2009,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","285/60R18"],
      // Added: ["285/60R18"]
    },
    {
      year: 2009,
      make: "Toyota",
      model: "yaris",
      oem_tire_sizes: ["175/65R14","175/65R15","185/60R15"],
      // Added: ["175/65R14","185/60R15"]
    },
    {
      year: 2009,
      make: "Volkswagen",
      model: "touareg",
      oem_tire_sizes: ["255/55R18","265/50R19","275/45R19","275/45R20"],
      // Added: ["275/45R19"]
    },
    {
      year: 2009,
      make: "Volvo",
      model: "s40",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2009,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2009,
      make: "Volvo",
      model: "v50",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2008,
      make: "Acura",
      model: "rl",
      oem_tire_sizes: ["225/55R17","245/45R18","245/50R17"],
      // Added: ["245/50R17"]
    },
    {
      year: 2008,
      make: "Audi",
      model: "s4",
      oem_tire_sizes: ["235/40R18","245/40R18","255/35R19"],
      // Added: ["235/40R18"]
    },
    {
      year: 2008,
      make: "BMW",
      model: "X3",
      oem_tire_sizes: ["235/45R19","235/50R18","235/55R17","235/55R18","235/65R17","255/40R19","255/45R19","255/50R18"],
      // Added: ["235/55R17","235/50R18","235/45R19","255/40R19"]
    },
    {
      year: 2008,
      make: "Chevrolet",
      model: "Suburban 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT245/75R16","LT265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2008,
      make: "Chrysler",
      model: "sebring",
      oem_tire_sizes: ["215/55R17","215/60R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2008,
      make: "Dodge",
      model: "caliber",
      oem_tire_sizes: ["195/65R15","205/70R15","215/45R18","215/50R17","215/55R17","215/55R18","215/60R17","225/40R19","225/45R19"],
      // Added: ["205/70R15","215/60R17","215/55R18","225/45R19"]
    },
    {
      year: 2008,
      make: "Dodge",
      model: "challenger",
      oem_tire_sizes: ["215/65R17","235/55R18","245/45R18","245/45R20","255/45R20","275/40R20","305/35R20"],
      // Added: ["255/45R20"]
    },
    {
      year: 2008,
      make: "Dodge",
      model: "charger",
      oem_tire_sizes: ["215/50R17","215/65R17","225/50R17","225/55R18","225/60R17","225/60R18","235/50R20","235/55R18","245/45R20","255/45R20"],
      // Added: ["225/60R18"]
    },
    {
      year: 2008,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/60R18","245/65R17"],
      // Added: ["245/65R17","245/60R18"]
    },
    {
      year: 2008,
      make: "Honda",
      model: "fit",
      oem_tire_sizes: ["175/65R15","185/55R16","195/55R15"],
      // Added: ["195/55R15"]
    },
    {
      year: 2008,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["225/75R16","235/50R18","245/75R16","245/75R17","255/70R18","255/75R17","LT245/75R16","LT255/70R18","LT255/75R17"],
      // Added: ["LT255/75R17"]
    },
    {
      year: 2008,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/65R18","235/70R16","245/60R18","245/65R17"],
      // Added: ["245/65R17","235/65R18"]
    },
    {
      year: 2008,
      make: "Mercury",
      model: "sable",
      oem_tire_sizes: ["215/55R17","215/60R16","215/60R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2008,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","225/50R17","235/45R18"],
      // Added: ["225/50R17","235/45R18"]
    },
    {
      year: 2008,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","225/50R17","235/45R17","235/45R18"],
      // Added: ["215/55R16","235/45R17","225/50R17","235/45R18"]
    },
    {
      year: 2008,
      make: "Saab",
      model: "9-5",
      oem_tire_sizes: ["215/55R16","225/50R17","235/45R17","235/45R18"],
      // Added: ["235/45R17"]
    },
  ];

  console.log('Applying batch 13...');
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

  console.log(`Batch 13 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch13()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());