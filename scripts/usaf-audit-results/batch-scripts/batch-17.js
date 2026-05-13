// Batch 17 of 25
// Generated: 2026-05-13T17:33:17.322Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch17() {
  const updates = [
    {
      year: 2004,
      make: "Cadillac",
      model: "srx",
      oem_tire_sizes: ["215/55R17","235/60R18","235/65R17","255/55R18","255/60R17"],
      // Added: ["235/65R17","255/60R17","235/60R18","255/55R18"]
    },
    {
      year: 2004,
      make: "Chevrolet",
      model: "astro",
      oem_tire_sizes: ["215/65R16","215/70R15","215/70R16"],
      // Added: ["215/70R16"]
    },
    {
      year: 2004,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/65R17"],
      // Added: ["245/65R17"]
    },
    {
      year: 2004,
      make: "Honda",
      model: "odyssey",
      oem_tire_sizes: ["215/65R16","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2004,
      make: "Isuzu",
      model: "axiom",
      oem_tire_sizes: ["235/55R18","235/60R17","235/65R17"],
      // Added: ["235/65R17"]
    },
    {
      year: 2004,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2004,
      make: "Mitsubishi",
      model: "diamante",
      oem_tire_sizes: ["195/65R15","215/60R16"],
      // Added: ["215/60R16"]
    },
    {
      year: 2004,
      make: "Mitsubishi",
      model: "outlander",
      oem_tire_sizes: ["215/70R16","225/60R16","225/60R17"],
      // Added: ["225/60R16"]
    },
    {
      year: 2004,
      make: "Nissan",
      model: "quest",
      oem_tire_sizes: ["215/70R15","225/60R16","225/65R16","235/55R18","235/55R19"],
      // Added: ["225/65R16"]
    },
    {
      year: 2004,
      make: "Subaru",
      model: "outback",
      oem_tire_sizes: ["215/60R16","225/55R17","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2004,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","275/60R18"],
      // Added: ["275/60R18"]
    },
    {
      year: 2004,
      make: "Toyota",
      model: "celica",
      oem_tire_sizes: ["195/60R15","195/65R15","205/50R16","205/55R15"],
      // Added: ["195/60R15","205/55R15","205/50R16"]
    },
    {
      year: 2004,
      make: "Toyota",
      model: "echo",
      oem_tire_sizes: ["175/65R14","185/60R15","185/65R14"],
      // Added: ["175/65R14","185/60R15"]
    },
    {
      year: 2004,
      make: "Toyota",
      model: "sequoia",
      oem_tire_sizes: ["265/65R17","265/70R17"],
      // Added: ["265/65R17"]
    },
    {
      year: 2003,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["235/45R17","255/40R17"],
      // Added: ["255/40R17"]
    },
    {
      year: 2003,
      make: "Buick",
      model: "rendezvous",
      oem_tire_sizes: ["215/70R16","225/55R17","225/60R16"],
      // Added: ["215/70R16"]
    },
    {
      year: 2003,
      make: "Chevrolet",
      model: "astro",
      oem_tire_sizes: ["215/65R16","215/70R15","215/70R16"],
      // Added: ["215/70R16"]
    },
    {
      year: 2003,
      make: "Chevrolet",
      model: "malibu",
      oem_tire_sizes: ["205/70R15","215/60R15","215/60R16"],
      // Added: ["215/60R15"]
    },
    {
      year: 2003,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/65R17"],
      // Added: ["245/65R17"]
    },
    {
      year: 2003,
      make: "Honda",
      model: "odyssey",
      oem_tire_sizes: ["215/65R16","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2003,
      make: "Isuzu",
      model: "axiom",
      oem_tire_sizes: ["235/55R18","235/60R17","235/65R17"],
      // Added: ["235/65R17"]
    },
    {
      year: 2003,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["215/75R15","225/70R16","225/75R15","225/75R16","245/75R16","30x9.5R15","LT245/75R16"],
      // Added: ["225/70R16"]
    },
    {
      year: 2003,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2003,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/70R16","245/60R18","245/65R17","245/70R16"],
      // Added: ["245/70R16","245/65R17"]
    },
    {
      year: 2003,
      make: "Mitsubishi",
      model: "diamante",
      oem_tire_sizes: ["195/65R15","215/60R16"],
      // Added: ["215/60R16"]
    },
  ];

  console.log('Applying batch 17...');
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

  console.log(`Batch 17 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch17()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());