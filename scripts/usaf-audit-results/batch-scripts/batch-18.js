// Batch 18 of 25
// Generated: 2026-05-13T17:33:17.324Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch18() {
  const updates = [
    {
      year: 2003,
      make: "Mitsubishi",
      model: "galant",
      oem_tire_sizes: ["195/65R15","205/55R16","205/65R15","215/50R17","215/55R16"],
      // Added: ["195/65R15","205/55R16"]
    },
    {
      year: 2003,
      make: "Mitsubishi",
      model: "outlander",
      oem_tire_sizes: ["215/70R16","225/60R16","225/60R17"],
      // Added: ["225/60R16"]
    },
    {
      year: 2003,
      make: "Subaru",
      model: "outback",
      oem_tire_sizes: ["215/60R16","225/55R17","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2003,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","275/60R18"],
      // Added: ["275/60R18"]
    },
    {
      year: 2003,
      make: "Toyota",
      model: "celica",
      oem_tire_sizes: ["195/60R15","195/65R15","205/50R16","205/55R15"],
      // Added: ["195/60R15","205/55R15","205/50R16"]
    },
    {
      year: 2003,
      make: "Toyota",
      model: "echo",
      oem_tire_sizes: ["175/65R14","185/60R15","185/65R14"],
      // Added: ["175/65R14","185/60R15"]
    },
    {
      year: 2003,
      make: "Toyota",
      model: "solara",
      oem_tire_sizes: ["205/60R16","215/60R16"],
      // Added: ["205/60R16"]
    },
    {
      year: 2003,
      make: "Volkswagen",
      model: "eurovan",
      oem_tire_sizes: ["185/65R14","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2003,
      make: "Volvo",
      model: "s40",
      oem_tire_sizes: ["205/55R16","215/50R16"],
      // Added: ["215/50R16"]
    },
    {
      year: 2003,
      make: "Volvo",
      model: "s60",
      oem_tire_sizes: ["225/45R17","235/40R18","235/45R17"],
      // Added: ["235/45R17"]
    },
    {
      year: 2002,
      make: "Audi",
      model: "s6",
      oem_tire_sizes: ["235/45R17","255/40R17"],
      // Added: ["255/40R17"]
    },
    {
      year: 2002,
      make: "Buick",
      model: "rendezvous",
      oem_tire_sizes: ["215/70R16","225/55R17","225/60R16"],
      // Added: ["215/70R16"]
    },
    {
      year: 2002,
      make: "Chevrolet",
      model: "astro",
      oem_tire_sizes: ["215/65R16","215/70R15","215/75R15"],
      // Added: ["215/75R15"]
    },
    {
      year: 2002,
      make: "Chevrolet",
      model: "malibu",
      oem_tire_sizes: ["205/70R15","215/60R15","215/60R16"],
      // Added: ["215/60R15"]
    },
    {
      year: 2002,
      make: "Daewoo",
      model: "leganza",
      oem_tire_sizes: ["195/65R15","205/55R16","205/60R15"],
      // Added: ["205/60R15"]
    },
    {
      year: 2002,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/65R17"],
      // Added: ["245/65R17"]
    },
    {
      year: 2002,
      make: "Honda",
      model: "odyssey",
      oem_tire_sizes: ["215/65R16","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2002,
      make: "Isuzu",
      model: "axiom",
      oem_tire_sizes: ["235/55R18","235/60R17","235/65R17"],
      // Added: ["235/65R17"]
    },
    {
      year: 2002,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["215/75R15","225/70R16","225/75R15","225/75R16","245/75R16","30x9.5R15","LT245/75R16"],
      // Added: ["225/70R16"]
    },
    {
      year: 2002,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2002,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/70R16","245/60R18","245/70R16"],
      // Added: ["245/70R16"]
    },
    {
      year: 2002,
      make: "Mitsubishi",
      model: "diamante",
      oem_tire_sizes: ["195/65R15","215/60R16"],
      // Added: ["215/60R16"]
    },
    {
      year: 2002,
      make: "Mitsubishi",
      model: "galant",
      oem_tire_sizes: ["195/65R15","205/55R16","205/65R15","215/50R17","215/55R16"],
      // Added: ["195/65R15","205/55R16"]
    },
    {
      year: 2002,
      make: "Subaru",
      model: "outback",
      oem_tire_sizes: ["215/60R16","225/55R17","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2002,
      make: "Toyota",
      model: "celica",
      oem_tire_sizes: ["195/60R15","195/65R15","205/50R16","205/55R15"],
      // Added: ["195/60R15","205/55R15","205/50R16"]
    },
  ];

  console.log('Applying batch 18...');
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

  console.log(`Batch 18 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch18()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());