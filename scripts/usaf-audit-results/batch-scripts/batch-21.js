// Batch 21 of 25
// Generated: 2026-05-13T17:33:17.329Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch21() {
  const updates = [
    {
      year: 2021,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["225/45R18","245/35R19","285/30R19","225/40R19","255/35R19"]
    },
    {
      year: 2020,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["225/45R18","225/40R19","255/35R19","245/35R19","285/30R19"]
    },
    {
      year: 2019,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["225/45R18","245/35R19","285/30R19","225/40R19","255/35R19"]
    },
    {
      year: 2017,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["245/35R19","285/30R19","225/45R18","225/40R19","255/35R19"]
    },
    {
      year: 2024,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["255/45R20","285/40R20","235/55R19"]
    },
    {
      year: 2023,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["255/45R20","285/40R20","235/55R19"]
    },
    {
      year: 2022,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["255/45R20","285/40R20","235/55R19"]
    },
    {
      year: 2021,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["235/55R19","255/45R20","285/40R20"]
    },
    {
      year: 2020,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["235/55R19","255/45R20","285/40R20"]
    },
    {
      year: 2019,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/45R20","285/40R20","285/40R21"],
      // Added: ["235/55R19","255/45R20","285/40R20"]
    },
    {
      year: 2025,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","255/40R21","255/45R20","265/40R21","265/45R20","275/35R21","275/40R20"],
      // Added: ["255/45R20","265/45R20","255/40R21","265/40R21","245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2024,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","255/40R21","255/45R20","265/40R21","265/45R20","275/35R21","275/40R20"],
      // Added: ["255/45R20","265/45R20","255/40R21","265/40R21","245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2023,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","255/40R21","255/45R20","265/40R21","265/45R20","275/35R21","275/40R20"],
      // Added: ["255/45R20","265/45R20","255/40R21","265/40R21","245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2022,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","255/40R21","255/45R20","265/40R21","265/45R20","275/35R21","275/40R20"],
      // Added: ["255/45R20","265/45R20","255/40R21","265/40R21","245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2020,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","255/40R21","255/45R20","265/40R21","265/45R20","275/35R21","275/40R20"],
      // Added: ["245/45R20","275/40R20","245/40R21","275/35R21","255/40R21","265/40R21","255/45R20","265/45R20"]
    },
    {
      year: 2019,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R21","245/45R20","245/50R19","275/35R21","275/40R20"],
      // Added: ["245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2017,
      make: "BMW",
      model: "X4",
      oem_tire_sizes: ["245/40R20","245/45R19","245/50R18","275/35R20","275/40R19"],
      // Added: ["245/40R20","275/35R20","245/50R18"]
    },
    {
      year: 2021,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["255/70R17","265/65R18","275/50R22","275/60R20","LT265/60R20","LT265/70R17","LT275/65R18"],
      // Added: ["275/60R20","LT275/65R18","LT265/60R20","275/50R22","LT265/70R17","265/65R18"]
    },
    {
      year: 2020,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["255/70R17","265/65R18","275/50R22","275/60R20","LT265/70R17","LT275/65R18"],
      // Added: ["LT265/70R17","275/60R20","275/50R22","LT275/65R18","265/65R18"]
    },
    {
      year: 2019,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["255/70R17","265/65R18","275/50R22","275/60R20","LT265/70R17","LT275/65R18"],
      // Added: ["LT265/70R17","275/60R20","LT275/65R18","265/65R18","275/50R22"]
    },
    {
      year: 2017,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","285/45R22","LT265/70R17"],
      // Added: ["LT265/70R17","275/55R20","265/65R18","285/45R22"]
    },
    {
      year: 2016,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","285/45R22","LT265/70R17"],
      // Added: ["LT265/70R17","275/55R20","265/65R18","285/45R22"]
    },
    {
      year: 2015,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","285/45R22","LT265/70R17"],
      // Added: ["275/55R20","265/65R18","LT265/70R17","285/45R22"]
    },
    {
      year: 2014,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["265/65R18","265/70R17","275/55R20","LT265/70R17"],
      // Added: ["265/65R18","275/55R20","LT265/70R17"]
    },
    {
      year: 2024,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/50R20","235/55R19","235/60R18","245/45R21"],
      // Added: ["235/60R18","235/50R20","245/45R21"]
    },
  ];

  console.log('Applying batch 21...');
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

  console.log(`Batch 21 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch21()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());