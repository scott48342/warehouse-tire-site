// Batch 15 of 25
// Generated: 2026-05-13T17:33:17.321Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch15() {
  const updates = [
    {
      year: 2007,
      make: "Toyota",
      model: "yaris",
      oem_tire_sizes: ["175/65R14","175/65R15","185/60R15"],
      // Added: ["175/65R14","185/60R15"]
    },
    {
      year: 2007,
      make: "Volvo",
      model: "s40",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2007,
      make: "Volvo",
      model: "s80",
      oem_tire_sizes: ["245/40R18","245/45R18"],
      // Added: ["245/40R18"]
    },
    {
      year: 2007,
      make: "Volvo",
      model: "v50",
      oem_tire_sizes: ["205/50R17","215/50R17"],
      // Added: ["205/50R17"]
    },
    {
      year: 2006,
      make: "Acura",
      model: "rl",
      oem_tire_sizes: ["225/55R17","245/45R18","245/50R17"],
      // Added: ["245/50R17"]
    },
    {
      year: 2006,
      make: "Audi",
      model: "s4",
      oem_tire_sizes: ["235/40R18","245/40R18","255/35R19"],
      // Added: ["235/40R18"]
    },
    {
      year: 2006,
      make: "Audi",
      model: "tt",
      oem_tire_sizes: ["225/40R18","225/45R17","225/50R17","245/40R18","255/30R20"],
      // Added: ["225/45R17","225/40R18"]
    },
    {
      year: 2006,
      make: "BMW",
      model: "X3",
      oem_tire_sizes: ["235/50R18","235/55R17","235/55R18","235/65R17","255/45R18","255/45R19","255/50R18"],
      // Added: ["235/55R17","235/50R18","255/45R18"]
    },
    {
      year: 2006,
      make: "Buick",
      model: "rendezvous",
      oem_tire_sizes: ["225/55R17","225/60R16","225/60R17"],
      // Added: ["225/60R17"]
    },
    {
      year: 2006,
      make: "Cadillac",
      model: "escalade",
      oem_tire_sizes: ["265/70R17"],
      // Added: ["265/70R17"]
    },
    {
      year: 2006,
      make: "Chevrolet",
      model: "tahoe",
      oem_tire_sizes: ["245/75R16","265/65R17","265/70R16","265/70R17","275/55R20","LT245/75R16"],
      // Added: ["LT245/75R16","275/55R20"]
    },
    {
      year: 2006,
      make: "Dodge",
      model: "charger",
      oem_tire_sizes: ["215/50R17","215/65R17","225/50R17","225/55R18","225/60R17","225/60R18","235/50R20","235/55R18","245/45R20","255/45R20"],
      // Added: ["225/60R18"]
    },
    {
      year: 2006,
      make: "Ford",
      model: "gt",
      oem_tire_sizes: ["235/45R18","245/45R18","315/40R19","345/35R19"],
      // Added: ["235/45R18","315/40R19"]
    },
    {
      year: 2006,
      make: "GMC",
      model: "Envoy",
      oem_tire_sizes: ["245/60R18","245/65R17"],
      // Added: ["245/60R18","245/65R17"]
    },
    {
      year: 2006,
      make: "Hyundai",
      model: "sonata",
      oem_tire_sizes: ["205/65R16","215/55R17","215/60R16","225/50R17","235/45R18","245/40R19"],
      // Added: ["215/60R16","225/50R17"]
    },
    {
      year: 2006,
      make: "Lincoln",
      model: "ls",
      oem_tire_sizes: ["225/55R17","235/50R17","235/50R18"],
      // Added: ["235/50R17"]
    },
    {
      year: 2006,
      make: "Mercury",
      model: "mountaineer",
      oem_tire_sizes: ["235/65R17","235/65R18","235/70R16","245/60R18","245/65R17"],
      // Added: ["245/65R17","235/65R18"]
    },
    {
      year: 2006,
      make: "Mitsubishi",
      model: "eclipse",
      oem_tire_sizes: ["215/55R17","225/45R18","225/50R17","235/45R18"],
      // Added: ["225/50R17","235/45R18"]
    },
    {
      year: 2006,
      make: "Mitsubishi",
      model: "outlander",
      oem_tire_sizes: ["215/55R17","215/70R16","225/60R16","225/60R17"],
      // Added: ["225/60R16","215/55R17"]
    },
    {
      year: 2006,
      make: "Pontiac",
      model: "gto",
      oem_tire_sizes: ["235/40R18","245/40R18"],
      // Added: ["235/40R18"]
    },
    {
      year: 2006,
      make: "Saab",
      model: "9-3",
      oem_tire_sizes: ["205/55R16","215/45R17","215/55R16","225/40R18","225/45R17","235/45R17"],
      // Added: ["235/45R17","215/55R16"]
    },
    {
      year: 2006,
      make: "Saab",
      model: "9-5",
      oem_tire_sizes: ["215/55R16","225/50R17","235/45R17","235/45R18"],
      // Added: ["235/45R17"]
    },
    {
      year: 2006,
      make: "Subaru",
      model: "legacy",
      oem_tire_sizes: ["205/50R17","205/60R16","215/45R17","215/45R18","215/50R17","225/45R18"],
      // Added: ["205/50R17","215/45R18","215/45R17"]
    },
    {
      year: 2006,
      make: "Toyota",
      model: "Land Cruiser",
      oem_tire_sizes: ["265/70R18","275/60R18"],
      // Added: ["275/60R18"]
    },
    {
      year: 2006,
      make: "Toyota",
      model: "sequoia",
      oem_tire_sizes: ["265/65R17","265/70R17"],
      // Added: ["265/65R17"]
    },
  ];

  console.log('Applying batch 15...');
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

  console.log(`Batch 15 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch15()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());