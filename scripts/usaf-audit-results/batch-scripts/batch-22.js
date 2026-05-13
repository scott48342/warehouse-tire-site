// Batch 22 of 25
// Generated: 2026-05-13T17:33:17.330Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch22() {
  const updates = [
    {
      year: 2023,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/50R20","235/55R19","235/60R18","245/45R21"],
      // Added: ["235/60R18","235/50R20","245/45R21"]
    },
    {
      year: 2022,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/50R20","235/55R19","235/60R18","245/45R21"],
      // Added: ["235/60R18","235/50R20","245/45R21"]
    },
    {
      year: 2021,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/50R20","235/55R19","235/60R18","245/45R21"],
      // Added: ["235/60R18","235/50R20","245/45R21"]
    },
    {
      year: 2020,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/50R20","235/55R19","235/60R18","245/45R21"],
      // Added: ["235/60R18","235/50R20","245/45R21"]
    },
    {
      year: 2019,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/55R19","235/60R18","245/45R20"],
      // Added: ["235/60R18","245/45R20"]
    },
    {
      year: 2017,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/55R19","235/60R18","245/45R20"],
      // Added: ["235/60R18","245/45R20"]
    },
    {
      year: 2016,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/55R19","235/60R18","245/45R20"],
      // Added: ["235/60R18","245/45R20"]
    },
    {
      year: 2015,
      make: "Land Rover",
      model: "Discovery Sport",
      oem_tire_sizes: ["235/55R19","235/60R18","245/45R20"],
      // Added: ["245/45R20","235/60R18"]
    },
    {
      year: 2024,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","265/40R22","265/45R21"],
      // Added: ["255/55R19","265/45R21"]
    },
    {
      year: 2023,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","265/40R22","265/45R21"],
      // Added: ["255/55R19","265/45R21","265/40R22"]
    },
    {
      year: 2022,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","265/40R22","265/45R21"],
      // Added: ["255/55R19","265/45R21","265/40R22"]
    },
    {
      year: 2021,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","265/40R22","265/45R21"],
      // Added: ["265/45R21","255/55R19","265/40R22"]
    },
    {
      year: 2020,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","265/40R22","265/45R21"],
      // Added: ["265/45R21","265/40R22","255/55R19"]
    },
    {
      year: 2019,
      make: "Land Rover",
      model: "Range Rover Velar",
      oem_tire_sizes: ["255/50R20","255/55R19","255/60R18","265/40R22","265/45R21"],
      // Added: ["255/60R18","265/45R21","265/40R22","255/55R19"]
    },
    {
      year: 2023,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2022,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2021,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2020,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2019,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2017,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2016,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2015,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2014,
      make: "Maserati",
      model: "ghibli",
      oem_tire_sizes: ["245/35R21","245/40R20","245/45R18","245/45R19","275/40R19","275/45R18","285/30R21","285/35R20"],
      // Added: ["245/45R19","275/40R19","245/40R20","285/35R20"]
    },
    {
      year: 2020,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["255/70R17","265/60R17","265/65R18","265/70R17","275/55R20","285/45R22"],
      // Added: ["265/60R17","265/70R17","255/70R17"]
    },
    {
      year: 2019,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["255/70R17","265/60R17","265/65R18","265/70R17","275/55R20","285/45R22"],
      // Added: ["265/60R17","255/70R17","265/70R17"]
    },
  ];

  console.log('Applying batch 22...');
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

  console.log(`Batch 22 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch22()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());