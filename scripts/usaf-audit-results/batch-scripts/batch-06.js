// Batch 6 of 25
// Generated: 2026-05-13T17:33:17.308Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch6() {
  const updates = [
    {
      year: 2022,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R21","265/30R21"],
      // Added: ["255/35R21"]
    },
    {
      year: 2022,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2022,
      make: "BMW",
      model: "X7",
      oem_tire_sizes: ["275/45R21","285/45R21"],
      // Added: ["285/45R21"]
    },
    {
      year: 2022,
      make: "BMW",
      model: "iX",
      oem_tire_sizes: ["255/50R21","265/45R21","295/40R21"],
      // Added: ["255/50R21"]
    },
    {
      year: 2022,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["255/70R17","265/65R18","275/50R22","275/60R20","275/65R18","275/70R18","LT265/60R20","LT265/70R17","LT275/65R18","LT275/70R18"],
      // Added: ["LT265/70R17","LT275/65R18","LT265/60R20","LT275/70R18"]
    },
    {
      year: 2022,
      make: "Ford",
      model: "bronco",
      oem_tire_sizes: ["255/70R16","255/70R18","255/75R17","265/70R17","285/70R17","315/70R17","37x12.50R17","LT265/70R17","LT285/70R17","LT315/70R17"],
      // Added: ["LT285/70R17","LT315/70R17","LT265/70R17"]
    },
    {
      year: 2022,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["265/60R18","265/70R17","275/50R22","275/60R20","275/70R18","315/70R17","LT265/70R17","LT265/70R18","LT315/70R17"],
      // Added: ["LT265/70R18","LT315/70R17","LT265/70R17"]
    },
    {
      year: 2022,
      make: "GMC",
      model: "Sierra 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","275/60R20","285/45R22","LT265/60R20","LT265/70R17","LT275/65R18"],
      // Added: ["LT265/70R17","LT275/65R18","LT265/60R20"]
    },
    {
      year: 2022,
      make: "GMC",
      model: "acadia",
      oem_tire_sizes: ["235/55R20","235/65R18","245/60R18","255/55R20","275/45R21"],
      // Added: ["235/55R20","235/65R18"]
    },
    {
      year: 2022,
      make: "Honda",
      model: "Passport",
      oem_tire_sizes: ["245/50R20","245/60R18","265/45R20","265/60R18"],
      // Added: ["265/45R20","245/60R18"]
    },
    {
      year: 2022,
      make: "Honda",
      model: "passport",
      oem_tire_sizes: ["245/50R20","245/60R18","265/45R20","265/60R18"],
      // Added: ["265/45R20","245/60R18"]
    },
    {
      year: 2022,
      make: "Infiniti",
      model: "q60",
      oem_tire_sizes: ["225/55R18","245/40R19","255/40R19","275/35R19"],
      // Added: ["255/40R19"]
    },
    {
      year: 2022,
      make: "Jeep",
      model: "Grand Wagoneer",
      oem_tire_sizes: ["275/50R20","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2022,
      make: "Jeep",
      model: "wagoneer",
      oem_tire_sizes: ["275/50R20","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2022,
      make: "Lucid",
      model: "air",
      oem_tire_sizes: ["245/40R20","245/45R19","265/40R20"],
      // Added: ["265/40R20"]
    },
    {
      year: 2022,
      make: "Nissan",
      model: "versa",
      oem_tire_sizes: ["185/65R15","195/55R16","195/65R15","205/45R17","205/50R17","205/55R16"],
      // Added: ["195/65R15","205/50R17","205/55R16"]
    },
    {
      year: 2022,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["265/70R17","275/55R20","275/60R20","275/65R18","275/70R18","285/45R22","305/45R22","325/65R18","LT275/65R18","LT275/70R18","LT325/65R18"],
      // Added: ["LT325/65R18"]
    },
    {
      year: 2022,
      make: "Toyota",
      model: "mirai",
      oem_tire_sizes: ["235/50R19","235/55R19"],
      // Added: ["235/55R19"]
    },
    {
      year: 2022,
      make: "Volkswagen",
      model: "id.4",
      oem_tire_sizes: ["235/50R20","235/55R19","255/45R20","255/45R21","255/50R19","255/50R20"],
      // Added: ["255/50R19","235/50R20","255/45R20"]
    },
    {
      year: 2022,
      make: "ford",
      model: "f-150 lightning",
      oem_tire_sizes: ["275/50R22","275/60R20","275/65R18"],
      // Added: ["275/65R18","275/50R22","275/60R20"]
    },
    {
      year: 2021,
      make: "Acura",
      model: "nsx",
      oem_tire_sizes: ["245/35R19","245/40R19","265/35R19","305/30R19","305/30R20","305/35R20"],
      // Added: ["245/35R19","305/30R20"]
    },
    {
      year: 2021,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R21","265/30R21"],
      // Added: ["255/35R21"]
    },
    {
      year: 2021,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2021,
      make: "BMW",
      model: "X7",
      oem_tire_sizes: ["275/45R21","285/45R21","305/40R21"],
      // Added: ["285/45R21"]
    },
    {
      year: 2021,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["265/60R18","265/70R17","275/50R22","275/60R20","275/70R18","315/70R17","LT265/70R17","LT265/70R18","LT315/70R17"],
      // Added: ["LT265/70R18","LT315/70R17","LT265/70R17"]
    },
  ];

  console.log('Applying batch 6...');
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

  console.log(`Batch 6 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch6()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());