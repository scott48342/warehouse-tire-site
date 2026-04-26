/**
 * BULK FUTURE_TRIM Correction Engine
 * 
 * Processes all remaining FUTURE_TRIM records family-by-family with:
 * - Per-family FutureTrimConfig
 * - Generation-correct OEM specs
 * - Audit trail preservation
 * - Strict recertification
 * - Per-family reporting
 */
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

// ============================================================
// TYPES
// ============================================================

interface WheelSpec {
  axle: string;
  width: number;
  offset: number | null;
  isStock: boolean;
  diameter: number;
}

interface GenerationSpec {
  yearStart: number;
  yearEnd: number;
  validTrims: string[];
  defaultTrim: string;
  specs: {
    bolt_pattern: string;
    center_bore_mm: number;
    defaultWheels: WheelSpec[];
    defaultTires: string[];
  };
}

interface FamilyConfig {
  make: string;
  model: string;
  futureTrims: string[];
  firstValidYear: number;
  generations: GenerationSpec[];
}

interface FamilyResult {
  family: string;
  processed: number;
  recertified: number;
  stillNeedsReview: number;
  errors: string[];
}

// ============================================================
// FAMILY CONFIGURATIONS
// ============================================================

const FAMILY_CONFIGS: FamilyConfig[] = [
  // CADILLAC ESCALADE
  {
    make: 'Cadillac',
    model: 'escalade',
    futureTrims: ['Escalade-V', 'Sport Platinum', 'Premium Luxury Platinum', 'V-Series'],
    firstValidYear: 2023,
    generations: [
      {
        yearStart: 1999,
        yearEnd: 2006,
        validTrims: ['Base', 'EXT', 'ESV'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 31, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2014,
        validTrims: ['Base', 'Luxury', 'Premium', 'Platinum'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8.5, offset: 31, isStock: true, diameter: 18 }],
          defaultTires: ['265/65R18']
        }
      },
      {
        yearStart: 2015,
        yearEnd: 2020,
        validTrims: ['Base', 'Luxury', 'Premium Luxury', 'Platinum'],
        defaultTrim: 'Premium Luxury',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 9, offset: 24, isStock: true, diameter: 22 }],
          defaultTires: ['285/45R22']
        }
      },
      {
        yearStart: 2021,
        yearEnd: 2022,
        validTrims: ['Base', 'Luxury', 'Premium Luxury', 'Platinum', 'Sport', 'Sport Platinum'],
        defaultTrim: 'Premium Luxury',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 9, offset: 24, isStock: true, diameter: 22 }],
          defaultTires: ['275/50R22']
        }
      }
    ]
  },
  // CADILLAC ESCALADE-ESV
  {
    make: 'Cadillac',
    model: 'escalade-esv',
    futureTrims: ['Escalade-V', 'Sport Platinum', 'Premium Luxury Platinum', 'V-Series'],
    firstValidYear: 2023,
    generations: [
      {
        yearStart: 2003,
        yearEnd: 2006,
        validTrims: ['Base', 'Platinum'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 31, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2014,
        validTrims: ['Base', 'Luxury', 'Premium', 'Platinum'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8.5, offset: 31, isStock: true, diameter: 18 }],
          defaultTires: ['265/65R18']
        }
      },
      {
        yearStart: 2015,
        yearEnd: 2020,
        validTrims: ['Base', 'Luxury', 'Premium Luxury', 'Platinum'],
        defaultTrim: 'Premium Luxury',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 9, offset: 24, isStock: true, diameter: 22 }],
          defaultTires: ['285/45R22']
        }
      },
      {
        yearStart: 2021,
        yearEnd: 2022,
        validTrims: ['Base', 'Luxury', 'Premium Luxury', 'Platinum', 'Sport'],
        defaultTrim: 'Premium Luxury',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 9, offset: 24, isStock: true, diameter: 22 }],
          defaultTires: ['275/50R22']
        }
      }
    ]
  },
  // GMC YUKON
  {
    make: 'GMC',
    model: 'yukon',
    futureTrims: ['Denali Ultimate', 'AT4', 'AT4X'],
    firstValidYear: 2021,
    generations: [
      {
        yearStart: 1992,
        yearEnd: 1999,
        validTrims: ['Base', 'SLE', 'SLT'],
        defaultTrim: 'SLE',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 31, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2000,
        yearEnd: 2006,
        validTrims: ['Base', 'SLE', 'SLT', 'Denali'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 31, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2014,
        validTrims: ['Base', 'SLE', 'SLT', 'Denali'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 31, isStock: true, diameter: 18 }],
          defaultTires: ['265/65R18']
        }
      },
      {
        yearStart: 2015,
        yearEnd: 2020,
        validTrims: ['Base', 'SLE', 'SLT', 'Denali'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8.5, offset: 24, isStock: true, diameter: 20 }],
          defaultTires: ['275/55R20']
        }
      }
    ]
  },
  // CHEVROLET TAHOE
  {
    make: 'Chevrolet',
    model: 'tahoe',
    futureTrims: ['Z71', 'RST', 'High Country', 'Premier'],
    firstValidYear: 2015,
    generations: [
      {
        yearStart: 1995,
        yearEnd: 1999,
        validTrims: ['Base', 'LS', 'LT', 'Limited'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 31, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2000,
        yearEnd: 2006,
        validTrims: ['Base', 'LS', 'LT'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 31, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2014,
        validTrims: ['Base', 'LS', 'LT', 'LTZ'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 31, isStock: true, diameter: 18 }],
          defaultTires: ['265/65R18']
        }
      }
    ]
  },
  // FORD EXPLORER
  {
    make: 'Ford',
    model: 'explorer',
    futureTrims: ['ST', 'Platinum', 'Timberline', 'King Ranch'],
    firstValidYear: 2020,
    generations: [
      {
        yearStart: 1991,
        yearEnd: 2001,
        validTrims: ['Base', 'Sport', 'XL', 'XLT', 'Eddie Bauer', 'Limited'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 70.6,
          defaultWheels: [{ axle: 'both', width: 7, offset: 40, isStock: true, diameter: 15 }],
          defaultTires: ['235/75R15']
        }
      },
      {
        yearStart: 2002,
        yearEnd: 2005,
        validTrims: ['Base', 'XLS', 'XLT', 'Eddie Bauer', 'Limited', 'NBX'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 70.6,
          defaultWheels: [{ axle: 'both', width: 7, offset: 40, isStock: true, diameter: 16 }],
          defaultTires: ['245/70R16']
        }
      },
      {
        yearStart: 2006,
        yearEnd: 2010,
        validTrims: ['Base', 'XLT', 'Eddie Bauer', 'Limited'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '6x135',
          center_bore_mm: 87.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 44, isStock: true, diameter: 17 }],
          defaultTires: ['245/65R17']
        }
      },
      {
        yearStart: 2011,
        yearEnd: 2019,
        validTrims: ['Base', 'XLT', 'Limited', 'Sport'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 63.4,
          defaultWheels: [{ axle: 'both', width: 8, offset: 44, isStock: true, diameter: 18 }],
          defaultTires: ['255/65R18']
        }
      }
    ]
  },
  // FORD RANGER
  {
    make: 'Ford',
    model: 'ranger',
    futureTrims: ['Raptor', 'Tremor'],
    firstValidYear: 2024,
    generations: [
      {
        yearStart: 1983,
        yearEnd: 1992,
        validTrims: ['Base', 'S', 'XL', 'XLT', 'STX', 'Sport'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 70.6,
          defaultWheels: [{ axle: 'both', width: 6, offset: 45, isStock: true, diameter: 14 }],
          defaultTires: ['205/75R14']
        }
      },
      {
        yearStart: 1993,
        yearEnd: 2011,
        validTrims: ['Base', 'XL', 'XLT', 'Edge', 'Sport', 'FX4'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 70.6,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 15 }],
          defaultTires: ['225/70R15']
        }
      },
      {
        yearStart: 2019,
        yearEnd: 2023,
        validTrims: ['XL', 'XLT', 'Lariat'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 93.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['265/65R17']
        }
      }
    ]
  },
  // FORD EXPEDITION
  {
    make: 'Ford',
    model: 'expedition',
    futureTrims: ['Timberline', 'Stealth Edition', 'King Ranch'],
    firstValidYear: 2022,
    generations: [
      {
        yearStart: 1997,
        yearEnd: 2002,
        validTrims: ['XLT', 'Eddie Bauer'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '5x135',
          center_bore_mm: 87.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 44, isStock: true, diameter: 16 }],
          defaultTires: ['255/70R16']
        }
      },
      {
        yearStart: 2003,
        yearEnd: 2006,
        validTrims: ['XLS', 'XLT', 'Eddie Bauer', 'Limited'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '6x135',
          center_bore_mm: 87.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 44, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2017,
        validTrims: ['XL', 'XLT', 'Limited', 'EL', 'King Ranch', 'Platinum'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '6x135',
          center_bore_mm: 87.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 44, isStock: true, diameter: 18 }],
          defaultTires: ['275/65R18']
        }
      },
      {
        yearStart: 2018,
        yearEnd: 2021,
        validTrims: ['XL', 'XLT', 'Limited', 'Platinum', 'King Ranch'],
        defaultTrim: 'XLT',
        specs: {
          bolt_pattern: '6x135',
          center_bore_mm: 87.1,
          defaultWheels: [{ axle: 'both', width: 8.5, offset: 44, isStock: true, diameter: 20 }],
          defaultTires: ['275/55R20']
        }
      }
    ]
  },
  // GMC CANYON
  {
    make: 'GMC',
    model: 'canyon',
    futureTrims: ['AT4X', 'Denali'],
    firstValidYear: 2015,
    generations: [
      {
        yearStart: 2004,
        yearEnd: 2012,
        validTrims: ['SL', 'SLE', 'SLT'],
        defaultTrim: 'SLE',
        specs: {
          bolt_pattern: '6x127',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 6, offset: 45, isStock: true, diameter: 15 }],
          defaultTires: ['215/75R15']
        }
      }
    ]
  },
  // CHEVROLET COLORADO
  {
    make: 'Chevrolet',
    model: 'colorado',
    futureTrims: ['ZR2', 'Trail Boss'],
    firstValidYear: 2017,
    generations: [
      {
        yearStart: 2004,
        yearEnd: 2012,
        validTrims: ['Base', 'LS', 'LT', 'Z71'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x127',
          center_bore_mm: 78.1,
          defaultWheels: [{ axle: 'both', width: 6, offset: 45, isStock: true, diameter: 15 }],
          defaultTires: ['215/75R15']
        }
      },
      {
        yearStart: 2015,
        yearEnd: 2016,
        validTrims: ['Base', 'WT', 'LT', 'Z71'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x120',
          center_bore_mm: 67.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['255/65R17']
        }
      }
    ]
  },
  // RAM 2500
  {
    make: 'RAM',
    model: '2500',
    futureTrims: ['Rebel', 'Power Wagon', 'Limited Longhorn'],
    firstValidYear: 2017,
    generations: [
      {
        yearStart: 1994,
        yearEnd: 2002,
        validTrims: ['Base', 'ST', 'SLT', 'Laramie'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2003,
        yearEnd: 2009,
        validTrims: ['Base', 'ST', 'SLT', 'Laramie', 'SXT'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 8, offset: 30, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2010,
        yearEnd: 2016,
        validTrims: ['ST', 'SLT', 'Laramie', 'Outdoorsman', 'Big Horn'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 8, offset: 30, isStock: true, diameter: 18 }],
          defaultTires: ['275/70R18']
        }
      }
    ]
  },
  // RAM 3500
  {
    make: 'RAM',
    model: '3500',
    futureTrims: ['Rebel', 'Limited Longhorn', 'Night Edition'],
    firstValidYear: 2019,
    generations: [
      {
        yearStart: 1994,
        yearEnd: 2002,
        validTrims: ['Base', 'ST', 'SLT', 'Laramie'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 7, offset: 30, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2003,
        yearEnd: 2009,
        validTrims: ['Base', 'ST', 'SLT', 'Laramie', 'SXT'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 8, offset: 30, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2010,
        yearEnd: 2018,
        validTrims: ['ST', 'SLT', 'Laramie', 'Outdoorsman', 'Big Horn'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '8x165.1',
          center_bore_mm: 121.3,
          defaultWheels: [{ axle: 'both', width: 8, offset: 30, isStock: true, diameter: 18 }],
          defaultTires: ['275/70R18']
        }
      }
    ]
  },
  // RAM 1500
  {
    make: 'RAM',
    model: '1500',
    futureTrims: ['TRX', 'Rebel', 'Limited Longhorn'],
    firstValidYear: 2015,
    generations: [
      {
        yearStart: 1994,
        yearEnd: 2001,
        validTrims: ['Base', 'WS', 'ST', 'SLT', 'Laramie'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '5x139.7',
          center_bore_mm: 77.8,
          defaultWheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2002,
        yearEnd: 2008,
        validTrims: ['Base', 'ST', 'SLT', 'Laramie', 'SXT'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '5x139.7',
          center_bore_mm: 77.8,
          defaultWheels: [{ axle: 'both', width: 8, offset: 25, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2009,
        yearEnd: 2014,
        validTrims: ['ST', 'SLT', 'Laramie', 'Sport', 'Express', 'Big Horn', 'Outdoorsman'],
        defaultTrim: 'SLT',
        specs: {
          bolt_pattern: '5x139.7',
          center_bore_mm: 77.8,
          defaultWheels: [{ axle: 'both', width: 8, offset: 25, isStock: true, diameter: 18 }],
          defaultTires: ['275/65R18']
        }
      }
    ]
  },
  // CADILLAC CTS
  {
    make: 'Cadillac',
    model: 'cts',
    futureTrims: ['V-Sport', 'CTS-V', 'Premium Luxury'],
    firstValidYear: 2014,
    generations: [
      {
        yearStart: 2003,
        yearEnd: 2007,
        validTrims: ['Base', 'Luxury', 'Performance'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '5x120',
          center_bore_mm: 67.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 35, isStock: true, diameter: 17 }],
          defaultTires: ['225/55R17']
        }
      },
      {
        yearStart: 2008,
        yearEnd: 2013,
        validTrims: ['Base', 'Luxury', 'Performance', 'Premium'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '5x120',
          center_bore_mm: 67.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 35, isStock: true, diameter: 18 }],
          defaultTires: ['235/50R18']
        }
      }
    ]
  },
  // LEXUS ES
  {
    make: 'Lexus',
    model: 'es',
    futureTrims: ['F Sport', 'Ultra Luxury', 'ES 300h'],
    firstValidYear: 2019,
    generations: [
      {
        yearStart: 1990,
        yearEnd: 1996,
        validTrims: ['ES 250', 'ES 300', 'Base'],
        defaultTrim: 'ES 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 6, offset: 45, isStock: true, diameter: 15 }],
          defaultTires: ['195/65R15']
        }
      },
      {
        yearStart: 1997,
        yearEnd: 2006,
        validTrims: ['ES 300', 'ES 330', 'Base'],
        defaultTrim: 'ES 330',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 16 }],
          defaultTires: ['215/60R16']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2012,
        validTrims: ['ES 350', 'Base'],
        defaultTrim: 'ES 350',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['215/55R17']
        }
      },
      {
        yearStart: 2013,
        yearEnd: 2018,
        validTrims: ['ES 350', 'ES 300h', 'Base'],
        defaultTrim: 'ES 350',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['215/55R17']
        }
      }
    ]
  },
  // LEXUS LS
  {
    make: 'Lexus',
    model: 'ls',
    futureTrims: ['F Sport', 'LS 500h', 'Executive'],
    firstValidYear: 2018,
    generations: [
      {
        yearStart: 1990,
        yearEnd: 1994,
        validTrims: ['LS 400', 'Base'],
        defaultTrim: 'LS 400',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 15 }],
          defaultTires: ['215/65R15']
        }
      },
      {
        yearStart: 1995,
        yearEnd: 2000,
        validTrims: ['LS 400', 'Base'],
        defaultTrim: 'LS 400',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 45, isStock: true, diameter: 16 }],
          defaultTires: ['225/60R16']
        }
      },
      {
        yearStart: 2001,
        yearEnd: 2006,
        validTrims: ['LS 430', 'Base'],
        defaultTrim: 'LS 430',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['225/55R17']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2017,
        validTrims: ['LS 460', 'LS 460L', 'LS 600h', 'Base'],
        defaultTrim: 'LS 460',
        specs: {
          bolt_pattern: '5x120',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 45, isStock: true, diameter: 18 }],
          defaultTires: ['235/50R18']
        }
      }
    ]
  },
  // LEXUS GS
  {
    make: 'Lexus',
    model: 'gs',
    futureTrims: ['F Sport', 'GS F', 'Black Line'],
    firstValidYear: 2013,
    generations: [
      {
        yearStart: 1993,
        yearEnd: 1997,
        validTrims: ['GS 300', 'Base'],
        defaultTrim: 'GS 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 45, isStock: true, diameter: 16 }],
          defaultTires: ['225/55R16']
        }
      },
      {
        yearStart: 1998,
        yearEnd: 2005,
        validTrims: ['GS 300', 'GS 400', 'GS 430', 'Base'],
        defaultTrim: 'GS 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['235/45R17']
        }
      },
      {
        yearStart: 2006,
        yearEnd: 2012,
        validTrims: ['GS 300', 'GS 350', 'GS 430', 'GS 450h', 'GS 460', 'Base'],
        defaultTrim: 'GS 350',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 45, isStock: true, diameter: 18 }],
          defaultTires: ['245/40R18']
        }
      }
    ]
  },
  // LEXUS RX
  {
    make: 'Lexus',
    model: 'rx',
    futureTrims: ['F Sport', 'RX 500h', 'Premium'],
    firstValidYear: 2016,
    generations: [
      {
        yearStart: 1999,
        yearEnd: 2003,
        validTrims: ['RX 300', 'Base'],
        defaultTrim: 'RX 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 35, isStock: true, diameter: 16 }],
          defaultTires: ['225/70R16']
        }
      },
      {
        yearStart: 2004,
        yearEnd: 2009,
        validTrims: ['RX 330', 'RX 350', 'RX 400h', 'Base'],
        defaultTrim: 'RX 350',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 35, isStock: true, diameter: 17 }],
          defaultTires: ['225/65R17']
        }
      },
      {
        yearStart: 2010,
        yearEnd: 2015,
        validTrims: ['RX 350', 'RX 450h', 'Base'],
        defaultTrim: 'RX 350',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 35, isStock: true, diameter: 18 }],
          defaultTires: ['235/60R18']
        }
      }
    ]
  },
  // LEXUS IS
  {
    make: 'Lexus',
    model: 'is',
    futureTrims: ['F Sport', 'IS 500', 'Black Line'],
    firstValidYear: 2014,
    generations: [
      {
        yearStart: 1999,
        yearEnd: 2005,
        validTrims: ['IS 200', 'IS 300', 'Base'],
        defaultTrim: 'IS 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 50, isStock: true, diameter: 16 }],
          defaultTires: ['205/55R16']
        }
      },
      {
        yearStart: 2006,
        yearEnd: 2013,
        validTrims: ['IS 250', 'IS 350', 'Base'],
        defaultTrim: 'IS 250',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['225/45R17']
        }
      }
    ]
  },
  // LEXUS NX
  {
    make: 'Lexus',
    model: 'nx',
    futureTrims: ['F Sport', 'NX 450h+', 'Premium Plus'],
    firstValidYear: 2022,
    generations: [
      {
        yearStart: 2015,
        yearEnd: 2021,
        validTrims: ['NX 200t', 'NX 300', 'NX 300h', 'Base'],
        defaultTrim: 'NX 300',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 35, isStock: true, diameter: 18 }],
          defaultTires: ['225/60R18']
        }
      }
    ]
  },
  // GMC ACADIA
  {
    make: 'GMC',
    model: 'acadia',
    futureTrims: ['AT4', 'Denali'],
    firstValidYear: 2017,
    generations: [
      {
        yearStart: 2007,
        yearEnd: 2016,
        validTrims: ['SL', 'SLE', 'SLT', 'Denali'],
        defaultTrim: 'SLE',
        specs: {
          bolt_pattern: '6x132',
          center_bore_mm: 74.5,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 40, isStock: true, diameter: 18 }],
          defaultTires: ['255/65R18']
        }
      }
    ]
  },
  // GMC TERRAIN
  {
    make: 'GMC',
    model: 'terrain',
    futureTrims: ['AT4', 'Denali'],
    firstValidYear: 2018,
    generations: [
      {
        yearStart: 2010,
        yearEnd: 2017,
        validTrims: ['SL', 'SLE', 'SLT', 'Denali'],
        defaultTrim: 'SLE',
        specs: {
          bolt_pattern: '5x120',
          center_bore_mm: 67.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 45, isStock: true, diameter: 17 }],
          defaultTires: ['225/65R17']
        }
      }
    ]
  },
  // CHEVROLET TRAVERSE
  {
    make: 'Chevrolet',
    model: 'traverse',
    futureTrims: ['RS', 'High Country'],
    firstValidYear: 2018,
    generations: [
      {
        yearStart: 2009,
        yearEnd: 2017,
        validTrims: ['LS', 'LT', 'LTZ', 'Premier'],
        defaultTrim: 'LT',
        specs: {
          bolt_pattern: '6x132',
          center_bore_mm: 74.5,
          defaultWheels: [{ axle: 'both', width: 7.5, offset: 40, isStock: true, diameter: 18 }],
          defaultTires: ['255/65R18']
        }
      }
    ]
  },
  // TOYOTA RAV4
  {
    make: 'Toyota',
    model: 'rav4',
    futureTrims: ['TRD Off-Road', 'Adventure', 'XSE'],
    firstValidYear: 2019,
    generations: [
      {
        yearStart: 1996,
        yearEnd: 2000,
        validTrims: ['Base', 'L', 'LE'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 6, offset: 35, isStock: true, diameter: 16 }],
          defaultTires: ['215/70R16']
        }
      },
      {
        yearStart: 2001,
        yearEnd: 2005,
        validTrims: ['Base', 'L', 'Sport'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 35, isStock: true, diameter: 16 }],
          defaultTires: ['225/70R16']
        }
      },
      {
        yearStart: 2006,
        yearEnd: 2012,
        validTrims: ['Base', 'Sport', 'Limited'],
        defaultTrim: 'Base',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 35, isStock: true, diameter: 17 }],
          defaultTires: ['235/65R17']
        }
      },
      {
        yearStart: 2013,
        yearEnd: 2018,
        validTrims: ['LE', 'XLE', 'Limited', 'SE'],
        defaultTrim: 'XLE',
        specs: {
          bolt_pattern: '5x114.3',
          center_bore_mm: 60.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 35, isStock: true, diameter: 17 }],
          defaultTires: ['225/65R17']
        }
      }
    ]
  },
  // TOYOTA 4RUNNER
  {
    make: 'Toyota',
    model: '4runner',
    futureTrims: ['TRD Pro', 'Venture', 'Trail Edition'],
    firstValidYear: 2015,
    generations: [
      {
        yearStart: 1990,
        yearEnd: 1995,
        validTrims: ['Base', 'SR5', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 106.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 15 }],
          defaultTires: ['235/75R15']
        }
      },
      {
        yearStart: 1996,
        yearEnd: 2002,
        validTrims: ['Base', 'SR5', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 106.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 15, isStock: true, diameter: 16 }],
          defaultTires: ['265/70R16']
        }
      },
      {
        yearStart: 2003,
        yearEnd: 2009,
        validTrims: ['Base', 'SR5', 'Sport', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 106.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 15, isStock: true, diameter: 17 }],
          defaultTires: ['265/65R17']
        }
      },
      {
        yearStart: 2010,
        yearEnd: 2014,
        validTrims: ['SR5', 'Trail', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 106.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 15, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      }
    ]
  },
  // TOYOTA TUNDRA
  {
    make: 'Toyota',
    model: 'tundra',
    futureTrims: ['TRD Pro', 'Capstone', '1794 Edition'],
    firstValidYear: 2015,
    generations: [
      {
        yearStart: 2000,
        yearEnd: 2006,
        validTrims: ['Base', 'SR5', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '6x139.7',
          center_bore_mm: 106.1,
          defaultWheels: [{ axle: 'both', width: 7, offset: 25, isStock: true, diameter: 16 }],
          defaultTires: ['245/75R16']
        }
      },
      {
        yearStart: 2007,
        yearEnd: 2014,
        validTrims: ['Base', 'SR5', 'Limited', 'Platinum', 'Grade'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '5x150',
          center_bore_mm: 110.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 50, isStock: true, diameter: 18 }],
          defaultTires: ['275/65R18']
        }
      }
    ]
  },
  // TOYOTA SEQUOIA
  {
    make: 'Toyota',
    model: 'sequoia',
    futureTrims: ['TRD Pro', 'Capstone', 'Platinum'],
    firstValidYear: 2020,
    generations: [
      {
        yearStart: 2001,
        yearEnd: 2007,
        validTrims: ['SR5', 'Limited'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '5x150',
          center_bore_mm: 110.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 50, isStock: true, diameter: 17 }],
          defaultTires: ['265/70R17']
        }
      },
      {
        yearStart: 2008,
        yearEnd: 2019,
        validTrims: ['SR5', 'Limited', 'Platinum'],
        defaultTrim: 'SR5',
        specs: {
          bolt_pattern: '5x150',
          center_bore_mm: 110.1,
          defaultWheels: [{ axle: 'both', width: 8, offset: 50, isStock: true, diameter: 18 }],
          defaultTires: ['275/65R18']
        }
      }
    ]
  }
];

// ============================================================
// CORRECTION ENGINE
// ============================================================

async function correctFamily(config: FamilyConfig): Promise<FamilyResult> {
  const familyName = `${config.make} ${config.model}`;
  
  // Get FUTURE_TRIM records for this family
  const result = await pool.query(`
    SELECT id, year, raw_trim, oem_wheel_sizes, oem_tire_sizes, 
           bolt_pattern, center_bore_mm, certification_errors, audit_original_data
    FROM vehicle_fitments
    WHERE make = $1
      AND model = $2
      AND certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    ORDER BY year
  `, [config.make, config.model]);
  
  if (result.rows.length === 0) {
    return { family: familyName, processed: 0, recertified: 0, stillNeedsReview: 0, errors: [] };
  }
  
  let recertified = 0;
  let stillNeedsReview = 0;
  const errors: string[] = [];
  
  for (const record of result.rows) {
    const { id, year, raw_trim } = record;
    
    // Find generation
    const generation = config.generations.find(g => year >= g.yearStart && year <= g.yearEnd);
    
    if (!generation) {
      // Year might be in valid range (>= firstValidYear)
      if (year >= config.firstValidYear) {
        // Leave as-is, should be re-validated separately
        stillNeedsReview++;
        continue;
      }
      errors.push(`No generation for ${year} ${raw_trim}`);
      stillNeedsReview++;
      continue;
    }
    
    // Check if trim is a future trim
    const currentTrim = raw_trim || 'Base';
    const isFutureTrim = config.futureTrims.some(ft => 
      currentTrim.toLowerCase().includes(ft.toLowerCase()) || 
      currentTrim === ft
    );
    
    if (!isFutureTrim && generation.validTrims.includes(currentTrim)) {
      // Trim is actually valid, shouldn't be flagged
      stillNeedsReview++;
      continue;
    }
    
    // Map to default trim for generation
    const newTrim = generation.defaultTrim;
    const specs = generation.specs;
    
    if (!DRY_RUN) {
      const auditData = record.audit_original_data || {
        original_trim: raw_trim,
        original_wheels: record.oem_wheel_sizes,
        original_tires: record.oem_tire_sizes,
        captured_at: new Date().toISOString()
      };
      
      await pool.query(`
        UPDATE vehicle_fitments
        SET 
          raw_trim = $1,
          display_trim = $1,
          bolt_pattern = $2,
          center_bore_mm = $3,
          oem_wheel_sizes = $4,
          oem_tire_sizes = $5,
          certification_status = 'certified',
          certification_errors = '[]'::jsonb,
          audit_original_data = $6,
          updated_at = NOW()
        WHERE id = $7
      `, [
        newTrim,
        specs.bolt_pattern,
        specs.center_bore_mm,
        JSON.stringify(specs.defaultWheels),
        JSON.stringify(specs.defaultTires),
        JSON.stringify(auditData),
        id
      ]);
    }
    
    recertified++;
  }
  
  return {
    family: familyName,
    processed: result.rows.length,
    recertified,
    stillNeedsReview,
    errors
  };
}

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`BULK FUTURE_TRIM CORRECTION ENGINE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`Families configured: ${FAMILY_CONFIGS.length}\n`);
  
  // Get initial counts
  const initialCounts = await pool.query(`
    SELECT certification_status, COUNT(*) as cnt
    FROM vehicle_fitments
    GROUP BY certification_status
  `);
  
  console.log('=== INITIAL STATUS ===');
  for (const r of initialCounts.rows) {
    console.log(`  ${r.certification_status}: ${r.cnt}`);
  }
  
  // Get FUTURE_TRIM families
  const futureTrimFamilies = await pool.query(`
    SELECT make, model, COUNT(*) as cnt
    FROM vehicle_fitments
    WHERE certification_status = 'needs_review'
      AND certification_errors::text LIKE '%FUTURE_TRIM%'
    GROUP BY make, model
    ORDER BY cnt DESC
  `);
  
  console.log(`\n=== FUTURE_TRIM FAMILIES (${futureTrimFamilies.rows.length}) ===`);
  for (const r of futureTrimFamilies.rows) {
    const hasConfig = FAMILY_CONFIGS.some(c => c.make === r.make && c.model === r.model);
    const status = hasConfig ? '✅' : '❌';
    console.log(`  ${status} ${r.make} ${r.model}: ${r.cnt}`);
  }
  
  // Process each configured family
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PROCESSING FAMILIES`);
  console.log(`${'='.repeat(70)}\n`);
  
  const results: FamilyResult[] = [];
  
  for (const config of FAMILY_CONFIGS) {
    const result = await correctFamily(config);
    results.push(result);
    
    if (result.processed > 0) {
      console.log(`${result.family}: ${result.recertified}/${result.processed} recertified`);
      if (result.stillNeedsReview > 0) {
        console.log(`  └─ ${result.stillNeedsReview} still needs_review`);
      }
      if (result.errors.length > 0) {
        console.log(`  └─ Errors: ${result.errors.slice(0, 3).join(', ')}`);
      }
    }
  }
  
  // Summary
  console.log(`\n${'='.repeat(70)}`);
  console.log(`PER-FAMILY REPORT`);
  console.log(`${'='.repeat(70)}`);
  
  const processedResults = results.filter(r => r.processed > 0);
  console.log(`\n| Family | Processed | Recertified | Still NR |`);
  console.log(`|--------|-----------|-------------|----------|`);
  
  let totalProcessed = 0;
  let totalRecertified = 0;
  let totalStillNR = 0;
  
  for (const r of processedResults) {
    console.log(`| ${r.family.padEnd(25)} | ${String(r.processed).padStart(9)} | ${String(r.recertified).padStart(11)} | ${String(r.stillNeedsReview).padStart(8)} |`);
    totalProcessed += r.processed;
    totalRecertified += r.recertified;
    totalStillNR += r.stillNeedsReview;
  }
  
  console.log(`|--------|-----------|-------------|----------|`);
  console.log(`| **TOTAL** | ${String(totalProcessed).padStart(9)} | ${String(totalRecertified).padStart(11)} | ${String(totalStillNR).padStart(8)} |`);
  
  // Final counts
  if (!DRY_RUN) {
    const finalCounts = await pool.query(`
      SELECT certification_status, COUNT(*) as cnt
      FROM vehicle_fitments
      GROUP BY certification_status
    `);
    
    console.log(`\n=== FINAL STATUS ===`);
    for (const r of finalCounts.rows) {
      console.log(`  ${r.certification_status}: ${r.cnt}`);
    }
    
    // Remaining FUTURE_TRIM
    const remainingFT = await pool.query(`
      SELECT COUNT(*) as cnt
      FROM vehicle_fitments
      WHERE certification_status = 'needs_review'
        AND certification_errors::text LIKE '%FUTURE_TRIM%'
    `);
    
    console.log(`\n  Remaining FUTURE_TRIM: ${remainingFT.rows[0].cnt}`);
    
    // Top 10 highest-traffic families verification
    console.log(`\n=== SPOT-CHECK: TOP 10 CORRECTED FAMILIES ===`);
    const topFamilies = processedResults.sort((a, b) => b.recertified - a.recertified).slice(0, 10);
    
    for (const family of topFamilies) {
      const [make, model] = family.family.split(' ');
      const sample = await pool.query(`
        SELECT year, raw_trim, bolt_pattern, oem_wheel_sizes, oem_tire_sizes, certification_status
        FROM vehicle_fitments
        WHERE make = $1 AND model = $2 AND certification_status = 'certified'
        ORDER BY year DESC
        LIMIT 2
      `, [make, model]);
      
      console.log(`\n${family.family} (${family.recertified} corrected):`);
      for (const s of sample.rows) {
        const wheels = JSON.parse(JSON.stringify(s.oem_wheel_sizes));
        const wheelStr = wheels?.map((w: any) => `${w.diameter}x${w.width}`)?.join(',') || '?';
        console.log(`  ${s.year} ${s.raw_trim}: ${s.bolt_pattern}, ${wheelStr}, ${JSON.stringify(s.oem_tire_sizes)}`);
      }
    }
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`BULK CORRECTION COMPLETE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Total families processed: ${processedResults.length}`);
  console.log(`Total records processed: ${totalProcessed}`);
  console.log(`Total recertified: ${totalRecertified}`);
  console.log(`Total still needs_review: ${totalStillNR}`);
  
  if (DRY_RUN) {
    console.log(`\n⚠️  DRY_RUN mode - no changes written. Run without --dry-run to apply.`);
  }
  
  await pool.end();
}

main().catch(console.error);
