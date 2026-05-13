// Batch 20 of 25
// Generated: 2026-05-13T17:33:17.328Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch20() {
  const updates = [
    {
      year: 2000,
      make: "Chevrolet",
      model: "astro",
      oem_tire_sizes: ["215/65R16","215/70R15","215/75R15"],
      // Added: ["215/75R15"]
    },
    {
      year: 2000,
      make: "Chevrolet",
      model: "malibu",
      oem_tire_sizes: ["205/70R15","215/60R15","215/60R16"],
      // Added: ["215/60R15"]
    },
    {
      year: 2000,
      make: "Chrysler",
      model: "sebring",
      oem_tire_sizes: ["205/55R16","205/60R16","215/55R16"],
      // Added: ["215/55R16","205/55R16"]
    },
    {
      year: 2000,
      make: "Daewoo",
      model: "leganza",
      oem_tire_sizes: ["195/65R15","205/55R16","205/60R15"],
      // Added: ["205/60R15"]
    },
    {
      year: 2000,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["235/70R16","255/65R17","255/70R16","265/70R17","275/45R20","275/60R17","295/45R18","LT245/75R16"],
      // Added: ["275/60R17","265/70R17","LT245/75R16","235/70R16","255/70R16","295/45R18","275/45R20"]
    },
    {
      year: 2000,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2000,
      make: "Mercury",
      model: "cougar",
      oem_tire_sizes: ["205/60R15","215/50R16","215/50R17","215/65R15","225/55R16"],
      // Added: ["215/50R16","205/60R15"]
    },
    {
      year: 2000,
      make: "Mitsubishi",
      model: "diamante",
      oem_tire_sizes: ["195/65R15","205/65R15","215/60R16"],
      // Added: ["205/65R15","215/60R16"]
    },
    {
      year: 2000,
      make: "Mitsubishi",
      model: "galant",
      oem_tire_sizes: ["195/65R15","205/55R16","205/65R15","215/50R17","215/55R16"],
      // Added: ["195/65R15","205/55R16"]
    },
    {
      year: 2000,
      make: "Mitsubishi",
      model: "mirage",
      oem_tire_sizes: ["165/65R14","175/55R15","175/65R14","185/65R14"],
      // Added: ["175/65R14","185/65R14"]
    },
    {
      year: 2000,
      make: "Nissan",
      model: "quest",
      oem_tire_sizes: ["215/65R16","225/60R16","225/60R17","225/65R16","235/55R18"],
      // Added: ["215/65R16","225/60R16"]
    },
    {
      year: 2000,
      make: "Plymouth",
      model: "voyager",
      oem_tire_sizes: ["205/70R15","215/65R15","215/65R16","215/70R15"],
      // Added: ["215/65R15"]
    },
    {
      year: 2000,
      make: "Subaru",
      model: "outback",
      oem_tire_sizes: ["215/60R16","225/55R17","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2000,
      make: "Toyota",
      model: "celica",
      oem_tire_sizes: ["195/60R15","195/65R15","205/50R16","205/55R15"],
      // Added: ["205/55R15","205/50R16","195/60R15"]
    },
    {
      year: 2000,
      make: "Toyota",
      model: "echo",
      oem_tire_sizes: ["175/65R14","185/65R14"],
      // Added: ["175/65R14"]
    },
    {
      year: 2000,
      make: "Toyota",
      model: "solara",
      oem_tire_sizes: ["205/60R16","215/60R16"],
      // Added: ["205/60R16"]
    },
    {
      year: 2000,
      make: "Volkswagen",
      model: "eurovan",
      oem_tire_sizes: ["185/65R14","205/65R15"],
      // Added: ["205/65R15"]
    },
    {
      year: 2005,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["245/70R17","275/65R18","LT245/70R17","LT275/65R18"],
      // Added: ["LT275/65R18","LT245/70R17"]
    },
    {
      year: 2004,
      make: "Ford",
      model: "f-150",
      oem_tire_sizes: ["245/70R17","275/65R18","LT245/70R17","LT275/65R18"],
      // Added: ["LT275/65R18","LT245/70R17"]
    },
    {
      year: 2017,
      make: "GMC",
      model: "canyon",
      oem_tire_sizes: ["245/75R16","255/55R20","255/65R17","265/60R18"],
      // Added: ["255/55R20"]
    },
    {
      year: 2007,
      make: "GMC",
      model: "canyon",
      oem_tire_sizes: ["215/70R15","215/75R15","235/50R18","235/75R15","245/65R17"],
      // Added: ["235/50R18"]
    },
    {
      year: 2025,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","255/35R19","285/30R20"],
      // Added: ["225/45R18","225/40R19","255/35R19"]
    },
    {
      year: 2024,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["245/35R19","285/30R19","225/45R18","225/40R19","255/35R19"]
    },
    {
      year: 2023,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["245/35R19","285/30R19","225/45R18","225/40R19","255/35R19"]
    },
    {
      year: 2022,
      make: "Alfa Romeo",
      model: "giulia",
      oem_tire_sizes: ["225/35R20","225/40R19","225/45R18","225/50R17","245/35R19","255/35R19","285/30R19","285/30R20"],
      // Added: ["245/35R19","285/30R19","225/45R18","225/40R19","255/35R19"]
    },
  ];

  console.log('Applying batch 20...');
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

  console.log(`Batch 20 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch20()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());