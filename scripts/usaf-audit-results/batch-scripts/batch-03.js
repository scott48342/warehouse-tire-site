// Batch 3 of 25
// Generated: 2026-05-13T17:33:17.305Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch3() {
  const updates = [
    {
      year: 2025,
      make: "Honda",
      model: "Passport",
      oem_tire_sizes: ["245/50R20","245/60R18","265/45R20","265/60R18"],
      // Added: ["265/45R20","245/60R18"]
    },
    {
      year: 2025,
      make: "Honda",
      model: "hr-v",
      oem_tire_sizes: ["215/60R17","225/55R17"],
      // Added: ["215/60R17"]
    },
    {
      year: 2025,
      make: "Honda",
      model: "passport",
      oem_tire_sizes: ["245/50R20","245/60R18","265/45R20","265/60R18"],
      // Added: ["265/45R20","245/60R18"]
    },
    {
      year: 2025,
      make: "Hyundai",
      model: "kona",
      oem_tire_sizes: ["215/55R17","215/55R18","215/60R17","235/45R18"],
      // Added: ["215/60R17","215/55R18"]
    },
    {
      year: 2025,
      make: "Jeep",
      model: "Wrangler",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","275/55R20","285/70R17","315/70R17","LT255/75R17","LT285/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT315/70R17"]
    },
    {
      year: 2025,
      make: "Jeep",
      model: "wagoneer",
      oem_tire_sizes: ["275/50R20","275/55R20"],
      // Added: ["275/55R20"]
    },
    {
      year: 2025,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["245/75R17","255/70R17","255/70R18","275/55R20","285/70R17","315/70R17","LT255/75R17","LT285/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT315/70R17"]
    },
    {
      year: 2025,
      make: "Lincoln",
      model: "nautilus",
      oem_tire_sizes: ["245/55R19","255/45R20","255/50R21","255/55R20","255/60R19","265/40R21"],
      // Added: ["255/60R19","255/55R20","255/50R21"]
    },
    {
      year: 2025,
      make: "MINI",
      model: "cooper",
      oem_tire_sizes: ["175/65R15","195/55R16","205/40R18","205/45R17","215/40R18","215/45R17","225/35R18"],
      // Added: ["215/45R17","215/40R18"]
    },
    {
      year: 2025,
      make: "Mazda",
      model: "cx-70",
      oem_tire_sizes: ["255/55R19","265/45R21","265/55R19","275/45R21"],
      // Added: ["265/55R19","275/45R21"]
    },
    {
      year: 2025,
      make: "Mazda",
      model: "cx-90",
      oem_tire_sizes: ["255/55R19","265/45R21","265/55R19","275/45R21"],
      // Added: ["265/55R19","275/45R21"]
    },
    {
      year: 2025,
      make: "Nissan",
      model: "kicks",
      oem_tire_sizes: ["205/55R17","205/60R16","215/60R17","215/65R16"],
      // Added: ["215/65R16","215/60R17"]
    },
    {
      year: 2025,
      make: "Nissan",
      model: "murano",
      oem_tire_sizes: ["235/55R20","235/65R18","255/55R20"],
      // Added: ["255/55R20"]
    },
    {
      year: 2025,
      make: "Nissan",
      model: "versa",
      oem_tire_sizes: ["185/65R15","195/55R16","195/65R15","205/45R17","205/50R17","205/55R16"],
      // Added: ["195/65R15","205/50R17","205/55R16"]
    },
    {
      year: 2025,
      make: "RAM",
      model: "1500",
      oem_tire_sizes: ["275/55R20","275/60R20","275/65R18","275/70R18","285/45R22","305/45R22","325/65R18","LT275/65R18","LT275/70R18","LT325/65R18"],
      // Added: ["LT325/65R18"]
    },
    {
      year: 2025,
      make: "Rivian",
      model: "r1s",
      oem_tire_sizes: ["275/50R22","275/55R21","275/60R20","275/65R20"],
      // Added: ["275/60R20"]
    },
    {
      year: 2025,
      make: "Rivian",
      model: "r1t",
      oem_tire_sizes: ["275/50R22","275/55R21","275/60R20","275/65R20"],
      // Added: ["275/60R20"]
    },
    {
      year: 2025,
      make: "Toyota",
      model: "Grand Highlander",
      oem_tire_sizes: ["255/50R20","255/55R20"],
      // Added: ["255/55R20"]
    },
    {
      year: 2025,
      make: "Toyota",
      model: "bz4x",
      oem_tire_sizes: ["225/45R18","235/50R20","235/60R18"],
      // Added: ["235/50R20","235/60R18"]
    },
    {
      year: 2025,
      make: "Toyota",
      model: "mirai",
      oem_tire_sizes: ["235/50R19","235/55R19"],
      // Added: ["235/55R19"]
    },
    {
      year: 2025,
      make: "Volkswagen",
      model: "id.4",
      oem_tire_sizes: ["235/45R21","235/50R20","235/55R19","255/40R21","255/45R20","255/45R21","255/50R19","255/50R20"],
      // Added: ["235/50R20","255/45R20","255/50R19","235/45R21","255/40R21"]
    },
    {
      year: 2025,
      make: "Volvo",
      model: "ec40",
      oem_tire_sizes: ["235/40R19","235/45R20","235/50R19","255/40R20","255/45R19"],
      // Added: ["235/50R19","255/45R19","235/45R20","255/40R20"]
    },
    {
      year: 2025,
      make: "Volvo",
      model: "ex30",
      oem_tire_sizes: ["235/50R19","245/45R19"],
      // Added: ["245/45R19"]
    },
    {
      year: 2024,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R21","265/30R21"],
      // Added: ["255/35R21"]
    },
    {
      year: 2024,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
  ];

  console.log('Applying batch 3...');
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

  console.log(`Batch 3 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch3()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());