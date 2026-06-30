/**
 * Offset Update Script - Japanese/Korean/EV Brands
 * Fixes null offset_min_mm / offset_max_mm values
 * 
 * Strategy:
 * 1. Use OEM offset from wheels JSON where available + reasonable
 * 2. Use researched OEM values where wheels JSON has no offset
 * 3. Calculate aftermarket range based on vehicle type
 *
 * Range rules:
 *   car:   min = OEM-15 (floor -20), max = OEM+20 (cap 55)
 *   suv:   min = OEM-20 (floor -25), max = OEM+25 (cap 55)
 *   truck: min = OEM-25 (floor -30), max = OEM+25 (cap 55)
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '..', '.env.local') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

function calcRange(oemOffset, vehicleType) {
  let minOff, maxOff;
  if (vehicleType === 'truck') {
    minOff = Math.max(-30, oemOffset - 25);
    maxOff = Math.min(55, oemOffset + 25);
  } else if (vehicleType === 'suv') {
    minOff = Math.max(-25, oemOffset - 20);
    maxOff = Math.min(55, oemOffset + 25);
  } else { // car
    minOff = Math.max(-20, oemOffset - 15);
    maxOff = Math.min(55, oemOffset + 20);
  }
  return [minOff, maxOff];
}

// Each entry: { make, model, yearFrom, yearTo, oemOffset, type, threadSize, source }
// source: 'wheels_json' = extracted from DB wheels field, 'research' = web researched
const updates = [

  // ═══════════════════════ ACURA ═══════════════════════
  { make: 'Acura', model: 'CL',        yearFrom: 1997, yearTo: 1999, oemOffset: 50, type: 'car',   source: 'wheels_json' },
  { make: 'Acura', model: 'Integra',   yearFrom: 1990, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'research', notes: 'Gen3/4 5x100→4x100, OEM ET45' },
  { make: 'Acura', model: 'Legend',    yearFrom: 1990, yearTo: 1990, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Acura', model: 'Legend',    yearFrom: 1991, yearTo: 1995, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Acura', model: 'MDX',       yearFrom: 2001, yearTo: 2006, oemOffset: 55, type: 'suv',   source: 'research', notes: 'Gen1 MDX 5x114.3 ET55' },
  { make: 'Acura', model: 'RL',        yearFrom: 1996, yearTo: 1999, oemOffset: 50, type: 'car',   source: 'wheels_json' },
  { make: 'Acura', model: 'TL',        yearFrom: 1996, yearTo: 2008, oemOffset: 45, type: 'car',   source: 'wheels_json', notes: 'Multiple generations; ET45-50, use ET45 as min' },

  // ═══════════════════════ DAEWOO ═══════════════════════
  { make: 'Daewoo', model: 'Lanos',    yearFrom: 1999, yearTo: 1999, oemOffset: 49, type: 'car',   source: 'wheels_json' },
  { make: 'Daewoo', model: 'Nubira',   yearFrom: 1999, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },

  // ═══════════════════════ GENESIS ═══════════════════════
  { make: 'Genesis', model: 'G80',     yearFrom: 2018, yearTo: 2018, oemOffset: 52, type: 'car',   source: 'research', notes: 'Genesis G80 2018 5x114.3 ET52' },
  { make: 'Genesis', model: 'G90',     yearFrom: 2018, yearTo: 2018, oemOffset: 52, type: 'car',   source: 'research', notes: 'Genesis G90 2018 5x114.3 ET52' },

  // ═══════════════════════ HONDA ═══════════════════════
  { make: 'Honda', model: 'Accord',    yearFrom: 1990, yearTo: 1993, oemOffset: 45, type: 'car',   source: 'research', notes: 'CB7 Accord 5x114.3 ET45' },
  { make: 'Honda', model: 'Civic',     yearFrom: 1990, yearTo: 1995, oemOffset: 45, type: 'car',   source: 'research', notes: 'EG Civic 4x100 ET45' },
  { make: 'Honda', model: 'Civic',     yearFrom: 2006, yearTo: 2019, oemOffset: 45, type: 'car',   source: 'research', notes: 'FA/FB/FC Civic 5x114.3 ET45' },
  { make: 'Honda', model: 'Del Sol',   yearFrom: 1993, yearTo: 1997, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Honda', model: 'Insight',   yearFrom: 2020, yearTo: 2020, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Honda', model: 'Odyssey',   yearFrom: 1995, yearTo: 1999, oemOffset: 45, type: 'suv',   source: 'research', notes: 'RA1 Odyssey 5x114.3 ET45' },
  { make: 'Honda', model: 'Passport',  yearFrom: 1994, yearTo: 1999, oemOffset: 10, type: 'truck',  source: 'wheels_json', notes: '6x139.7 rebadged Isuzu' },
  { make: 'Honda', model: 'Prelude',   yearFrom: 1990, yearTo: 1991, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Honda', model: 'Prelude',   yearFrom: 1992, yearTo: 1996, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Honda', model: 'Prelude',   yearFrom: 1997, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },

  // ═══════════════════════ HYUNDAI (mixed case) ═══════════════════════
  { make: 'Hyundai', model: 'Accent',           yearFrom: 1995, yearTo: 1999, oemOffset: 46, type: 'car',   source: 'research', notes: '4x114.3, OEM ET46' },
  { make: 'Hyundai', model: 'Elantra',          yearFrom: 1992, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Hyundai', model: 'Santa Cruz',       yearFrom: 2026, yearTo: 2026, oemOffset: 46, type: 'truck', source: 'research', notes: 'Santa Cruz 5x114.3 ET46 pickup' },
  { make: 'Hyundai', model: 'Santa Fe',         yearFrom: 2000, yearTo: 2026, oemOffset: 46, type: 'suv',   source: 'research', notes: '5x114.3 various gen ET46' },
  { make: 'Hyundai', model: 'Santa Fe Classic', yearFrom: 2007, yearTo: 2012, oemOffset: 46, type: 'suv',   source: 'research', notes: '5x114.3 ET46' },
  { make: 'Hyundai', model: 'Santa Fe Sport',   yearFrom: 2013, yearTo: 2017, oemOffset: 46, type: 'suv',   source: 'research', notes: '5x114.3 ET46' },
  { make: 'Hyundai', model: 'Sonata',           yearFrom: 1990, yearTo: 1999, oemOffset: 46, type: 'car',   source: 'wheels_json', notes: 'multiple offsets; 46 most common' },
  { make: 'Hyundai', model: 'Tiburon',          yearFrom: 1997, yearTo: 1999, oemOffset: 46, type: 'car',   source: 'wheels_json' },
  { make: 'Hyundai', model: 'Tiburon Turbulence', yearFrom: 2000, yearTo: 2001, oemOffset: 46, type: 'car', source: 'research', notes: '4x114.3 ET46' },
  // lowercase 'hyundai'
  { make: 'hyundai', model: 'ioniq 6',          yearFrom: 2024, yearTo: 2024, oemOffset: 52, type: 'car',   source: 'research', notes: 'Hyundai Ioniq 6 5x114.3 ET52 EV sedan' },

  // ═══════════════════════ INFINITI ═══════════════════════
  { make: 'Infiniti', model: 'G20',   yearFrom: 1991, yearTo: 1999, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Infiniti', model: 'I30',   yearFrom: 1996, yearTo: 1999, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Infiniti', model: 'J30',   yearFrom: 1993, yearTo: 1997, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Infiniti', model: 'Q45',   yearFrom: 1990, yearTo: 1999, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Infiniti', model: 'Q50',   yearFrom: 2018, yearTo: 2018, oemOffset: 40, type: 'car',   source: 'research', notes: 'Q50 2018 5x114.3 ET40' },
  { make: 'Infiniti', model: 'Q60',   yearFrom: 2018, yearTo: 2018, oemOffset: 40, type: 'car',   source: 'research', notes: 'Q60 2018 5x114.3 ET40' },
  { make: 'Infiniti', model: 'QX4',   yearFrom: 1997, yearTo: 1999, oemOffset: 20, type: 'suv',   source: 'wheels_json', notes: '6x139.7 ET20' },

  // ═══════════════════════ ISUZU ═══════════════════════
  { make: 'Isuzu', model: 'Amigo',    yearFrom: 1990, yearTo: 1999, oemOffset: 35, type: 'suv',   source: 'wheels_json' },
  { make: 'Isuzu', model: 'Oasis',    yearFrom: 1996, yearTo: 1999, oemOffset: 45, type: 'suv',   source: 'wheels_json' },
  { make: 'Isuzu', model: 'VehiCROSS', yearFrom: 1999, yearTo: 1999, oemOffset: 38, type: 'suv',  source: 'wheels_json' },

  // ═══════════════════════ KARMA ═══════════════════════
  { make: 'Karma', model: 'Revero',   yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'Karma Revero 5x130 ET45 luxury EV' },

  // ═══════════════════════ KIA (mixed case) ═══════════════════════
  { make: 'Kia', model: 'Carnival',   yearFrom: 2026, yearTo: 2026, oemOffset: 50, type: 'suv',   source: 'research', notes: 'Kia Carnival 5x114.3 ET50 minivan' },
  { make: 'Kia', model: 'K5',         yearFrom: 2026, yearTo: 2026, oemOffset: 50, type: 'car',   source: 'research', notes: 'Kia K5 2026 5x114.3 ET50' },
  { make: 'Kia', model: 'Stinger',    yearFrom: 2018, yearTo: 2018, oemOffset: 52, type: 'car',   source: 'research', notes: 'Kia Stinger 5x114.3 ET52' },
  // lowercase 'kia'
  { make: 'kia', model: 'ev6',        yearFrom: 2024, yearTo: 2024, oemOffset: 52, type: 'suv',   source: 'research', notes: 'Kia EV6 5x114.3 ET52 EV crossover' },

  // ═══════════════════════ LEXUS ═══════════════════════
  { make: 'Lexus', model: 'ES300',    yearFrom: 1992, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Lexus', model: 'GS F',     yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'GS F 5x114.3 ET45' },
  { make: 'Lexus', model: 'GS300',    yearFrom: 1993, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'GS300/350 5x114.3 ET45' },
  { make: 'Lexus', model: 'GS350',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'GS350 5x114.3 ET45' },
  { make: 'Lexus', model: 'GS450h',   yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'GS450h 5x114.3 ET45' },
  { make: 'Lexus', model: 'IS300',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'IS300 5x114.3 ET45' },
  { make: 'Lexus', model: 'IS350',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'IS350 5x114.3 ET45' },
  { make: 'Lexus', model: 'LC500',    yearFrom: 2018, yearTo: 2018, oemOffset: 50, type: 'car',   source: 'research', notes: 'LC500 5x120 ET50 grand tourer' },
  { make: 'Lexus', model: 'LC500h',   yearFrom: 2018, yearTo: 2018, oemOffset: 50, type: 'car',   source: 'research', notes: 'LC500h 5x120 ET50' },
  { make: 'Lexus', model: 'LS400',    yearFrom: 1990, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Lexus', model: 'LS500',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'LS500 5x120 ET45' },
  { make: 'Lexus', model: 'LX450',    yearFrom: 1996, yearTo: 1997, oemOffset: 0,  type: 'suv',   source: 'wheels_json', notes: '6x139.7 ET0' },
  { make: 'Lexus', model: 'RC F',     yearFrom: 2015, yearTo: 2025, oemOffset: 48, type: 'car',   source: 'wheels_json', notes: 'staggered front 50/rear 48, use 48' },
  { make: 'Lexus', model: 'RC300',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'RC300 5x114.3 ET45' },
  { make: 'Lexus', model: 'RC350',    yearFrom: 2018, yearTo: 2018, oemOffset: 45, type: 'car',   source: 'research', notes: 'RC350 5x114.3 ET45' },
  { make: 'Lexus', model: 'RX300',    yearFrom: 1999, yearTo: 1999, oemOffset: 35, type: 'suv',   source: 'wheels_json' },
  { make: 'Lexus', model: 'SC300',    yearFrom: 1992, yearTo: 1999, oemOffset: 50, type: 'car',   source: 'wheels_json' },
  { make: 'Lexus', model: 'SC400',    yearFrom: 1992, yearTo: 1999, oemOffset: 50, type: 'car',   source: 'wheels_json' },

  // ═══════════════════════ LUCID ═══════════════════════
  { make: 'Lucid', model: 'air',      yearFrom: 2023, yearTo: 2024, oemOffset: 45, type: 'car',   source: 'research', notes: 'Lucid Air 5x120 ET45 luxury EV sedan' },
  { make: 'Lucid', model: 'gravity',  yearFrom: 2024, yearTo: 2024, oemOffset: 40, type: 'suv',   source: 'research', notes: 'Lucid Gravity 5x120 ET40 luxury EV SUV' },

  // ═══════════════════════ MAZDA ═══════════════════════
  { make: 'Mazda', model: '626',      yearFrom: 1990, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: '929',      yearFrom: 1990, yearTo: 1995, oemOffset: 50, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'B2300',    yearFrom: 1994, yearTo: 1999, oemOffset: 42, type: 'truck', source: 'wheels_json' },
  { make: 'Mazda', model: 'B3000',    yearFrom: 1994, yearTo: 1995, oemOffset: 42, type: 'truck', source: 'wheels_json' },
  { make: 'Mazda', model: 'B3000',    yearFrom: 1996, yearTo: 1999, oemOffset: 42, type: 'truck', source: 'wheels_json' },
  { make: 'Mazda', model: 'B4000',    yearFrom: 1994, yearTo: 1999, oemOffset: 45, type: 'truck', source: 'wheels_json', notes: '5x114.3 midsize truck' },
  { make: 'Mazda', model: 'MPV',      yearFrom: 1990, yearTo: 1998, oemOffset: 40, type: 'suv',   source: 'wheels_json' },
  { make: 'Mazda', model: 'MX-5',     yearFrom: 1990, yearTo: 1990, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'MX-6',     yearFrom: 1990, yearTo: 1997, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'Mazda6',   yearFrom: 2003, yearTo: 2021, oemOffset: 55, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'Miata',    yearFrom: 1990, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'Millenia', yearFrom: 1995, yearTo: 1999, oemOffset: 50, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'Protege',  yearFrom: 1990, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Mazda', model: 'RX-7',     yearFrom: 1990, yearTo: 1992, oemOffset: 37, type: 'car',   source: 'wheels_json', notes: 'staggered; front ET37' },
  { make: 'Mazda', model: 'RX-7',     yearFrom: 1993, yearTo: 1995, oemOffset: 37, type: 'car',   source: 'wheels_json', notes: 'staggered; front ET37' },

  // ═══════════════════════ MITSUBISHI ═══════════════════════
  { make: 'Mitsubishi', model: 'Galant',   yearFrom: 1990, yearTo: 1993, oemOffset: 46, type: 'car',   source: 'wheels_json' },
  { make: 'Mitsubishi', model: 'Montero',  yearFrom: 1990, yearTo: 1991, oemOffset: 15, type: 'truck', source: 'wheels_json', notes: '6x139.7 varies; use ET15 mid' },

  // ═══════════════════════ NISSAN ═══════════════════════
  { make: 'Nissan', model: '240SX',    yearFrom: 1990, yearTo: 1998, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Nissan', model: '300ZX',    yearFrom: 1990, yearTo: 1996, oemOffset: 35, type: 'car',   source: 'wheels_json', notes: 'staggered; rear ET35' },
  { make: 'Nissan', model: '370Z',     yearFrom: 2018, yearTo: 2018, oemOffset: 30, type: 'car',   source: 'research', notes: '370Z 5x114.3 ET30 front' },
  { make: 'Nissan', model: 'Altima',   yearFrom: 1993, yearTo: 1997, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Nissan', model: 'Frontier', yearFrom: 1998, yearTo: 1999, oemOffset: 18, type: 'truck', source: 'wheels_json', notes: '6x139.7' },
  { make: 'Nissan', model: 'GT-R',     yearFrom: 2018, yearTo: 2018, oemOffset: 35, type: 'car',   source: 'research', notes: 'GT-R 5x114.3 ET30-35 front' },
  { make: 'Nissan', model: 'Maxima',   yearFrom: 1990, yearTo: 1994, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Nissan', model: 'Pathfinder', yearFrom: 1987, yearTo: 1989, oemOffset: 25, type: 'suv', source: 'wheels_json', notes: '6x139.7' },
  { make: 'Nissan', model: 'Pathfinder', yearFrom: 1990, yearTo: 1995, oemOffset: 25, type: 'suv', source: 'wheels_json', notes: '6x139.7' },
  { make: 'Nissan', model: 'Pickup',   yearFrom: 1990, yearTo: 1997, oemOffset: 12, type: 'truck', source: 'wheels_json', notes: '6x139.7' },
  { make: 'Nissan', model: 'Quest',    yearFrom: 1993, yearTo: 1999, oemOffset: 45, type: 'suv',   source: 'wheels_json' },
  { make: 'Nissan', model: 'Sentra',   yearFrom: 1990, yearTo: 1994, oemOffset: 37, type: 'car',   source: 'wheels_json' },

  // ═══════════════════════ RIVIAN ═══════════════════════
  { make: 'rivian', model: 'r1s',      yearFrom: 2024, yearTo: 2024, oemOffset: 30, type: 'suv',   source: 'research', notes: 'Rivian R1S 5x139.7 ~ET30 EV SUV' },
  { make: 'rivian', model: 'r1t',      yearFrom: 2024, yearTo: 2024, oemOffset: 30, type: 'truck', source: 'research', notes: 'Rivian R1T 5x139.7 ~ET30 EV truck' },

  // ═══════════════════════ SUBARU ═══════════════════════
  { make: 'Subaru', model: 'Impreza',         yearFrom: 1993, yearTo: 1999, oemOffset: 55, type: 'car',   source: 'wheels_json' },
  { make: 'Subaru', model: 'Impreza WRX STI', yearFrom: 2014, yearTo: 2014, oemOffset: 55, type: 'car',   source: 'wheels_json' },
  { make: 'Subaru', model: 'Legacy',          yearFrom: 1990, yearTo: 1994, oemOffset: 55, type: 'car',   source: 'wheels_json' },
  { make: 'Subaru', model: 'SVX',             yearFrom: 1992, yearTo: 1997, oemOffset: 55, type: 'car',   source: 'wheels_json' },
  { make: 'Subaru', model: 'WRX STI',         yearFrom: 2014, yearTo: 2021, oemOffset: 55, type: 'car',   source: 'wheels_json' },

  // ═══════════════════════ SUZUKI ═══════════════════════
  { make: 'Suzuki', model: 'Grand Vitara', yearFrom: 1999, yearTo: 1999, oemOffset: 35, type: 'suv',   source: 'wheels_json' },
  { make: 'Suzuki', model: 'Sidekick',     yearFrom: 1990, yearTo: 1998, oemOffset: 25, type: 'suv',   source: 'wheels_json' },
  { make: 'Suzuki', model: 'Swift',        yearFrom: 1990, yearTo: 1999, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Suzuki', model: 'Vitara',       yearFrom: 1999, yearTo: 1999, oemOffset: 30, type: 'suv',   source: 'wheels_json' },
  { make: 'Suzuki', model: 'X-90',         yearFrom: 1996, yearTo: 1997, oemOffset: 25, type: 'suv',   source: 'wheels_json' },

  // ═══════════════════════ TESLA (mixed case) ═══════════════════════
  { make: 'Tesla', model: 'Model S',   yearFrom: 2018, yearTo: 2018, oemOffset: 47, type: 'car',   source: 'research', notes: 'Tesla Model S 5x120 ET47' },
  { make: 'Tesla', model: 'Model X',   yearFrom: 2018, yearTo: 2018, oemOffset: 47, type: 'suv',   source: 'research', notes: 'Tesla Model X 5x120 ET47 SUV' },
  { make: 'tesla', model: 'model 3',   yearFrom: 2024, yearTo: 2024, oemOffset: 40, type: 'car',   source: 'research', notes: 'Tesla Model 3 5x114.3 ET40' },
  { make: 'tesla', model: 'model s',   yearFrom: 2024, yearTo: 2024, oemOffset: 47, type: 'car',   source: 'research', notes: 'Tesla Model S 5x120 ET47' },
  { make: 'tesla', model: 'model x',   yearFrom: 2024, yearTo: 2024, oemOffset: 47, type: 'suv',   source: 'research', notes: 'Tesla Model X 5x120 ET47 SUV' },
  { make: 'tesla', model: 'model y',   yearFrom: 2024, yearTo: 2024, oemOffset: 40, type: 'suv',   source: 'research', notes: 'Tesla Model Y 5x114.3 ET40 SUV' },

  // ═══════════════════════ TOYOTA ═══════════════════════
  { make: 'Toyota', model: '4Runner',      yearFrom: 1984, yearTo: 1988, oemOffset: 10, type: 'truck', source: 'research', notes: 'Gen1 4Runner 6x139.7 ~ET10' },
  { make: 'Toyota', model: 'Avalon',       yearFrom: 1995, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'Camry',        yearFrom: 1990, yearTo: 1991, oemOffset: 45, type: 'car',   source: 'research', notes: 'V10 Camry 5x114.3 ET45' },
  { make: 'Toyota', model: 'Celica',       yearFrom: 1990, yearTo: 1999, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'Corolla',      yearFrom: 1990, yearTo: 1997, oemOffset: 45, type: 'car',   source: 'research', notes: 'AE92/AE101 4x100 ET45' },
  { make: 'Toyota', model: 'Corolla',      yearFrom: 1998, yearTo: 1999, oemOffset: 45, type: 'car',   source: 'research', notes: 'ZZE110 5x100 ET45' },
  { make: 'Toyota', model: 'FJ Cruiser',   yearFrom: 2007, yearTo: 2014, oemOffset: 15, type: 'truck', source: 'wheels_json', notes: '6x139.7 ET15' },
  { make: 'Toyota', model: 'GR Corolla',   yearFrom: 2023, yearTo: 2026, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'GR Supra',     yearFrom: 2020, yearTo: 2026, oemOffset: 32, type: 'car',   source: 'wheels_json', notes: 'staggered front ET32/rear ET40; use front' },
  { make: 'Toyota', model: 'Grand Highlander', yearFrom: 2024, yearTo: 2026, oemOffset: 35, type: 'suv', source: 'wheels_json' },
  { make: 'Toyota', model: 'Highlander',   yearFrom: 2004, yearTo: 2026, oemOffset: 40, type: 'suv',   source: 'wheels_json' },
  // Land Cruiser: use conservative research offsets (the "56" in wheels JSON is wrong for old gens)
  { make: 'Toyota', model: 'Land Cruiser', yearFrom: 1980, yearTo: 1989, oemOffset: 20, type: 'truck', source: 'research', notes: 'FJ62 6x139.7 ~ET20; wheels JSON offset 56 is wrong' },
  { make: 'Toyota', model: 'Land Cruiser', yearFrom: 1990, yearTo: 1997, oemOffset: 25, type: 'truck', source: 'research', notes: 'FJ80 6x139.7 ~ET25' },
  { make: 'Toyota', model: 'Land Cruiser', yearFrom: 1998, yearTo: 2001, oemOffset: 30, type: 'truck', source: 'research', notes: '100 series 5x150 ET30' },
  { make: 'Toyota', model: 'Land Cruiser', yearFrom: 2002, yearTo: 2026, oemOffset: 50, type: 'suv',   source: 'research', notes: '100/200/300 series 5x150 later ET50' },
  { make: 'Toyota', model: 'MR2 Spyder',   yearFrom: 2000, yearTo: 2005, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'Prius Plug-in', yearFrom: 2012, yearTo: 2015, oemOffset: 40, type: 'car',  source: 'wheels_json' },
  { make: 'Toyota', model: 'Prius Prime',  yearFrom: 2017, yearTo: 2024, oemOffset: 40, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'Prius V',      yearFrom: 2012, yearTo: 2017, oemOffset: 45, type: 'car',   source: 'wheels_json' },
  { make: 'Toyota', model: 'RAV4',         yearFrom: 2019, yearTo: 2026, oemOffset: 40, type: 'suv',   source: 'wheels_json' },
  { make: 'Toyota', model: 'RAV4 Hybrid',  yearFrom: 2025, yearTo: 2025, oemOffset: 40, type: 'suv',   source: 'research', notes: 'RAV4 Hybrid 5x114.3 ET40 same as standard' },
  // Sequoia: offset 55 in wheels JSON - plausible for some Platinum trim specs
  { make: 'Toyota', model: 'Sequoia',      yearFrom: 2020, yearTo: 2022, oemOffset: 45, type: 'suv',   source: 'research', notes: '5x150 Sequoia 2020-22 OEM ET45' },
  { make: 'Toyota', model: 'Sequoia',      yearFrom: 2023, yearTo: 2026, oemOffset: 45, type: 'suv',   source: 'research', notes: '6x139.7 Sequoia 2023+ OEM ET45' },
  { make: 'Toyota', model: 'Sienna',       yearFrom: 1998, yearTo: 2026, oemOffset: 42, type: 'suv',   source: 'wheels_json' },
  { make: 'Toyota', model: 'Supra',        yearFrom: 1990, yearTo: 1998, oemOffset: 32, type: 'car',   source: 'wheels_json', notes: 'staggered front ET32/rear ET40' },
  { make: 'Toyota', model: 'Supra',        yearFrom: 2020, yearTo: 2026, oemOffset: 32, type: 'car',   source: 'wheels_json', notes: 'staggered front ET32/rear ET40' },
  { make: 'Toyota', model: 'T100',         yearFrom: 1993, yearTo: 1998, oemOffset: 8,  type: 'truck', source: 'wheels_json', notes: '6x139.7 ET8 truck' },
  { make: 'Toyota', model: 'Tacoma',       yearFrom: 2024, yearTo: 2026, oemOffset: 25, type: 'truck', source: 'research', notes: '2024+ Tacoma 6x139.7 ~ET25' },
  { make: 'Toyota', model: 'Tercel',       yearFrom: 1990, yearTo: 1999, oemOffset: 39, type: 'car',   source: 'wheels_json' },

];

// Thread size mapping by bolt pattern
function getThreadSize(boltPattern) {
  if (!boltPattern) return null;
  // Most Japanese/Korean cars use M12x1.5
  if (boltPattern.includes('x100') || boltPattern.includes('x114.3') || 
      boltPattern.includes('x120') || boltPattern.includes('x112') ||
      boltPattern.includes('x110') || boltPattern.includes('x130')) {
    return 'M12x1.5';
  }
  // Some Toyota uses M12x1.5 too for 5x150
  if (boltPattern.includes('x150') || boltPattern.includes('x139.7')) {
    return 'M12x1.5';
  }
  return 'M12x1.5'; // default for Japanese/Korean
}

async function runUpdates() {
  const log = {
    timestamp: new Date().toISOString(),
    totalGroups: updates.length,
    results: [],
    summary: { updated: 0, failed: 0, skipped: 0 }
  };

  for (const entry of updates) {
    const [offset_min, offset_max] = calcRange(entry.oemOffset, entry.type);
    const thread_size = 'M12x1.5';
    
    try {
      const result = await pool.query(`
        UPDATE vehicle_fitments
        SET offset_min_mm = $1,
            offset_max_mm = $2,
            thread_size = COALESCE(thread_size, $3),
            updated_at = NOW()
        WHERE LOWER(make) = LOWER($4)
          AND LOWER(model) = LOWER($5)
          AND (offset_min_mm IS NULL OR offset_max_mm IS NULL)
          AND year BETWEEN $6 AND $7
      `, [offset_min, offset_max, thread_size, entry.make, entry.model, entry.yearFrom, entry.yearTo]);

      const rowsUpdated = result.rowCount;
      log.summary.updated += rowsUpdated;
      
      const logEntry = {
        make: entry.make,
        model: entry.model,
        years: `${entry.yearFrom}-${entry.yearTo}`,
        oemOffset: entry.oemOffset,
        type: entry.type,
        range: `${offset_min} to ${offset_max}`,
        rowsUpdated,
        source: entry.source,
        notes: entry.notes || null
      };
      log.results.push(logEntry);

      if (rowsUpdated > 0) {
        console.log(`✅ ${entry.make} ${entry.model} ${entry.yearFrom}-${entry.yearTo}: ET${entry.oemOffset} → [${offset_min}, ${offset_max}] (${rowsUpdated} rows, ${entry.type})`);
      } else {
        console.log(`⚪ ${entry.make} ${entry.model} ${entry.yearFrom}-${entry.yearTo}: 0 rows updated (already set or not found)`);
      }
    } catch (err) {
      console.error(`❌ ERROR ${entry.make} ${entry.model}: ${err.message}`);
      log.results.push({
        make: entry.make, model: entry.model,
        years: `${entry.yearFrom}-${entry.yearTo}`,
        error: err.message,
        source: entry.source
      });
      log.summary.failed++;
    }
  }

  return log;
}

console.log('Starting offset updates for Japanese/Korean/EV brands...\n');
const log = await runUpdates();

// Verification query
console.log('\n--- Post-update verification ---');
const verify = await pool.query(`
  SELECT make, COUNT(*) total,
    SUM(CASE WHEN offset_min_mm IS NULL THEN 1 ELSE 0 END) still_null
  FROM vehicle_fitments
  WHERE LOWER(make) IN ('toyota','lexus','honda','acura','nissan','infiniti','mazda','subaru',
                        'hyundai','kia','mitsubishi','isuzu','daewoo','suzuki','genesis',
                        'tesla','rivian','lucid','karma')
  GROUP BY make
  ORDER BY make
`);

console.log('\nRemaining nulls by make:');
let totalRemaining = 0;
for (const row of verify.rows) {
  if (parseInt(row.still_null) > 0) {
    console.log(`  ${row.make}: ${row.still_null}/${row.total} still null`);
    totalRemaining += parseInt(row.still_null);
  }
}
console.log(`Total remaining nulls: ${totalRemaining}`);

log.verification = verify.rows;
log.totalRemainingNulls = totalRemaining;

// Write log
const logPath = join(__dirname, 'offset-research-japanese.json');
writeFileSync(logPath, JSON.stringify(log, null, 2));
console.log(`\n📄 Log saved to ${logPath}`);
console.log(`\n✅ Summary: ${log.summary.updated} rows updated, ${log.summary.failed} errors`);

await pool.end();
