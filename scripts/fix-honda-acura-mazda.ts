import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Comprehensive fitment data from Google AI Overviews
// Source: Google search "X OEM wheel and tire sizes by trim"

interface FitmentFix {
  id: string;
  year: number;
  make: string;
  model: string;
  oemWheelSizes: Array<{ width: number; diameter: number; offset?: number; axle?: string }>;
  oemTireSizes: string[];
  boltPattern: string;
  centerBoreMm: number;
  threadSize: string;
  seatType: string;
  offsetMinMm: number;
  offsetMaxMm: number;
}

// ===========================================
// HONDA FITMENTS
// ===========================================

// Honda S2000 AP1 (2000-2003) - 16" staggered
const hondaS2000AP1: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16, offset: 55, axle: 'front' },
    { width: 7.5, diameter: 16, offset: 65, axle: 'rear' }
  ],
  oemTireSizes: ['205/55R16', '225/50R16'],
  boltPattern: '5x114.3',
  centerBoreMm: 70.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 70
};

// Honda S2000 AP2 (2004-2009) - 17" staggered
const hondaS2000AP2: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17, offset: 55, axle: 'front' },
    { width: 8.5, diameter: 17, offset: 65, axle: 'rear' }
  ],
  oemTireSizes: ['215/45R17', '245/40R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 70.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 70
};

// Honda Element (2003-2011)
const hondaElement: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16 },
    { width: 7, diameter: 17 }
  ],
  oemTireSizes: ['215/70R16', '225/65R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 55
};

// Honda Clarity (2019-2021) - PHEV/EV
const hondaClarity: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8, diameter: 18 }
  ],
  oemTireSizes: ['235/45R18'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Honda Crosstour (2011-2013)
const hondaCrosstour: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17 },
    { width: 7.5, diameter: 18 }
  ],
  oemTireSizes: ['225/65R17', '235/60R18'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 55
};

// Honda Insight (2009-2014) - 2nd gen hybrid
const hondaInsight: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 5.5, diameter: 15 },
    { width: 6, diameter: 16 }
  ],
  oemTireSizes: ['175/65R15', '195/55R16'],
  boltPattern: '4x100',
  centerBoreMm: 56.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Honda Passport 2000-2002 (Isuzu-based)
const hondaPassportOld: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 16 }
  ],
  oemTireSizes: ['245/70R16'],
  boltPattern: '6x139.7',
  centerBoreMm: 100.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 25,
  offsetMaxMm: 45
};

// Honda Passport 2023-2026 (Pilot-based)
const hondaPassportNew: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8, diameter: 20 }
  ],
  oemTireSizes: ['265/50R20'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 55
};

// Honda Prelude (2000-2001) - 5th gen final years
const hondaPrelude: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16 }
  ],
  oemTireSizes: ['205/50R16'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 50,
  offsetMaxMm: 60
};

// Honda Prologue (2026) - EV
const hondaPrologue: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8, diameter: 21 }
  ],
  oemTireSizes: ['265/45R21'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 35,
  offsetMaxMm: 50
};

// ===========================================
// ACURA FITMENTS
// ===========================================

// Acura CL Type-S (2001-2003)
const acuraCLTypeS: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17 }
  ],
  oemTireSizes: ['215/50R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 50,
  offsetMaxMm: 60
};

// Acura CL (2001-2003)
const acuraCL: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16 },
    { width: 6.5, diameter: 17 }
  ],
  oemTireSizes: ['205/60R16', '215/50R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 50,
  offsetMaxMm: 60
};

// Acura Integra Type-R (2000-2001) - Final US years
const acuraIntegraTypeR: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6, diameter: 15 },
    { width: 6, diameter: 16 }
  ],
  oemTireSizes: ['195/55R15', '205/50R16'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Acura NSX NA1/NA2 (2000-2005) - First generation final years
const acuraNSXOld: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17, offset: 55, axle: 'front' },
    { width: 9, diameter: 17, offset: 56, axle: 'rear' }
  ],
  oemTireSizes: ['215/40R17', '255/40R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 50,
  offsetMaxMm: 65
};

// Acura NSX NC1 (2016-2020) - Second generation
const acuraNSXNew: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8.5, diameter: 19, offset: 55, axle: 'front' },
    { width: 11, diameter: 20, offset: 55, axle: 'rear' }
  ],
  oemTireSizes: ['245/35R19', '305/30R20'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 60
};

// Acura RL (2000-2010)
const acuraRL: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17 },
    { width: 8, diameter: 18 }
  ],
  oemTireSizes: ['225/55R17', '245/45R18'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Acura RSX (2002-2006)
const acuraRSX: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16 },
    { width: 7, diameter: 17 }
  ],
  oemTireSizes: ['205/55R16', '215/45R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 64.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Acura ZDX (2012-2013) - First gen
const acuraZDXOld: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8.5, diameter: 19 }
  ],
  oemTireSizes: ['255/50R19'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Acura ZDX (2023-2025) - EV
const acuraZDXNew: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8, diameter: 21 },
    { width: 9, diameter: 22 }
  ],
  oemTireSizes: ['265/45R21', '275/40R22'],
  boltPattern: '5x120',
  centerBoreMm: 64.1,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 35,
  offsetMaxMm: 50
};

// ===========================================
// MAZDA FITMENTS
// ===========================================

// Mazda6 Gen1 (2003-2008)
const mazda6Gen1: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16, offset: 55 },
    { width: 7, diameter: 17, offset: 55 }
  ],
  oemTireSizes: ['205/60R16', '215/50R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 60
};

// Mazda6 Gen2 (2009-2013)
const mazda6Gen2: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 17, offset: 55 },
    { width: 7.5, diameter: 18, offset: 50 }
  ],
  oemTireSizes: ['215/55R17', '235/45R18'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 60
};

// Mazda6 Gen3 (2014-2021)
const mazda6Gen3: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7.5, diameter: 17, offset: 50 },
    { width: 7.5, diameter: 19, offset: 45 }
  ],
  oemTireSizes: ['225/55R17', '225/45R19'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 55
};

// Mazda CX-70 (2025-2026)
const mazdaCX70: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 8.5, diameter: 19 },
    { width: 9, diameter: 21 }
  ],
  oemTireSizes: ['255/55R19', '265/45R21'],
  boltPattern: '5x127',
  centerBoreMm: 71.6,
  threadSize: 'M14x1.5',
  seatType: 'conical',
  offsetMinMm: 35,
  offsetMaxMm: 50
};

// Mazda CX-9 (2009-2011) - Gen1 final years
const mazdaCX9: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7.5, diameter: 18 }
  ],
  oemTireSizes: ['245/60R18'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 55
};

// Mazda MX-30 (2024-2025) - EV
const mazdaMX30: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 7, diameter: 18 }
  ],
  oemTireSizes: ['215/55R18'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// Mazda MX-5 NB (2000-2005) - 2nd gen
const mazdaMX5NB: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6, diameter: 14 },
    { width: 6, diameter: 15 }
  ],
  oemTireSizes: ['185/60R14', '195/50R15'],
  boltPattern: '4x100',
  centerBoreMm: 54.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 40,
  offsetMaxMm: 50
};

// Mazda MX-5 NC (2006-2007) - 3rd gen
const mazdaMX5NC: Partial<FitmentFix> = {
  oemWheelSizes: [
    { width: 6.5, diameter: 16 },
    { width: 7, diameter: 17 }
  ],
  oemTireSizes: ['205/50R16', '205/45R17'],
  boltPattern: '5x114.3',
  centerBoreMm: 67.1,
  threadSize: 'M12x1.5',
  seatType: 'conical',
  offsetMinMm: 45,
  offsetMaxMm: 55
};

// ===========================================
// ID MAPPINGS (from database query)
// ===========================================

const fixMappings: Array<{ id: string; year: number; model: string; fitment: Partial<FitmentFix> }> = [
  // Honda S2000 AP1 (2000-2003)
  { id: '292cb2e8-0ce7-4bb9-8124-e24b354376a3', year: 2000, model: 's2000', fitment: hondaS2000AP1 },
  { id: 'fa3c20b6-c5aa-448f-a6d0-0213642cdfad', year: 2001, model: 's2000', fitment: hondaS2000AP1 },
  { id: 'c6b358ae-5427-4c3b-9030-93a4962d79f7', year: 2002, model: 's2000', fitment: hondaS2000AP1 },
  { id: 'ac626103-a31a-45a9-93d4-db386daa7411', year: 2003, model: 's2000', fitment: hondaS2000AP1 },
  // Honda S2000 AP2 (2004-2009)
  { id: '95a4d3d5-b18e-4513-b6ed-f27574950fba', year: 2004, model: 's2000', fitment: hondaS2000AP2 },
  { id: 'bca795c4-cf3b-426e-8282-5edcb8494c9d', year: 2005, model: 's2000', fitment: hondaS2000AP2 },
  { id: '4808fbb4-0349-446e-9d4e-94a6242a2440', year: 2006, model: 's2000', fitment: hondaS2000AP2 },
  { id: 'f4b76925-3a9c-4fb9-b8f4-2450efb2af49', year: 2007, model: 's2000', fitment: hondaS2000AP2 },
  { id: 'c6908aab-9a09-4051-81c8-7dd80add5b3a', year: 2008, model: 's2000', fitment: hondaS2000AP2 },
  { id: '1bf12c0d-3d37-499a-8fe1-fd48e0313eec', year: 2009, model: 's2000', fitment: hondaS2000AP2 },
  
  // Honda Element (2003-2011)
  { id: 'b36588dc-3639-45d5-9912-8bc5dedfda80', year: 2003, model: 'element', fitment: hondaElement },
  { id: 'ae5dfeb3-5fba-433f-82cc-3bf81ebc28ef', year: 2004, model: 'element', fitment: hondaElement },
  { id: '02477d72-f2d0-47f8-ae7a-573cc625093a', year: 2005, model: 'element', fitment: hondaElement },
  { id: '71a03c78-7188-4772-8dd6-5963a78a61ce', year: 2006, model: 'element', fitment: hondaElement },
  { id: 'b1ed2a53-fd2f-44f6-917f-8f0d0f42c34e', year: 2007, model: 'element', fitment: hondaElement },
  { id: '4107ccd3-3399-44fb-86a1-2bd6db380052', year: 2008, model: 'element', fitment: hondaElement },
  { id: '1e6ac5e2-1fff-4522-aa30-cf4e15742ee7', year: 2009, model: 'element', fitment: hondaElement },
  { id: '0caf16ea-2487-4266-a8e7-2ba1ddbb23d3', year: 2010, model: 'element', fitment: hondaElement },
  { id: 'a681120e-13ce-443a-b272-4f0e0fd5f130', year: 2011, model: 'element', fitment: hondaElement },
  
  // Honda Clarity (2019-2021)
  { id: 'c272464b-737d-4686-8bd3-30ac70fd7fc2', year: 2019, model: 'clarity', fitment: hondaClarity },
  { id: 'c17a8d4b-dd1d-4daf-bf13-43b71dbb2525', year: 2020, model: 'clarity', fitment: hondaClarity },
  { id: 'ab40f189-4abf-4981-a2f6-8476652c3cca', year: 2021, model: 'clarity', fitment: hondaClarity },
  
  // Honda Crosstour (2011-2013)
  { id: '5ea8e99c-41bd-4670-a1e4-56eaa1cf22cd', year: 2011, model: 'crosstour', fitment: hondaCrosstour },
  { id: 'dbc5e389-4ea7-46af-a93d-cc8304bfb5cd', year: 2012, model: 'crosstour', fitment: hondaCrosstour },
  { id: 'a77d0887-d08f-4e0f-a5a6-0f4b0b010b2b', year: 2013, model: 'crosstour', fitment: hondaCrosstour },
  
  // Honda Insight (2009-2014)
  { id: '765aa963-75bb-4d33-83a2-e98bcbd4bdf5', year: 2009, model: 'insight', fitment: hondaInsight },
  { id: '567735bb-f49f-4665-a6b1-8d94f4fbd432', year: 2010, model: 'insight', fitment: hondaInsight },
  { id: 'fea66d68-d9a6-4557-9d8d-b1b6489f4141', year: 2011, model: 'insight', fitment: hondaInsight },
  { id: '7edf3517-f341-4279-bd90-ff7889a4fa0e', year: 2012, model: 'insight', fitment: hondaInsight },
  { id: '9edf6708-6f34-4738-9018-d756e482eb3b', year: 2013, model: 'insight', fitment: hondaInsight },
  { id: 'ec7e71e0-1a84-4d4f-ab85-e6c1c26e8a22', year: 2014, model: 'insight', fitment: hondaInsight },
  
  // Honda Passport Old (2000-2002)
  { id: '89b3fb8a-cd06-4dd0-a6eb-a44c5665477e', year: 2000, model: 'passport', fitment: hondaPassportOld },
  { id: '311c1734-1e86-4f81-914d-2e3b5df4afdf', year: 2001, model: 'passport', fitment: hondaPassportOld },
  { id: 'eaea6a5d-2af7-4cec-ac4f-14bcebe79871', year: 2002, model: 'passport', fitment: hondaPassportOld },
  
  // Honda Passport New (2023-2026)
  { id: 'ac9d1b74-8531-44a1-8d8e-cded3553dcee', year: 2023, model: 'passport', fitment: hondaPassportNew },
  { id: '0f1ca2de-6d62-4ec6-beb6-94ebb33b5615', year: 2024, model: 'passport', fitment: hondaPassportNew },
  { id: '7a814567-b90a-45a8-8d95-f94f5ae741f8', year: 2025, model: 'passport', fitment: hondaPassportNew },
  { id: '09f73647-b547-4e67-902e-0d74ed6ff2fe', year: 2026, model: 'passport', fitment: hondaPassportNew },
  
  // Honda Prelude (2000-2001)
  { id: '9c0bae10-d930-49fa-949d-6a78c8f790d6', year: 2000, model: 'prelude', fitment: hondaPrelude },
  { id: '9e7d16be-daad-4970-b331-44fe4e459c94', year: 2001, model: 'prelude', fitment: hondaPrelude },
  
  // Honda Prologue (2026)
  { id: '436b6c76-fe30-4f98-a2fc-8f1cd3eeda29', year: 2026, model: 'prologue', fitment: hondaPrologue },
  
  // Acura CL Type-S (2001-2003)
  { id: 'ee7e6a75-af14-47b2-8a80-a3afbb792ed9', year: 2001, model: 'CL Type-S', fitment: acuraCLTypeS },
  { id: '01948b18-ab3c-49f3-adc2-0a13a4c5bfc0', year: 2002, model: 'CL Type-S', fitment: acuraCLTypeS },
  { id: '93cc23e9-8875-4f01-8c5f-06c796b72d41', year: 2003, model: 'CL Type-S', fitment: acuraCLTypeS },
  
  // Acura CL (2001-2003)
  { id: '817feb0e-22f6-4a24-8dbc-4a2d6ac382d6', year: 2001, model: 'cl', fitment: acuraCL },
  { id: '282a2d0d-3bdc-4878-aeeb-fa0ca4d41d6d', year: 2002, model: 'cl', fitment: acuraCL },
  { id: '47fdf43a-8079-4776-b9ad-abd7a0f9b033', year: 2003, model: 'cl', fitment: acuraCL },
  
  // Acura Integra Type-R (2000-2001)
  { id: '1bc8a2ee-7850-4cd0-96c8-23cf7910164b', year: 2000, model: 'Integra Type-R', fitment: acuraIntegraTypeR },
  { id: '70f77e56-8e19-4f14-ac4e-4667a12dfc0c', year: 2001, model: 'Integra Type-R', fitment: acuraIntegraTypeR },
  
  // Acura NSX Old (2000-2005)
  { id: '7d6647ce-8a3d-4a6e-8ced-2fcb55bd54d6', year: 2000, model: 'nsx', fitment: acuraNSXOld },
  { id: '2ea8a6e2-b578-4891-bffb-36b8a015036d', year: 2001, model: 'nsx', fitment: acuraNSXOld },
  { id: '1b8f1fc6-fd29-490f-8a78-37e61240af55', year: 2002, model: 'nsx', fitment: acuraNSXOld },
  { id: 'df3903aa-41af-4215-894a-7e47458c4a03', year: 2003, model: 'nsx', fitment: acuraNSXOld },
  { id: '5e41d9a7-19e4-4a81-a3b6-6c50dca6483c', year: 2004, model: 'nsx', fitment: acuraNSXOld },
  { id: '8d80e40e-77a6-4b76-b15b-45f7396e568f', year: 2005, model: 'nsx', fitment: acuraNSXOld },
  
  // Acura NSX New (2016-2020)
  { id: '30009369-a0f1-47f4-9104-3fa43a6384b2', year: 2016, model: 'nsx', fitment: acuraNSXNew },
  { id: '574f569e-5b20-414e-8571-e71e27a2e7d9', year: 2017, model: 'nsx', fitment: acuraNSXNew },
  { id: '6f68f764-1153-41ae-9d13-b6bbcb6d2d87', year: 2018, model: 'nsx', fitment: acuraNSXNew },
  { id: 'c2ed3f3d-84e9-4d31-a85b-8c4a099cacc0', year: 2019, model: 'nsx', fitment: acuraNSXNew },
  { id: '9f60b8e7-05a1-4485-b6d5-830ba6f116df', year: 2020, model: 'nsx', fitment: acuraNSXNew },
  
  // Acura RL (2000-2010)
  { id: '2a41ea47-5a48-43e2-8675-274eb4e83c8f', year: 2000, model: 'rl', fitment: acuraRL },
  { id: 'ef826ac3-85b5-4e83-b1ea-32b8a4a6787c', year: 2001, model: 'rl', fitment: acuraRL },
  { id: '784b623c-738d-436e-a637-07dfb6694d1e', year: 2002, model: 'rl', fitment: acuraRL },
  { id: 'a481a4a8-ca6b-4513-a415-94c34493eed6', year: 2003, model: 'rl', fitment: acuraRL },
  { id: '8601288f-7cc4-4b98-a4b2-cc393cd5fe7c', year: 2004, model: 'rl', fitment: acuraRL },
  { id: 'f9904ce1-b0bf-4840-8e17-79035b71d6eb', year: 2005, model: 'rl', fitment: acuraRL },
  { id: '896ca2ab-9b04-4212-8212-0aabfd01ce60', year: 2006, model: 'rl', fitment: acuraRL },
  { id: '65771b94-5657-470c-817e-f217d2ba0c89', year: 2007, model: 'rl', fitment: acuraRL },
  { id: '8e51b5d4-fb6d-42e7-8b89-250be3ced75a', year: 2008, model: 'rl', fitment: acuraRL },
  { id: '76b79269-6d8b-4822-ac24-d4497772a99e', year: 2009, model: 'rl', fitment: acuraRL },
  { id: '8e756b45-570c-4551-ac5f-02dc68454001', year: 2010, model: 'rl', fitment: acuraRL },
  
  // Acura RSX (2002-2006)
  { id: 'e049ca18-f1fa-4e70-bb5c-39ac276c413c', year: 2002, model: 'rsx', fitment: acuraRSX },
  { id: '612fd537-8c52-4748-9b66-1c413d2e9e50', year: 2003, model: 'rsx', fitment: acuraRSX },
  { id: '1b634d75-8fbd-4171-b216-94c81cae6eef', year: 2004, model: 'rsx', fitment: acuraRSX },
  { id: '37064c07-919a-499c-8265-6e2654036a27', year: 2005, model: 'rsx', fitment: acuraRSX },
  { id: 'b1adcae0-7d18-4ea6-be2a-4932826ac9b3', year: 2006, model: 'rsx', fitment: acuraRSX },
  
  // Acura ZDX Old (2012-2013)
  { id: 'f16b2b23-b089-4955-9b33-c727c05fd2b4', year: 2012, model: 'zdx', fitment: acuraZDXOld },
  { id: '0e5c1100-4e57-4884-ae03-edfa6042d020', year: 2013, model: 'zdx', fitment: acuraZDXOld },
  
  // Acura ZDX New (2023-2025)
  { id: '18cd7087-4a23-417c-9618-d43d454624b5', year: 2023, model: 'zdx', fitment: acuraZDXNew },
  { id: 'd4fe7666-dea9-4f1c-861d-47e66e26fe87', year: 2024, model: 'zdx', fitment: acuraZDXNew },
  { id: '4100d9e6-3cc6-48a2-b066-63e4e7dcc2ca', year: 2025, model: 'zdx', fitment: acuraZDXNew },
  
  // Mazda6 Gen1 (2003-2008)
  { id: 'a8cbfc80-c486-4b22-af1d-58a670cf6b34', year: 2003, model: 'Mazda6', fitment: mazda6Gen1 },
  { id: '69e960c4-2e2d-4493-a091-5afef2b739e6', year: 2004, model: 'Mazda6', fitment: mazda6Gen1 },
  { id: '6dff9e16-bb28-4eef-8516-c5e675f4b663', year: 2005, model: 'Mazda6', fitment: mazda6Gen1 },
  { id: '68c7bd9d-7c8e-4876-a470-22a48a07dae5', year: 2006, model: 'Mazda6', fitment: mazda6Gen1 },
  { id: '6ad1a2f5-31ef-4a25-a9f9-f5fc267ae448', year: 2007, model: 'Mazda6', fitment: mazda6Gen1 },
  { id: '04ae2de3-04da-4ba7-91b4-68af526ca363', year: 2008, model: 'Mazda6', fitment: mazda6Gen1 },
  
  // Mazda6 Gen2 (2009-2013)
  { id: '13812936-21eb-4bf0-b001-5fd2482df031', year: 2009, model: 'Mazda6', fitment: mazda6Gen2 },
  { id: '4c9cf498-8ecb-4a42-b554-7fd65a3ca035', year: 2010, model: 'Mazda6', fitment: mazda6Gen2 },
  { id: 'f44fa7a8-b40e-48e6-9b69-0de14202e699', year: 2011, model: 'Mazda6', fitment: mazda6Gen2 },
  { id: 'f5bdb157-0afa-493d-b130-8bcf85a97a02', year: 2012, model: 'Mazda6', fitment: mazda6Gen2 },
  { id: '477d3839-21d8-453e-b952-d94885abf8ec', year: 2013, model: 'Mazda6', fitment: mazda6Gen2 },
  
  // Mazda6 Gen3 (2014-2021)
  { id: 'b72c2aa3-ac29-4c08-a939-6567feb31c42', year: 2014, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: '9991118f-ea83-447c-b6f9-202165fd1933', year: 2015, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: '059c784c-bde2-4649-8c3c-a10eccc67718', year: 2016, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: 'c0275d05-ee0e-4734-b957-0111ee8b0753', year: 2017, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: '99fd613d-2197-4a85-b938-e170f5a08f48', year: 2018, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: 'd611c767-ca2b-4b97-8308-8473c019d047', year: 2019, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: 'dfaacf95-2ab4-4391-8363-f310280d67a9', year: 2020, model: 'Mazda6', fitment: mazda6Gen3 },
  { id: '948d58ba-233b-414a-892e-a208b37e25de', year: 2021, model: 'Mazda6', fitment: mazda6Gen3 },
  
  // Mazda CX-70 (2025-2026)
  { id: '9487eede-59ab-45c3-8599-b5433484efee', year: 2025, model: 'cx-70', fitment: mazdaCX70 },
  { id: '52075f6f-b20c-4c8e-9ba7-5f976e5bfe7b', year: 2026, model: 'cx-70', fitment: mazdaCX70 },
  
  // Mazda CX-9 (2009-2011)
  { id: 'e8337d84-4c3e-4386-bef4-39f728d7fcf0', year: 2009, model: 'cx-9', fitment: mazdaCX9 },
  { id: '33f5f735-9d73-48d6-85e6-3f8d4d9cd944', year: 2010, model: 'cx-9', fitment: mazdaCX9 },
  { id: '7a795daa-e737-4987-ab33-b615634e35cd', year: 2011, model: 'cx-9', fitment: mazdaCX9 },
  
  // Mazda MX-30 (2024-2025)
  { id: '079c71b2-4a26-4851-9e38-635bbb021394', year: 2024, model: 'mx-30', fitment: mazdaMX30 },
  { id: '34419704-2ea8-41e6-823c-a1dfa69bb045', year: 2025, model: 'mx-30', fitment: mazdaMX30 },
  
  // Mazda MX-5 NB (2000-2005)
  { id: '69d9ce63-d5b3-4b90-b0eb-2f8e2174d573', year: 2000, model: 'mx-5', fitment: mazdaMX5NB },
  { id: '6e62f45e-b420-49fb-8eed-b9173856c114', year: 2001, model: 'mx-5', fitment: mazdaMX5NB },
  { id: '5424ca4d-9707-4a6f-ba09-f940599b99c1', year: 2002, model: 'mx-5', fitment: mazdaMX5NB },
  { id: 'b279c2eb-4718-4821-baec-e8181d896728', year: 2003, model: 'mx-5', fitment: mazdaMX5NB },
  { id: '977e1ab2-8f2f-4e4c-895a-f802783d0955', year: 2004, model: 'mx-5', fitment: mazdaMX5NB },
  { id: '360d3da4-bf98-48cf-b30a-602bbed8ebf5', year: 2005, model: 'mx-5', fitment: mazdaMX5NB },
  
  // Mazda MX-5 NC (2006-2007)
  { id: '4fe389cd-9858-4290-a0e5-85293d51eed6', year: 2006, model: 'mx-5', fitment: mazdaMX5NC },
  { id: 'd816018d-0f6a-4333-b568-974f5a1c3db0', year: 2007, model: 'mx-5', fitment: mazdaMX5NC },
];

async function applyFixes() {
  console.log(`Applying fixes to ${fixMappings.length} records...`);
  let updated = 0;
  let errors = 0;
  
  for (const fix of fixMappings) {
    try {
      const result = await pool.query(`
        UPDATE vehicle_fitments 
        SET 
          oem_wheel_sizes = $1,
          oem_tire_sizes = $2,
          bolt_pattern = $3,
          center_bore_mm = $4,
          thread_size = $5,
          seat_type = $6,
          offset_min_mm = $7,
          offset_max_mm = $8,
          source = 'google-ai-overview',
          updated_at = NOW()
        WHERE id = $9
      `, [
        JSON.stringify(fix.fitment.oemWheelSizes),
        JSON.stringify(fix.fitment.oemTireSizes),
        fix.fitment.boltPattern,
        fix.fitment.centerBoreMm,
        fix.fitment.threadSize,
        fix.fitment.seatType,
        fix.fitment.offsetMinMm,
        fix.fitment.offsetMaxMm,
        fix.id
      ]);
      
      if (result.rowCount === 1) {
        updated++;
        console.log(`✓ ${fix.year} ${fix.model}`);
      } else {
        console.log(`⚠ ${fix.year} ${fix.model} - no matching record`);
      }
    } catch (err) {
      errors++;
      console.error(`✗ ${fix.year} ${fix.model}:`, err);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${fixMappings.length}`);
  
  await pool.end();
}

applyFixes();
