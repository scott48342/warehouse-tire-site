// Batch 2 of 25
// Generated: 2026-05-13T17:33:17.304Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch2() {
  const updates = [
    {
      year: 2026,
      make: "Toyota",
      model: "RAV4",
      oem_tire_sizes: ["225/60R18","225/65R17","235/50R20","235/55R19","235/60R18","235/65R17","235/65R18","245/45R20"],
      // Added: ["235/65R17","235/60R18","235/50R20","235/65R18"]
    },
    {
      year: 2026,
      make: "Toyota",
      model: "mirai",
      oem_tire_sizes: ["235/50R19","235/55R19"],
      // Added: ["235/55R19"]
    },
    {
      year: 2026,
      make: "Toyota",
      model: "rav4",
      oem_tire_sizes: ["225/60R18","225/65R17","235/50R20","235/55R19","235/60R18","235/65R17","235/65R18","245/45R20"],
      // Added: ["235/65R17","235/60R18","235/50R20","235/65R18"]
    },
    {
      year: 2026,
      make: "Volkswagen",
      model: "id.4",
      oem_tire_sizes: ["235/45R21","235/50R20","235/55R19","255/40R21","255/45R20","255/45R21","255/50R19","255/50R20"],
      // Added: ["235/50R20","255/45R20","255/50R19","235/45R21","255/40R21"]
    },
    {
      year: 2026,
      make: "Volvo",
      model: "ex30",
      oem_tire_sizes: ["235/50R19","245/45R19"],
      // Added: ["245/45R19"]
    },
    {
      year: 2026,
      make: "Volvo",
      model: "xc60",
      oem_tire_sizes: ["235/55R19","255/45R19"],
      // Added: ["235/55R19"]
    },
    {
      year: 2026,
      make: "Volvo",
      model: "xc90",
      oem_tire_sizes: ["255/45R20","275/45R20"],
      // Added: ["275/45R20"]
    },
    {
      year: 2025,
      make: "Alfa Romeo",
      model: "stelvio",
      oem_tire_sizes: ["235/55R19","235/60R18","255/40R21","255/45R20","285/40R21"],
      // Added: ["255/40R21","235/55R19","255/45R20"]
    },
    {
      year: 2025,
      make: "Audi",
      model: "S6 e-tron",
      oem_tire_sizes: ["235/45R20","255/45R20","265/40R20","285/40R20"],
      // Added: ["235/45R20","265/40R20"]
    },
    {
      year: 2025,
      make: "Audi",
      model: "SQ6 e-tron",
      oem_tire_sizes: ["255/45R21","265/40R21","285/35R21","285/40R21"],
      // Added: ["255/45R21","285/40R21"]
    },
    {
      year: 2025,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["255/35R21","265/30R21"],
      // Added: ["255/35R21"]
    },
    {
      year: 2025,
      make: "Audi",
      model: "s8",
      oem_tire_sizes: ["265/35R21","275/35R21","295/30R21"],
      // Added: ["265/35R21"]
    },
    {
      year: 2025,
      make: "BMW",
      model: "X7",
      oem_tire_sizes: ["275/45R21","285/45R21"],
      // Added: ["285/45R21"]
    },
    {
      year: 2025,
      make: "BMW",
      model: "i5",
      oem_tire_sizes: ["245/45R19","275/40R19"],
      // Added: ["275/40R19"]
    },
    {
      year: 2025,
      make: "BMW",
      model: "iX",
      oem_tire_sizes: ["255/50R21","275/40R21"],
      // Added: ["255/50R21"]
    },
    {
      year: 2025,
      make: "Chevrolet",
      model: "Colorado",
      oem_tire_sizes: ["245/75R16","255/55R20","255/65R17","265/55R19","265/60R18","265/65R18","275/50R22","275/60R20","275/65R18","285/70R17","315/70R17","LT275/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT275/65R18","LT285/70R17","LT315/70R17"]
    },
    {
      year: 2025,
      make: "Chevrolet",
      model: "Silverado 1500",
      oem_tire_sizes: ["255/70R17","265/65R18","275/50R22","275/60R20","275/65R18","275/70R18","LT265/60R20","LT265/70R17","LT275/65R18","LT275/70R18"],
      // Added: ["LT265/70R17","LT275/65R18","LT265/60R20","LT275/70R18"]
    },
    {
      year: 2025,
      make: "Chevrolet",
      model: "colorado",
      oem_tire_sizes: ["245/75R16","255/55R20","255/65R17","265/55R19","265/60R18","265/65R18","275/50R22","275/60R20","275/65R18","285/70R17","315/70R17","LT275/65R18","LT285/70R17","LT315/70R17"],
      // Added: ["LT275/65R18","LT285/70R17","LT315/70R17"]
    },
    {
      year: 2025,
      make: "Ford",
      model: "expedition",
      oem_tire_sizes: ["265/70R18","275/50R22","275/55R20","275/60R20","275/65R18","275/70R18","285/40R24","285/45R22","285/55R20","LT275/70R18"],
      // Added: ["275/70R18"]
    },
    {
      year: 2025,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["265/60R18","265/70R17","275/50R22","275/60R20","275/70R18","315/70R17","LT265/70R18","LT315/70R17"],
      // Added: ["LT315/70R17","LT265/70R18"]
    },
    {
      year: 2025,
      make: "Ford",
      model: "ranger",
      oem_tire_sizes: ["255/65R18","255/70R16","255/70R17","265/60R18","265/65R17"],
      // Added: ["255/65R18","255/70R17"]
    },
    {
      year: 2025,
      make: "GMC",
      model: "canyon",
      oem_tire_sizes: ["245/75R16","255/65R17","265/60R18","265/65R18","275/50R22","275/60R20","LT285/70R17","LT315/70R17"],
      // Added: ["265/65R18","275/60R20","275/50R22","LT285/70R17","LT315/70R17"]
    },
    {
      year: 2025,
      make: "GMC",
      model: "terrain",
      oem_tire_sizes: ["225/60R18","225/65R17","235/50R19","235/55R19","235/65R17"],
      // Added: ["235/65R17","235/55R19"]
    },
    {
      year: 2025,
      make: "Genesis",
      model: "g90",
      oem_tire_sizes: ["245/40R21","245/45R19","245/45R20","265/35R21","265/40R20","275/35R21","275/40R20","295/30R21","295/35R20"],
      // Added: ["245/45R20","275/40R20","245/40R21","275/35R21"]
    },
    {
      year: 2025,
      make: "Genesis",
      model: "gv80",
      oem_tire_sizes: ["265/35R22","265/40R21","265/40R22","265/45R20","265/50R20"],
      // Added: ["265/50R20","265/40R22"]
    },
  ];

  console.log('Applying batch 2...');
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

  console.log(`Batch 2 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch2()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());