// Batch 19 of 25
// Generated: 2026-05-13T17:33:17.326Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch19() {
  const updates = [
    {
      year: 2002,
      make: "Toyota",
      model: "echo",
      oem_tire_sizes: ["175/65R14","185/65R14"],
      // Added: ["175/65R14"]
    },
    {
      year: 2002,
      make: "Toyota",
      model: "sequoia",
      oem_tire_sizes: ["265/65R17","265/70R17"],
      // Added: ["265/65R17"]
    },
    {
      year: 2002,
      make: "Toyota",
      model: "solara",
      oem_tire_sizes: ["205/60R16","215/60R16"],
      // Added: ["205/60R16"]
    },
    {
      year: 2002,
      make: "Volkswagen",
      model: "eurovan",
      oem_tire_sizes: ["185/65R14","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2002,
      make: "Volvo",
      model: "s60",
      oem_tire_sizes: ["225/45R17","235/40R18","235/45R17"],
      // Added: ["235/45R17"]
    },
    {
      year: 2001,
      make: "Acura",
      model: "nsx",
      oem_tire_sizes: ["215/40R17","245/40R17","255/40R17"],
      // Added: ["245/40R17"]
    },
    {
      year: 2001,
      make: "Buick",
      model: "regal",
      oem_tire_sizes: ["205/70R15","215/70R15"],
      // Added: ["215/70R15"]
    },
    {
      year: 2001,
      make: "Chevrolet",
      model: "astro",
      oem_tire_sizes: ["215/65R16","215/70R15","215/75R15"],
      // Added: ["215/75R15"]
    },
    {
      year: 2001,
      make: "Chevrolet",
      model: "malibu",
      oem_tire_sizes: ["205/70R15","215/60R15","215/60R16"],
      // Added: ["215/60R15"]
    },
    {
      year: 2001,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["245/75R16","265/65R17","265/70R16","265/70R17","LT265/75R16"],
      // Added: ["LT265/75R16"]
    },
    {
      year: 2001,
      make: "Daewoo",
      model: "leganza",
      oem_tire_sizes: ["195/65R15","205/55R16","205/60R15"],
      // Added: ["205/60R15"]
    },
    {
      year: 2001,
      make: "GMC",
      model: "yukon",
      oem_tire_sizes: ["245/75R16","265/65R17","265/70R16","265/70R17","275/55R20","LT265/75R16"],
      // Added: ["LT265/75R16"]
    },
    {
      year: 2001,
      make: "Jeep",
      model: "wrangler",
      oem_tire_sizes: ["215/75R15","225/70R16","225/75R15","225/75R16","245/75R16","30x9.5R15","LT245/75R16"],
      // Added: ["225/70R16"]
    },
    {
      year: 2001,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2001,
      make: "Mitsubishi",
      model: "diamante",
      oem_tire_sizes: ["195/65R15","205/65R15","215/60R16"],
      // Added: ["205/65R15","215/60R16"]
    },
    {
      year: 2001,
      make: "Mitsubishi",
      model: "galant",
      oem_tire_sizes: ["195/65R15","205/55R16","205/65R15","215/50R17","215/55R16"],
      // Added: ["195/65R15","205/55R16"]
    },
    {
      year: 2001,
      make: "Mitsubishi",
      model: "mirage",
      oem_tire_sizes: ["165/65R14","175/55R15","175/65R14","185/65R14"],
      // Added: ["175/65R14","185/65R14"]
    },
    {
      year: 2001,
      make: "Subaru",
      model: "outback",
      oem_tire_sizes: ["215/60R16","225/55R17","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2001,
      make: "Toyota",
      model: "celica",
      oem_tire_sizes: ["195/60R15","195/65R15","205/50R16","205/55R15"],
      // Added: ["205/55R15","205/50R16","195/60R15"]
    },
    {
      year: 2001,
      make: "Toyota",
      model: "echo",
      oem_tire_sizes: ["175/65R14","185/65R14"],
      // Added: ["175/65R14"]
    },
    {
      year: 2001,
      make: "Toyota",
      model: "solara",
      oem_tire_sizes: ["205/60R16","215/60R16"],
      // Added: ["205/60R16"]
    },
    {
      year: 2001,
      make: "Volkswagen",
      model: "eurovan",
      oem_tire_sizes: ["185/65R14","225/60R16"],
      // Added: ["225/60R16"]
    },
    {
      year: 2001,
      make: "Volvo",
      model: "s60",
      oem_tire_sizes: ["225/45R17","235/40R18","235/45R17"],
      // Added: ["235/45R17"]
    },
    {
      year: 2000,
      make: "Acura",
      model: "nsx",
      oem_tire_sizes: ["215/40R17","245/40R17","255/40R17"],
      // Added: ["245/40R17"]
    },
    {
      year: 2000,
      make: "Buick",
      model: "regal",
      oem_tire_sizes: ["205/70R15","215/70R15"],
      // Added: ["215/70R15"]
    },
  ];

  console.log('Applying batch 19...');
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

  console.log(`Batch 19 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch19()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());