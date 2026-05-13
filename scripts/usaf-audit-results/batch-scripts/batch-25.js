// Batch 25 of 25
// Generated: 2026-05-13T17:33:17.331Z
// Updates: 25 vehicles

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function applyBatch25() {
  const updates = [
    {
      year: 2004,
      make: "Porsche",
      model: "911",
      oem_tire_sizes: ["225/40R18","235/40R18","235/40R19","265/35R18","295/30R18","295/35R19"],
      // Added: ["235/40R18","295/30R18","225/40R18","265/35R18"]
    },
    {
      year: 2003,
      make: "Porsche",
      model: "911",
      oem_tire_sizes: ["225/40R18","235/40R18","235/40R19","295/30R18","295/35R19"],
      // Added: ["225/40R18","235/40R18","295/30R18"]
    },
    {
      year: 2002,
      make: "Porsche",
      model: "911",
      oem_tire_sizes: ["225/40R18","235/40R18","235/40R19","295/30R18","295/35R19"],
      // Added: ["225/40R18","295/30R18","235/40R18"]
    },
    {
      year: 2001,
      make: "Porsche",
      model: "911",
      oem_tire_sizes: ["225/40R18","235/40R19","265/35R18","295/30R18","295/35R19"],
      // Added: ["225/40R18","295/30R18","265/35R18"]
    },
    {
      year: 2000,
      make: "Porsche",
      model: "911",
      oem_tire_sizes: ["225/40R18","235/40R19","265/35R18","295/35R19"],
      // Added: ["225/40R18","265/35R18"]
    },
    {
      year: 2024,
      make: "Ford",
      model: "Mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","275/40R19","305/30R19","305/30R20","315/30R19","315/30R20"],
      // Added: ["265/35R20"]
    },
    {
      year: 2023,
      make: "Ford",
      model: "Mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","265/40R19","275/40R19","295/35R19","305/30R19","305/30R20","305/35R19","315/30R20"],
      // Added: ["265/40R19","265/35R20","305/30R19"]
    },
    {
      year: 2022,
      make: "Ford",
      model: "Mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","265/40R19","275/40R19","305/30R19","305/30R20","315/30R20"],
      // Added: ["265/40R19","265/35R20","305/30R19"]
    },
    {
      year: 2021,
      make: "Ford",
      model: "Mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","265/40R19","275/40R19","305/30R19","305/30R20","315/30R20"],
      // Added: ["265/40R19","265/35R20","305/30R19"]
    },
    {
      year: 2020,
      make: "Ford",
      model: "Mustang",
      oem_tire_sizes: ["235/50R18","255/40R19","255/45R18","265/35R20","265/40R19","275/40R19","295/35R19","305/30R19","305/30R20","305/35R19","315/30R20"],
      // Added: ["265/35R20","305/30R19","265/40R19"]
    },
    {
      year: 2016,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["235/35R19","235/35R20","235/40R18","235/40R19","235/45R17","235/45R18","255/40R17","265/35R19","265/35R20","265/40R18","265/40R19","265/45R18"],
      // Added: ["235/35R20","265/35R20","235/40R19","265/40R19","235/45R18","265/45R18"]
    },
    {
      year: 2015,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["235/35R19","235/35R20","235/40R18","235/40R19","235/45R17","235/45R18","255/40R17","265/35R19","265/35R20","265/40R18","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/40R19","265/40R19","235/35R20","265/35R20"]
    },
    {
      year: 2014,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["235/35R19","235/35R20","235/40R18","235/40R19","235/45R17","235/45R18","255/40R17","265/35R19","265/35R20","265/40R18","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/40R19","265/40R19","235/35R20","265/35R20"]
    },
    {
      year: 2013,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["235/35R19","235/35R20","235/40R18","235/40R19","235/45R17","235/45R18","255/40R17","265/35R19","265/35R20","265/40R18","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/40R19","265/40R19","235/35R20","265/35R20"]
    },
    {
      year: 2012,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2011,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2010,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2009,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2008,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2007,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2006,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2005,
      make: "Porsche",
      model: "boxster",
      oem_tire_sizes: ["205/55R17","235/35R19","235/40R18","235/45R17","235/50R17","255/40R17","265/35R19","265/40R18"],
      // Added: ["205/55R17","235/50R17"]
    },
    {
      year: 2016,
      make: "Porsche",
      model: "cayman",
      oem_tire_sizes: ["235/35R20","235/40R19","235/45R18","265/35R20","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/35R20","265/35R20"]
    },
    {
      year: 2015,
      make: "Porsche",
      model: "cayman",
      oem_tire_sizes: ["235/35R20","235/40R19","235/45R18","265/35R20","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/35R20","265/35R20"]
    },
    {
      year: 2014,
      make: "Porsche",
      model: "cayman",
      oem_tire_sizes: ["235/35R20","235/40R19","235/45R18","265/35R20","265/40R19","265/45R18"],
      // Added: ["235/45R18","265/45R18","235/35R20","265/35R20"]
    },
  ];

  console.log('Applying batch 25...');
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

  console.log(`Batch 25 complete: ${updated} records updated, ${errors} errors`);
  return { updated, errors };
}

applyBatch25()
  .then(r => console.log('Done:', r))
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());