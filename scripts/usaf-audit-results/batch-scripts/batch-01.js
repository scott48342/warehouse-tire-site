// Batch 1 of 25
// Generated: 2026-05-13T17:33:17.303Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch1() {
  const updates = [
    {
      year: 2026,
      make: "Audi",
      model: "s5",
      oem_tire_sizes: ["245/40R19","255/35R19"],
      // Added: ["245/40R19"]
    },
    {
      year: 2026,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2026,
      make: "BMW",
      model: "iX",
      oem_tire_sizes: ["255/50R21","275/40R21"],
      // Added: ["255/50R21"]
    },
    {
      year: 2026,
      make: "Cadillac",
      model: "vistiq",
      oem_tire_sizes: ["265/40R21","285/45R21","295/40R22","305/35R23"],
      // Added: ["285/45R21","295/40R22","305/35R23"]
    },
    {
      year: 2026,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["265/60R18","265/70R17","275/50R22","275/60R20","275/70R18","315/70R17","LT265/70R18","LT315/70R17"],
      // Added: ["LT315/70R17","LT265/70R18"]
    },
    {
      year: 2026,
      make: "Ford",
      model: "ranger",
      oem_tire_sizes: ["255/65R18","255/70R16","255/70R17","265/60R18","265/65R17"],
      // Added: ["255/65R18","255/70R17"]
    },
    {
      year: 2026,
      make: "GMC",
      model: "canyon",
      oem_tire_sizes: ["245/75R16","255/65R17","265/60R18","265/65R18","275/50R22","275/60R20","LT285/70R17","LT315/70R17"],
      // Added: ["265/65R18","275/60R20","275/50R22","LT285/70R17","LT315/70R17"]
    },
    {
      year: 2026,
      make: "GMC",
      model: "terrain",
      oem_tire_sizes: ["225/60R18","225/65R17","235/50R19","235/55R19","235/65R17"],
      // Added: ["235/65R17","235/55R19"]
    },
    {
      year: 2026,
      make: "Genesis",
      model: "g90",
      oem_tire_sizes: ["245/40R21","245/45R19","245/45R20","265/35R21","265/40R20","275/35R21","275/40R20","295/30R21","295/35R20"],
      // Added: ["245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2026,
      make: "Genesis",
      model: "gv80",
      oem_tire_sizes: ["265/35R22","265/40R21","265/40R22","265/45R20","265/50R20"],
      // Added: ["265/50R20","265/40R22"]
    },
    {
      year: 2026,
      make: "Honda",
      model: "hr-v",
      oem_tire_sizes: ["215/60R17","225/55R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2026,
      make: "Honda",
      model: "prologue",
      oem_tire_sizes: ["265/45R21","275/45R21"],
      // Added: ["275/45R21"]
    },
    {
      year: 2026,
      make: "Jeep",
      model: "Gladiator",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","255/75R17","275/55R20","285/70R17","LT255/75R17","LT285/65R18","LT285/70R17"],
      // Added: ["LT285/70R17"]
    },
    {
      year: 2026,
      make: "Jeep",
      model: "Wrangler",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","275/55R20","285/70R17","315/70R17","LT285/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT315/70R17"]
    },
    {
      year: 2026,
      make: "Jeep",
      model: "gladiator",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","255/75R17","275/55R20","285/70R17","LT255/75R17","LT285/65R18","LT285/70R17"],
      // Added: ["LT285/70R17"]
    },
    {
      year: 2026,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","275/55R20","285/70R17","315/70R17","LT285/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT315/70R17"]
    },
    {
      year: 2026,
      make: "MINI",
      model: "cooper",
      oem_tire_sizes: ["175/65R15","195/55R16","205/40R18","205/45R17","215/40R18","215/45R17","225/35R18"],
      // Added: ["215/45R17","215/40R18"]
    },
    {
      year: 2026,
      make: "Mazda",
      model: "cx-70",
      oem_tire_sizes: ["255/55R19","265/45R21","265/55R19","275/45R21"],
      // Added: ["275/45R21","265/55R19"]
    },
    {
      year: 2026,
      make: "Mazda",
      model: "cx-90",
      oem_tire_sizes: ["255/55R19","265/45R21","265/55R19","275/45R21"],
      // Added: ["275/45R21","265/55R19"]
    },
    {
      year: 2026,
      make: "Nissan",
      model: "kicks",
      oem_tire_sizes: ["205/55R17","205/60R16","215/60R17","215/65R16"],
      // Added: ["215/65R16","215/60R17"]
    },
    {
      year: 2026,
      make: "Nissan",
      model: "murano",
      oem_tire_sizes: ["235/55R20","235/65R18","255/55R20"],
      // Added: ["255/55R20"]
    },
    {
      year: 2026,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["275/55R20","275/60R20","275/65R18","275/70R18","285/45R22","305/45R22","325/65R18","LT275/65R18","LT275/70R18","LT325/65R18"],
      // Added: ["LT325/65R18"]
    },
    {
      year: 2026,
      make: "Rivian",
      model: "r1s",
      oem_tire_sizes: ["275/50R22","275/55R21","275/60R20","275/65R20"],
      // Added: ["275/60R20"]
    },
    {
      year: 2026,
      make: "Rivian",
      model: "r1t",
      oem_tire_sizes: ["275/50R22","275/55R21","275/60R20","275/65R20"],
      // Added: ["275/60R20"]
    },
    {
      year: 2026,
      make: "Toyota",
      model: "Grand Highlander",
      oem_tire_sizes: ["255/50R20","255/55R20"],
      // Added: ["255/55R20"]
    },
  ];

  console.log('Applying batch 1...');
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

  console.log(`Batch 1 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch1()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());