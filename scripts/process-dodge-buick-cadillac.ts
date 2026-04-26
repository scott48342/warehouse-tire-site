/**
 * Process Dodge, Buick, and Cadillac incomplete records
 * Based on AI Overview research for OEM wheel and tire specs
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

interface TrimFitment {
  trims: string[];
  yearStart: number;
  yearEnd: number;
  wheelDiameter: number;
  wheelWidth: number;
  tireSize: string;
  rearWheelDiameter?: number;
  rearWheelWidth?: number;
  rearTireSize?: string;
}

interface ModelConfig {
  make: string;
  models: string[];
  boltPattern: string;
  centerBore: number;
  fitments: TrimFitment[];
}

// ============== DODGE MODELS ==============

const dodgeViper: ModelConfig = {
  make: 'Dodge',
  models: ['Viper'],
  boltPattern: '6x114.3',
  centerBore: 71.5,
  fitments: [
    // Gen V (2013-2017) - Standard
    { trims: ['SRT', 'GTS', 'GTC', 'Base'], yearStart: 2013, yearEnd: 2017, 
      wheelDiameter: 18, wheelWidth: 10.5, tireSize: '295/30ZR18',
      rearWheelDiameter: 19, rearWheelWidth: 13, rearTireSize: '355/30ZR19' },
    // Gen V ACR
    { trims: ['ACR'], yearStart: 2016, yearEnd: 2017,
      wheelDiameter: 19, wheelWidth: 11, tireSize: '295/25ZR19',
      rearWheelDiameter: 19, rearWheelWidth: 13, rearTireSize: '355/30ZR19' },
    // Gen III/IV (2003-2010)
    { trims: ['SRT-10', 'SRT', 'Base', 'Coupe', 'Roadster'], yearStart: 2003, yearEnd: 2010,
      wheelDiameter: 18, wheelWidth: 10, tireSize: '275/35R18',
      rearWheelDiameter: 19, rearWheelWidth: 13, rearTireSize: '345/30R19' },
    // Gen I/II (1992-2002)
    { trims: ['RT/10', 'GTS', 'ACR', 'Base'], yearStart: 1992, yearEnd: 2002,
      wheelDiameter: 17, wheelWidth: 10, tireSize: '275/40R17',
      rearWheelDiameter: 17, rearWheelWidth: 13, rearTireSize: '335/35R17' },
  ]
};

const dodgeDart: ModelConfig = {
  make: 'Dodge',
  models: ['Dart', 'dart'],
  boltPattern: '5x110',
  centerBore: 65.1,
  fitments: [
    { trims: ['SE', 'Base', 'Aero'], yearStart: 2013, yearEnd: 2016, wheelDiameter: 16, wheelWidth: 7, tireSize: '205/55R16' },
    { trims: ['SXT', 'Rallye', 'Limited'], yearStart: 2013, yearEnd: 2016, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/45R17' },
    { trims: ['GT'], yearStart: 2013, yearEnd: 2016, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/40R18' },
    // Classic Dart (1960s-70s)
    { trims: ['Base', 'GT', 'GTS', 'Swinger', '340', '360'], yearStart: 1960, yearEnd: 1976, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'E70-14' },
  ]
};

const dodgeJourney: ModelConfig = {
  make: 'Dodge',
  models: ['Journey'],
  boltPattern: '5x127',
  centerBore: 71.5,
  fitments: [
    { trims: ['SE', 'AVP', 'SE Value', 'Base'], yearStart: 2009, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 6.5, tireSize: '225/65R17' },
    { trims: ['SXT', 'Crossroad', 'GT', 'R/T', 'Crew'], yearStart: 2009, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 7, tireSize: '225/55R19' },
  ]
};

const dodgeCharger: ModelConfig = {
  make: 'Dodge',
  models: ['Charger', 'charger'],
  boltPattern: '5x115',
  centerBore: 71.6,
  fitments: [
    // Modern (2011-2024)
    { trims: ['SE', 'SXT', 'Base'], yearStart: 2011, yearEnd: 2024, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/65R17' },
    { trims: ['SXT Plus', 'SXT AWD'], yearStart: 2011, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/55R18' },
    { trims: ['GT', 'GT AWD', 'R/T'], yearStart: 2011, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20' },
    { trims: ['Scat Pack', 'R/T Scat Pack'], yearStart: 2015, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/40R20' },
    { trims: ['Scat Pack Widebody', 'Hellcat', 'Hellcat Widebody', 'Redeye', 'SRT', 'SRT Hellcat', 'Jailbreak'], yearStart: 2015, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 11, tireSize: '305/35R20' },
    // 2006-2010
    { trims: ['SE', 'SXT', 'Base'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7, tireSize: '215/65R17' },
    { trims: ['R/T', 'Daytona R/T'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '225/55R18' },
    { trims: ['SRT8', 'SRT-8'], yearStart: 2006, yearEnd: 2010, wheelDiameter: 20, wheelWidth: 9, tireSize: '245/45R20' },
    // Classic (1966-1987)
    { trims: ['Base', 'R/T', '500', 'SE', 'Daytona', 'Super Bee'], yearStart: 1966, yearEnd: 1978, wheelDiameter: 14, wheelWidth: 6, tireSize: 'F70-14' },
    { trims: ['Base', 'SE', 'Shelby'], yearStart: 1982, yearEnd: 1987, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'P195/70R14' },
  ]
};

const dodgeChallenger: ModelConfig = {
  make: 'Dodge',
  models: ['Challenger', 'challenger'],
  boltPattern: '5x115',
  centerBore: 71.6,
  fitments: [
    // 2008-2024
    { trims: ['SXT', 'SE', 'Base'], yearStart: 2008, yearEnd: 2024, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/55R18' },
    { trims: ['SXT Plus', 'GT', 'GT AWD'], yearStart: 2008, yearEnd: 2024, wheelDiameter: 19, wheelWidth: 7.5, tireSize: '235/55R19' },
    { trims: ['R/T', 'T/A'], yearStart: 2008, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 8, tireSize: '245/45R20' },
    { trims: ['R/T Scat Pack', 'Scat Pack', 'T/A 392'], yearStart: 2015, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 9, tireSize: '275/40ZR20' },
    { trims: ['Scat Pack Widebody', 'Hellcat', 'Hellcat Widebody', 'Redeye', 'SRT Hellcat', 'SRT', 'Jailbreak', 'Demon', 'Super Stock'], yearStart: 2015, yearEnd: 2024, wheelDiameter: 20, wheelWidth: 11, tireSize: '305/35ZR20' },
    // Classic (1970-1974)
    { trims: ['Base', 'R/T', 'T/A', 'Deputy'], yearStart: 1970, yearEnd: 1974, wheelDiameter: 14, wheelWidth: 6, tireSize: 'E70-14' },
  ]
};

const dodgeCaravan: ModelConfig = {
  make: 'Dodge',
  models: ['Caravan', 'Grand Caravan'],
  boltPattern: '5x127',
  centerBore: 71.5,
  fitments: [
    // 5th Gen (2008-2020)
    { trims: ['SE', 'SXT', 'AVP', 'Base', 'Crew', 'GT', 'R/T'], yearStart: 2008, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 6.5, tireSize: '225/65R17' },
    // 4th Gen (2001-2007)
    { trims: ['SE', 'SXT', 'Base', 'ES', 'Sport'], yearStart: 2001, yearEnd: 2007, wheelDiameter: 16, wheelWidth: 6.5, tireSize: '215/65R16' },
    // Earlier (1984-2000)
    { trims: ['Base', 'SE', 'LE', 'ES', 'Sport'], yearStart: 1984, yearEnd: 2000, wheelDiameter: 15, wheelWidth: 6, tireSize: '205/70R15' },
  ]
};

const dodgeDakota: ModelConfig = {
  make: 'Dodge',
  models: ['Dakota'],
  boltPattern: '5x139.7',
  centerBore: 77.8,
  fitments: [
    { trims: ['ST', 'SXT', 'SLT', 'Laramie', 'Sport', 'R/T', 'Base'], yearStart: 2005, yearEnd: 2011, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '245/65R17' },
    { trims: ['Base', 'Sport', 'SLT', 'SLT Plus'], yearStart: 1997, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 7, tireSize: '235/70R16' },
    { trims: ['Base', 'LE', 'SE', 'Sport'], yearStart: 1987, yearEnd: 1996, wheelDiameter: 15, wheelWidth: 6, tireSize: '215/75R15' },
  ]
};

const dodgeDiplomat: ModelConfig = {
  make: 'Dodge',
  models: ['Diplomat'],
  boltPattern: '5x114.3',
  centerBore: 71.5,
  fitments: [
    { trims: ['Base', 'Salon', 'SE', 'Medallion'], yearStart: 1977, yearEnd: 1989, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/75R15' },
  ]
};

const dodgeRamcharger: ModelConfig = {
  make: 'Dodge',
  models: ['Ramcharger'],
  boltPattern: '5x139.7',
  centerBore: 108,
  fitments: [
    { trims: ['Base', 'SE', 'LE', 'AW150', 'AD150', 'Royal SE', 'Prospector'], yearStart: 1974, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 8, tireSize: 'P235/75R15' },
  ]
};

const dodgeOmni: ModelConfig = {
  make: 'Dodge',
  models: ['Omni'],
  boltPattern: '4x100',
  centerBore: 57.1,
  fitments: [
    { trims: ['Base', 'GLH', 'GLHS', '024', 'Charger'], yearStart: 1978, yearEnd: 1990, wheelDiameter: 13, wheelWidth: 5, tireSize: 'P175/70R13' },
  ]
};

const dodgeAries: ModelConfig = {
  make: 'Dodge',
  models: ['Aries'],
  boltPattern: '4x100',
  centerBore: 57.1,
  fitments: [
    { trims: ['Base', 'SE', 'LE', 'K', 'Custom'], yearStart: 1981, yearEnd: 1989, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'P185/70R14' },
  ]
};

const dodgeDaytona: ModelConfig = {
  make: 'Dodge',
  models: ['Daytona'],
  boltPattern: '5x100',
  centerBore: 57.1,
  fitments: [
    { trims: ['Base', 'Turbo', 'Turbo Z', 'Shelby Z', 'Shelby', 'IROC', 'ES'], yearStart: 1984, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/60R15' },
  ]
};

const dodgeCoronet: ModelConfig = {
  make: 'Dodge',
  models: ['Coronet'],
  boltPattern: '5x114.3',
  centerBore: 71.5,
  fitments: [
    { trims: ['Base', '440', '500', 'R/T', 'Super Bee', 'Deluxe'], yearStart: 1965, yearEnd: 1976, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'F70-14' },
  ]
};

const dodgeSuperBee: ModelConfig = {
  make: 'Dodge',
  models: ['Super Bee'],
  boltPattern: '5x114.3',
  centerBore: 71.5,
  fitments: [
    { trims: ['Base', '440', '440 Six Pack', 'Hemi'], yearStart: 1968, yearEnd: 1971, wheelDiameter: 14, wheelWidth: 6, tireSize: 'F70-14' },
  ]
};

const dodgeDemon: ModelConfig = {
  make: 'Dodge',
  models: ['Demon'],
  boltPattern: '5x115',
  centerBore: 71.6,
  fitments: [
    // Modern Demon (Challenger-based)
    { trims: ['SRT Demon', 'SRT Demon 170'], yearStart: 2018, yearEnd: 2023, wheelDiameter: 18, wheelWidth: 11, tireSize: '315/40R18' },
    // Classic Demon (1971-72)
    { trims: ['Base', '340', 'Sizzler'], yearStart: 1971, yearEnd: 1972, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'E70-14' },
  ]
};

const dodgeRam: ModelConfig = {
  make: 'Dodge',
  models: ['Ram'],
  boltPattern: '5x139.7',
  centerBore: 77.8,
  fitments: [
    { trims: ['1500', 'ST', 'SLT', 'Laramie', 'Sport', 'R/T', 'Express', 'Tradesman', 'Big Horn'], yearStart: 2002, yearEnd: 2010, wheelDiameter: 17, wheelWidth: 7, tireSize: 'P265/70R17' },
  ]
};

// ============== BUICK MODELS ==============

const buickRegal: ModelConfig = {
  make: 'Buick',
  models: ['Regal', 'regal'],
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    // Gen VI (2018-2020) Sportback
    { trims: ['Base', 'Preferred'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 17, wheelWidth: 7.5, tireSize: '225/55R17' },
    { trims: ['Essence'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18' },
    { trims: ['Avenir'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
    { trims: ['GS'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
    { trims: ['TourX', 'Sportback TourX'], yearStart: 2018, yearEnd: 2020, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' },
    // Gen V (2011-2017)
    { trims: ['Base', 'Premium'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/50R18' },
    { trims: ['GS'], yearStart: 2011, yearEnd: 2017, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
    // Classic (1973-2004)
    { trims: ['Base', 'Custom', 'Limited', 'Gran Sport', 'GS', 'T-Type', 'Grand National'], yearStart: 1973, yearEnd: 2004, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    // Earlier classic
    { trims: ['Base', 'Custom', 'Grand Sport'], yearStart: 1964, yearEnd: 1972, wheelDiameter: 14, wheelWidth: 6, tireSize: 'G70-14' },
  ]
};

const buickRiviera: ModelConfig = {
  make: 'Buick',
  models: ['Riviera'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Silver Arrow', 'Supercharged'], yearStart: 1995, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['Base', 'Luxury', 'T-Type'], yearStart: 1986, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    { trims: ['Base', 'Custom', 'GS'], yearStart: 1963, yearEnd: 1985, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/75R15' },
  ]
};

const buickLeSabre: ModelConfig = {
  make: 'Buick',
  models: ['LeSabre', 'lesabre'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Custom', 'Base'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/70R15' },
    { trims: ['Limited', 'Gran Touring'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 6.5, tireSize: 'P225/60R16' },
    { trims: ['Base', 'Custom', 'Limited'], yearStart: 1992, yearEnd: 1999, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    { trims: ['Base', 'Custom', 'Limited', 'Estate'], yearStart: 1977, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/75R15' },
  ]
};

const buickCentury: ModelConfig = {
  make: 'Buick',
  models: ['Century'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Custom', 'Limited', 'Base'], yearStart: 1997, yearEnd: 2005, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    { trims: ['Custom', 'Limited', 'Special'], yearStart: 1982, yearEnd: 1996, wheelDiameter: 14, wheelWidth: 6, tireSize: 'P195/75R14' },
  ]
};

const buickSkylark: ModelConfig = {
  make: 'Buick',
  models: ['Skylark'],
  boltPattern: '5x100',
  centerBore: 57.1,
  fitments: [
    { trims: ['Base', 'Custom', 'Limited', 'Gran Sport'], yearStart: 1992, yearEnd: 1998, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P195/65R15' },
    { trims: ['Base', 'Custom', 'Limited', 'T-Type'], yearStart: 1980, yearEnd: 1991, wheelDiameter: 14, wheelWidth: 5.5, tireSize: 'P185/75R14' },
    { trims: ['Base', 'Custom', 'GS', 'GSX', 'Gran Sport'], yearStart: 1964, yearEnd: 1972, wheelDiameter: 14, wheelWidth: 6, tireSize: 'G70-14' },
  ]
};

const buickGS: ModelConfig = {
  make: 'Buick',
  models: ['GS', 'Gran Sport'],
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['400', '455', 'Stage 1', 'Base', 'GSX'], yearStart: 1965, yearEnd: 1975, wheelDiameter: 14, wheelWidth: 6, tireSize: 'G70-14' },
  ]
};

const buickGrandNational: ModelConfig = {
  make: 'Buick',
  models: ['Grand National'],
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'T-Type', 'GNX'], yearStart: 1982, yearEnd: 1987, wheelDiameter: 15, wheelWidth: 7, tireSize: 'P215/65R15' },
  ]
};

const buickEnvision: ModelConfig = {
  make: 'Buick',
  models: ['Envision', 'envision'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Preferred', 'Base'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 18, wheelWidth: 7.5, tireSize: '235/55R18' },
    { trims: ['Essence', 'Premium', 'Avenir'], yearStart: 2016, yearEnd: 2025, wheelDiameter: 19, wheelWidth: 8, tireSize: '235/50R19' },
  ]
};

const buickEncore: ModelConfig = {
  make: 'Buick',
  models: ['Encore', 'encore'],
  boltPattern: '5x105',
  centerBore: 56.6,
  fitments: [
    { trims: ['Base', 'Preferred', 'Sport Touring', 'Essence', 'Premium'], yearStart: 2013, yearEnd: 2022, wheelDiameter: 18, wheelWidth: 7, tireSize: '215/55R18' },
  ]
};

const buickLacrosse: ModelConfig = {
  make: 'Buick',
  models: ['LaCrosse', 'lacrosse'],
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    { trims: ['Base', 'Preferred', 'Essence'], yearStart: 2017, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18' },
    { trims: ['Avenir'], yearStart: 2017, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 8, tireSize: '245/40R19' },
    { trims: ['Base', 'CXL', 'CXS', 'Premium'], yearStart: 2010, yearEnd: 2016, wheelDiameter: 17, wheelWidth: 7, tireSize: '235/55R17' },
    { trims: ['Touring', 'eAssist'], yearStart: 2010, yearEnd: 2016, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18' },
    { trims: ['Base', 'CX', 'CXL', 'CXS'], yearStart: 2005, yearEnd: 2009, wheelDiameter: 16, wheelWidth: 6.5, tireSize: 'P225/60R16' },
  ]
};

const buickGSX: ModelConfig = {
  make: 'Buick',
  models: ['GSX'],
  boltPattern: '5x120.65',
  centerBore: 70.3,
  fitments: [
    { trims: ['455', 'Stage 1', 'Base'], yearStart: 1970, yearEnd: 1972, wheelDiameter: 14, wheelWidth: 7, tireSize: 'G60-15' },
  ]
};

// ============== CADILLAC MODELS ==============

const cadillacEldorado: ModelConfig = {
  make: 'Cadillac',
  models: ['Eldorado'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'ETC', 'ESC', 'Touring'], yearStart: 1992, yearEnd: 2002, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['Base', 'Biarritz', 'Touring'], yearStart: 1986, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    { trims: ['Base', 'Biarritz', 'Custom'], yearStart: 1967, yearEnd: 1985, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P215/75R15' },
    { trims: ['Base', 'Biarritz', 'Seville', 'Convertible'], yearStart: 1953, yearEnd: 1966, wheelDiameter: 15, wheelWidth: 6, tireSize: '8.00-15' },
  ]
};

const cadillacFleetwood: ModelConfig = {
  make: 'Cadillac',
  models: ['Fleetwood'],
  boltPattern: '5x127',
  centerBore: 77.8,
  fitments: [
    { trims: ['Base', 'Brougham'], yearStart: 1993, yearEnd: 1996, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P235/60R16' },
    { trims: ['Base', 'Brougham', 'Limousine', 'd\'Elegance'], yearStart: 1977, yearEnd: 1992, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P225/75R15' },
    { trims: ['Base', 'Brougham', 'Sixty Special'], yearStart: 1959, yearEnd: 1976, wheelDiameter: 15, wheelWidth: 6, tireSize: '8.20-15' },
    { trims: ['Base', 'Sixty Special', 'Series 60'], yearStart: 1948, yearEnd: 1958, wheelDiameter: 15, wheelWidth: 6, tireSize: '8.00-15' },
  ]
};

const cadillacDeVille: ModelConfig = {
  make: 'Cadillac',
  models: ['DeVille'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'DTS', 'DHS'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['DTS Performance'], yearStart: 2000, yearEnd: 2005, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'P235/55R17' },
    { trims: ['Base', 'd\'Elegance', 'Concours'], yearStart: 1994, yearEnd: 1999, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['Base', 'd\'Elegance', 'Touring'], yearStart: 1985, yearEnd: 1993, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
    { trims: ['Base', 'Sedan', 'Coupe'], yearStart: 1965, yearEnd: 1984, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P225/75R15' },
    { trims: ['Base', 'Coupe', 'Sedan', 'Convertible', 'Series 62'], yearStart: 1949, yearEnd: 1964, wheelDiameter: 15, wheelWidth: 6, tireSize: '8.00-15' },
  ]
};

const cadillacCT4: ModelConfig = {
  make: 'Cadillac',
  models: ['CT4', 'ct4'],
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    { trims: ['Luxury', 'Base'], yearStart: 2020, yearEnd: 2025, wheelDiameter: 17, wheelWidth: 8, tireSize: '225/45R17' },
    { trims: ['Premium Luxury', 'Sport'], yearStart: 2020, yearEnd: 2025, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/40R18' },
    { trims: ['V', 'CT4-V'], yearStart: 2020, yearEnd: 2025, wheelDiameter: 18, wheelWidth: 8, tireSize: '235/40R18' },
    { trims: ['V-Blackwing', 'CT4-V Blackwing', 'Blackwing'], yearStart: 2022, yearEnd: 2025,
      wheelDiameter: 18, wheelWidth: 9, tireSize: '255/35ZR18',
      rearWheelDiameter: 18, rearWheelWidth: 9.5, rearTireSize: '275/35ZR18' },
  ]
};

const cadillacSeville: ModelConfig = {
  make: 'Cadillac',
  models: ['Seville'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['SLS', 'STS', 'Base'], yearStart: 1998, yearEnd: 2004, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['STS Performance'], yearStart: 1998, yearEnd: 2004, wheelDiameter: 17, wheelWidth: 7.5, tireSize: 'P235/55R17' },
    { trims: ['SLS', 'STS', 'Touring'], yearStart: 1992, yearEnd: 1997, wheelDiameter: 16, wheelWidth: 7, tireSize: 'P225/60R16' },
    { trims: ['Base', 'Elegante'], yearStart: 1980, yearEnd: 1991, wheelDiameter: 15, wheelWidth: 6, tireSize: 'P205/70R15' },
  ]
};

const cadillacATS: ModelConfig = {
  make: 'Cadillac',
  models: ['ATS', 'ats'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Luxury', 'Standard'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 17, wheelWidth: 8, tireSize: '225/45R17' },
    { trims: ['Performance', 'Premium', 'Premium Luxury'], yearStart: 2013, yearEnd: 2019,
      wheelDiameter: 18, wheelWidth: 8, tireSize: '225/40R18',
      rearWheelDiameter: 18, rearWheelWidth: 9, rearTireSize: '255/35R18' },
    { trims: ['Coupe'], yearStart: 2015, yearEnd: 2019,
      wheelDiameter: 18, wheelWidth: 8, tireSize: '225/40R18',
      rearWheelDiameter: 18, rearWheelWidth: 9, rearTireSize: '255/35R18' },
  ]
};

const cadillacATSV: ModelConfig = {
  make: 'Cadillac',
  models: ['ATS-V', 'ats-v'],
  boltPattern: '5x115',
  centerBore: 70.3,
  fitments: [
    { trims: ['Base', 'Coupe', 'Sedan'], yearStart: 2016, yearEnd: 2019,
      wheelDiameter: 18, wheelWidth: 9, tireSize: '255/35R18',
      rearWheelDiameter: 18, rearWheelWidth: 9.5, rearTireSize: '275/35R18' },
  ]
};

const cadillacCelestiq: ModelConfig = {
  make: 'Cadillac',
  models: ['Celestiq', 'celestiq'],
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    { trims: ['Base'], yearStart: 2024, yearEnd: 2026, wheelDiameter: 23, wheelWidth: 9.5, tireSize: '275/35R23' },
  ]
};

const cadillacXTS: ModelConfig = {
  make: 'Cadillac',
  models: ['XTS', 'xts'],
  boltPattern: '5x120',
  centerBore: 67.1,
  fitments: [
    { trims: ['Luxury', 'Base', 'Standard'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 18, wheelWidth: 8, tireSize: '245/45R18' },
    { trims: ['Premium', 'Platinum', 'V-Sport'], yearStart: 2013, yearEnd: 2019, wheelDiameter: 19, wheelWidth: 8.5, tireSize: '245/40R19' },
    { trims: ['Vsport', 'V-Sport'], yearStart: 2014, yearEnd: 2019, wheelDiameter: 20, wheelWidth: 8.5, tireSize: '245/40R20' },
  ]
};

// All configurations
const allConfigs: ModelConfig[] = [
  // Dodge
  dodgeViper, dodgeDart, dodgeJourney, dodgeCharger, dodgeChallenger,
  dodgeCaravan, dodgeDakota, dodgeDiplomat, dodgeRamcharger, dodgeOmni,
  dodgeAries, dodgeDaytona, dodgeCoronet, dodgeSuperBee, dodgeDemon, dodgeRam,
  // Buick
  buickRegal, buickRiviera, buickLeSabre, buickCentury, buickSkylark,
  buickGS, buickGrandNational, buickEnvision, buickEncore, buickLacrosse, buickGSX,
  // Cadillac
  cadillacEldorado, cadillacFleetwood, cadillacDeVille, cadillacCT4,
  cadillacSeville, cadillacATS, cadillacATSV, cadillacCelestiq, cadillacXTS,
];

function normalizeTrim(trim: string): string {
  return trim.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function findConfig(make: string, model: string): ModelConfig | null {
  const normalizedMake = make.toLowerCase();
  const normalizedModel = model.toLowerCase();
  
  for (const config of allConfigs) {
    if (config.make.toLowerCase() !== normalizedMake) continue;
    if (config.models.some(m => m.toLowerCase() === normalizedModel)) {
      return config;
    }
    // Partial match
    if (config.models.some(m => normalizedModel.includes(m.toLowerCase()) || m.toLowerCase().includes(normalizedModel))) {
      return config;
    }
  }
  return null;
}

function matchTrimToFitment(config: ModelConfig, year: number, displayTrim: string): TrimFitment | null {
  const normalized = normalizeTrim(displayTrim);
  const yearMatches = config.fitments.filter(tf => year >= tf.yearStart && year <= tf.yearEnd);
  if (yearMatches.length === 0) return null;

  // Exact match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      if (normalizeTrim(trim) === normalized) return tf;
    }
  }
  // Contains match
  for (const tf of yearMatches) {
    for (const trim of tf.trims) {
      const nt = normalizeTrim(trim);
      if (normalized.includes(nt) || nt.includes(normalized)) return tf;
    }
  }
  // Keyword matches (specific trims)
  const trimKeywords: { [key: string]: string[] } = {
    'hellcat': ['Hellcat', 'SRT Hellcat', 'Hellcat Widebody', 'Redeye'],
    'scat pack': ['Scat Pack', 'R/T Scat Pack'],
    'widebody': ['Widebody', 'Scat Pack Widebody', 'Hellcat Widebody'],
    'blackwing': ['V-Blackwing', 'Blackwing', 'CT4-V Blackwing'],
    'ats-v': ['ATS-V', 'V'],
    'ct4-v': ['CT4-V', 'V'],
    'gt': ['GT'],
    'rt': ['R/T'],
    'sxt': ['SXT'],
    'se': ['SE', 'Base'],
    'limited': ['Limited'],
    'gs': ['GS', 'Gran Sport'],
    'avenir': ['Avenir'],
    'dts': ['DTS', 'DTS Performance'],
    'sts': ['STS', 'STS Performance'],
    'acr': ['ACR'],
  };
  
  for (const [keyword, trims] of Object.entries(trimKeywords)) {
    if (normalized.includes(keyword)) {
      for (const trim of trims) {
        const match = yearMatches.find(tf => tf.trims.some(t => normalizeTrim(t) === normalizeTrim(trim)));
        if (match) return match;
      }
    }
  }
  
  // Fallback to base/first entry
  return yearMatches.find(tf => tf.trims.some(t => ['Base', 'Base', 'SE', 'SXT', 'Custom', 'Standard', 'Luxury'].includes(t))) || yearMatches[0];
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLYING CHANGES'}`);
  
  const records = await pool.query(`
    SELECT id, year, make, model, display_trim
    FROM vehicle_fitments
    WHERE make IN ('Dodge', 'Buick', 'Cadillac')
    AND (quality_tier IS NULL OR quality_tier != 'complete')
    ORDER BY make, model, year, display_trim
  `);
  
  console.log(`Found ${records.rows.length} incomplete records`);
  
  let updated = 0, skipped = 0;
  const flagged: string[] = [];
  const byMake: { [key: string]: number } = {};
  
  for (const record of records.rows) {
    const config = findConfig(record.make, record.model);
    if (!config) {
      flagged.push(`${record.year} ${record.make} ${record.model} - No config`);
      skipped++;
      continue;
    }
    
    const matchedFitment = matchTrimToFitment(config, record.year, record.display_trim || 'Base');
    if (!matchedFitment) {
      flagged.push(`${record.year} ${record.make} ${record.model} ${record.display_trim} - No fitment`);
      skipped++;
      continue;
    }
    
    const isStaggered = matchedFitment.rearWheelDiameter != null;
    const oemWheelSizes = isStaggered ? [
      { diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'front', isStock: true },
      { diameter: matchedFitment.rearWheelDiameter, width: matchedFitment.rearWheelWidth, offset: null, axle: 'rear', isStock: true }
    ] : [
      { diameter: matchedFitment.wheelDiameter, width: matchedFitment.wheelWidth, offset: null, axle: 'square', isStock: true }
    ];
    
    const oemTireSizes = isStaggered 
      ? [matchedFitment.tireSize, matchedFitment.rearTireSize]
      : [matchedFitment.tireSize];
    
    if (dryRun) {
      console.log(`  [DRY] ${record.year} ${record.make} ${record.model} ${record.display_trim || ''} → ${matchedFitment.wheelDiameter}"${isStaggered ? '/' + matchedFitment.rearWheelDiameter + '"' : ''}, ${matchedFitment.tireSize}`);
    } else {
      await pool.query(`
        UPDATE vehicle_fitments 
        SET oem_wheel_sizes = $1::jsonb, 
            oem_tire_sizes = $2::jsonb, 
            bolt_pattern = $3, 
            center_bore_mm = $4, 
            source = 'trim-research', 
            quality_tier = 'complete', 
            updated_at = NOW() 
        WHERE id = $5`,
        [JSON.stringify(oemWheelSizes), JSON.stringify(oemTireSizes), config.boltPattern, config.centerBore, record.id]
      );
    }
    
    byMake[record.make] = (byMake[record.make] || 0) + 1;
    updated++;
  }
  
  console.log(`\n✓ ${updated} updated, ⚠ ${skipped} skipped (${(updated/(updated+skipped)*100).toFixed(1)}%)`);
  console.log('By make:', byMake);
  if (flagged.length > 0) {
    console.log(`\nFlagged (${flagged.length}):`);
    flagged.slice(0, 15).forEach(f => console.log(`  - ${f}`));
    if (flagged.length > 15) console.log(`  ... and ${flagged.length - 15} more`);
  }
  
  await pool.end();
}

main().catch(console.error);
