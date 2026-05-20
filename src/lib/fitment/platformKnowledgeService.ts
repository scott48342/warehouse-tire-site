/**
 * Enthusiast Platform Knowledge Service
 * 
 * Provides platform-specific enthusiast guidance and wheel culture knowledge.
 * This is NOT verified OEM fitment - this is enthusiast expertise.
 * 
 * PURPOSE:
 * - Help Jake sound like a real enthusiast wheel/tire consultant
 * - Provide realistic expectations for aftermarket wheel shopping
 * - Identify platform overlap and surrogate search opportunities
 * - Stop Jake from saying "we probably don't have options" for known enthusiast platforms
 * 
 * @created 2026-05-20
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PlatformProfile {
  // Platform identification
  platformId: string;
  name: string;
  aliases: string[];
  
  // Vehicle matching
  years: { start: number; end: number };
  makes: string[];
  models: string[];
  
  // Fitment culture
  oemBoltPattern: string;
  oemBoltPatternMetric: string;
  commonBoltPatterns: string[]; // Including adapter-compatible
  oemCenterBore: number;
  compatibleCenterBores: number[]; // Hub-centric rings available
  
  // Enthusiast wheel culture
  enthusiastDiameters: {
    conservative: number[];   // Safe, common upgrades
    sweetSpot: number[];      // "Honestly the best choice"
    aggressive: number[];     // Possible but need clearance work
    extreme: number[];        // Requires mods, not for everyone
  };
  
  // Staggered culture
  staggeredCommon: boolean;
  typicalStaggeredSetup?: {
    frontWidth: number;
    rearWidth: number;
    frontOffset: { min: number; max: number };
    rearOffset: { min: number; max: number };
  };
  
  // Offset guidance
  offsetRange: {
    safe: { min: number; max: number };
    aggressive: { min: number; max: number };
  };
  
  // Platform relationships
  relatedPlatforms: string[];      // Search these too
  wheelDonorPlatforms: string[];   // "Corvette wheels fit"
  sharedComponents: string[];      // "Same rear end as..."
  
  // Common adapter paths
  adapterPaths?: Array<{
    targetPattern: string;
    adapterThickness: number[];
    notes: string;
  }>;
  
  // Enthusiast guidance
  culturalNotes: string[];         // "20s are the sweet spot on these"
  commonMistakes: string[];        // "Don't go too wide up front"
  popularWheelStyles: string[];    // "Deep dish", "Staggered", etc.
  
  // Tire guidance
  commonTireBrands: string[];
  tireNotes: string[];
  
  // Safety/disclaimer level
  requiresClearanceCheck: boolean;
  requiresOffsetCalculation: boolean;
  adapterFriendly: boolean;
}

export interface PlatformSearchHints {
  platformId: string;
  platformName: string;
  
  // Search parameters
  primaryBoltPattern: string;
  alternateBoltPatterns: string[];
  searchDiameters: number[];
  searchWidths: number[];
  offsetRange: { min: number; max: number };
  
  // Related searches
  surrogatePlatforms: Array<{
    platformId: string;
    name: string;
    reason: string; // "Same bolt pattern", "Wheels interchange"
  }>;
  
  // Staggered hints
  staggeredRecommended: boolean;
  staggeredHints?: {
    frontDiameter: number;
    rearDiameter: number;
    frontWidths: number[];
    rearWidths: number[];
  };
  
  // Enthusiast messaging
  enthusiastGuidance: string[];
  confidenceNote: string;
}

export interface PlatformLookupResult {
  found: boolean;
  platform?: PlatformProfile;
  searchHints?: PlatformSearchHints;
  
  // For analytics
  matchType: "exact" | "fuzzy" | "related" | "none";
  matchedOn?: string;
}

// =============================================================================
// PLATFORM DATABASE
// =============================================================================

const PLATFORM_PROFILES: PlatformProfile[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // GM F-BODY (4th Gen: 1993-2002 Camaro/Firebird)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-f-body-4th",
    name: "4th Gen F-Body",
    aliases: ["F-body", "4th gen", "LS1 F-body", "LT1 F-body"],
    
    years: { start: 1993, end: 2002 },
    makes: ["chevrolet", "chevy", "pontiac"],
    models: ["camaro", "firebird", "trans am", "formula"],
    
    oemBoltPattern: "5x4.75",
    oemBoltPatternMetric: "5x120.65",
    commonBoltPatterns: ["5x120.65", "5x120", "5x115"],
    oemCenterBore: 70.3,
    compatibleCenterBores: [70.3, 70.5, 71.5, 72.56],
    
    enthusiastDiameters: {
      conservative: [17, 18],
      sweetSpot: [18, 19, 20],
      aggressive: [20, 21],
      extreme: [22],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 8.5,
      rearWidth: 10,
      frontOffset: { min: 30, max: 45 },
      rearOffset: { min: 20, max: 40 },
    },
    
    offsetRange: {
      safe: { min: 25, max: 50 },
      aggressive: { min: 15, max: 55 },
    },
    
    relatedPlatforms: ["gm-corvette-c5", "gm-corvette-c4", "gm-f-body-3rd"],
    wheelDonorPlatforms: ["gm-corvette-c5", "gm-corvette-c4"],
    sharedComponents: ["LS1 engine (98-02)", "T56 trans", "IRS (some)"],
    
    adapterPaths: [
      {
        targetPattern: "5x120",
        adapterThickness: [15, 20, 25],
        notes: "Opens up BMW, newer GM wheel options",
      },
      {
        targetPattern: "5x115",
        adapterThickness: [15, 20],
        notes: "Opens up newer Camaro/CTS-V wheels",
      },
    ],
    
    culturalNotes: [
      "20s are honestly the sweet spot on these cars - fills the wheel well perfectly",
      "Staggered setups are super common, especially on the LS1 cars",
      "C5 Corvette wheels are a popular direct-fit option",
      "Lots of aftermarket support - these are legendary muscle cars",
      "The bolt pattern is shared with older Corvettes, tons of wheel choices",
    ],
    commonMistakes: [
      "Going too wide up front causes rubbing on full lock",
      "Aggressive offset without fender work causes tire rub",
      "Forgetting hub-centric rings leads to vibration",
    ],
    popularWheelStyles: ["Deep dish", "5-spoke", "Mesh", "Corvette replicas", "Pro touring"],
    
    commonTireBrands: ["Nitto", "Mickey Thompson", "BFGoodrich", "Toyo"],
    tireNotes: [
      "275/40R20 rear is a common aggressive setup",
      "Wider rear tires help put down the LS1 power",
    ],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GM CORVETTE C5 (1997-2004)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-corvette-c5",
    name: "C5 Corvette",
    aliases: ["C5", "5th gen Corvette"],
    
    years: { start: 1997, end: 2004 },
    makes: ["chevrolet", "chevy"],
    models: ["corvette"],
    
    oemBoltPattern: "5x4.75",
    oemBoltPatternMetric: "5x120.65",
    commonBoltPatterns: ["5x120.65", "5x120"],
    oemCenterBore: 70.3,
    compatibleCenterBores: [70.3, 70.5],
    
    enthusiastDiameters: {
      conservative: [17, 18],
      sweetSpot: [18, 19],
      aggressive: [19, 20],
      extreme: [20],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 8.5,
      rearWidth: 10,
      frontOffset: { min: 40, max: 56 },
      rearOffset: { min: 50, max: 70 },
    },
    
    offsetRange: {
      safe: { min: 35, max: 70 },
      aggressive: { min: 30, max: 75 },
    },
    
    relatedPlatforms: ["gm-f-body-4th", "gm-corvette-c4", "gm-corvette-c6"],
    wheelDonorPlatforms: ["gm-corvette-c6"],
    sharedComponents: ["LS1/LS6 engine", "Transaxle"],
    
    culturalNotes: [
      "Factory staggered setup - don't fight it, embrace it",
      "18/19 staggered is the classic look",
      "Z06 wheels are highly sought after",
      "Wheels interchange with 4th gen F-body",
    ],
    commonMistakes: [
      "Running square setup loses the Corvette stance",
      "Too much rear width causes rubbing on bumps",
    ],
    popularWheelStyles: ["Z06 replicas", "CCW", "Forgestar", "Weld"],
    
    commonTireBrands: ["Michelin", "Nitto", "Toyo"],
    tireNotes: ["345/30R19 rear is an aggressive but popular choice"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GM CORVETTE C4 (1984-1996)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-corvette-c4",
    name: "C4 Corvette",
    aliases: ["C4", "4th gen Corvette"],
    
    years: { start: 1984, end: 1996 },
    makes: ["chevrolet", "chevy"],
    models: ["corvette"],
    
    oemBoltPattern: "5x4.75",
    oemBoltPatternMetric: "5x120.65",
    commonBoltPatterns: ["5x120.65"],
    oemCenterBore: 70.3,
    compatibleCenterBores: [70.3, 70.5],
    
    enthusiastDiameters: {
      conservative: [17],
      sweetSpot: [17, 18],
      aggressive: [18, 19],
      extreme: [19],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 8.5,
      rearWidth: 9.5,
      frontOffset: { min: 35, max: 50 },
      rearOffset: { min: 40, max: 56 },
    },
    
    offsetRange: {
      safe: { min: 30, max: 60 },
      aggressive: { min: 25, max: 65 },
    },
    
    relatedPlatforms: ["gm-corvette-c5", "gm-f-body-4th", "gm-f-body-3rd"],
    wheelDonorPlatforms: ["gm-corvette-c5"],
    sharedComponents: ["LT1 engine (92-96)"],
    
    culturalNotes: [
      "ZR1 wheels are the holy grail",
      "17s are period-correct, 18s are the modern upgrade",
      "Same bolt pattern as F-body, lots of crossover",
    ],
    commonMistakes: [
      "Going too big loses the C4 proportions",
    ],
    popularWheelStyles: ["ZR1 replicas", "Sawblade", "Period correct"],
    
    commonTireBrands: ["BFGoodrich", "Goodyear", "Michelin"],
    tireNotes: ["275/40R17 rear is the classic upgrade"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORD MUSTANG S197 (2005-2014)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "ford-mustang-s197",
    name: "S197 Mustang",
    aliases: ["S197", "5th gen Mustang", "New Edge"],
    
    years: { start: 2005, end: 2014 },
    makes: ["ford"],
    models: ["mustang"],
    
    oemBoltPattern: "5x4.5",
    oemBoltPatternMetric: "5x114.3",
    commonBoltPatterns: ["5x114.3"],
    oemCenterBore: 70.6,
    compatibleCenterBores: [70.6, 70.5, 71.5, 72.56],
    
    enthusiastDiameters: {
      conservative: [18, 19],
      sweetSpot: [19, 20],
      aggressive: [20],
      extreme: [22],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 9,
      rearWidth: 10,
      frontOffset: { min: 30, max: 45 },
      rearOffset: { min: 35, max: 50 },
    },
    
    offsetRange: {
      safe: { min: 25, max: 55 },
      aggressive: { min: 20, max: 60 },
    },
    
    relatedPlatforms: ["ford-mustang-s550", "ford-mustang-sn95"],
    wheelDonorPlatforms: ["ford-mustang-s550"],
    sharedComponents: ["5.0 Coyote (11-14 GT)", "Tremec trans"],
    
    culturalNotes: [
      "20s are super common on these, especially the GT",
      "Staggered is the way to go for that muscle car stance",
      "Huge aftermarket support - American Muscle, LMR, etc.",
      "5x114.3 is one of the most common patterns, tons of options",
    ],
    commonMistakes: [
      "Going too wide up front without checking turning clearance",
      "Cheap replica wheels with wrong offset",
    ],
    popularWheelStyles: ["Shelby replicas", "Deep dish", "5-star", "SVE"],
    
    commonTireBrands: ["Nitto", "Michelin", "Continental"],
    tireNotes: ["275/40R20 or 305/35R20 rear is common"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORD MUSTANG S550 (2015-2023)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "ford-mustang-s550",
    name: "S550 Mustang",
    aliases: ["S550", "6th gen Mustang"],
    
    years: { start: 2015, end: 2023 },
    makes: ["ford"],
    models: ["mustang"],
    
    oemBoltPattern: "5x4.5",
    oemBoltPatternMetric: "5x114.3",
    commonBoltPatterns: ["5x114.3"],
    oemCenterBore: 70.5,
    compatibleCenterBores: [70.5, 70.6, 71.5],
    
    enthusiastDiameters: {
      conservative: [19],
      sweetSpot: [19, 20],
      aggressive: [20],
      extreme: [22],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 9.5,
      rearWidth: 10.5,
      frontOffset: { min: 30, max: 45 },
      rearOffset: { min: 35, max: 52 },
    },
    
    offsetRange: {
      safe: { min: 25, max: 55 },
      aggressive: { min: 20, max: 60 },
    },
    
    relatedPlatforms: ["ford-mustang-s197"],
    wheelDonorPlatforms: [],
    sharedComponents: ["5.0 Coyote GT", "IRS"],
    
    culturalNotes: [
      "GT350/GT500 wheels are highly sought after",
      "IRS means you can run wider rear wheels than S197",
      "20s are basically standard at this point",
      "Performance Pack wheels are popular",
    ],
    commonMistakes: [
      "Forgetting that PP cars have Brembos - need clearance",
    ],
    popularWheelStyles: ["GT350 replicas", "Forgestar", "Velgen", "Weld"],
    
    commonTireBrands: ["Michelin", "Nitto", "Continental"],
    tireNotes: ["305/30R20 square setup is popular for track"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GM SILVERADO/SIERRA (2019+ T1XX)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-truck-t1xx",
    name: "GM T1XX Trucks",
    aliases: ["T1", "New body Silverado", "New body Sierra"],
    
    years: { start: 2019, end: 2026 },
    makes: ["chevrolet", "chevy", "gmc"],
    models: ["silverado", "sierra", "silverado 1500", "sierra 1500"],
    
    oemBoltPattern: "6x5.5",
    oemBoltPatternMetric: "6x139.7",
    commonBoltPatterns: ["6x139.7", "6x135"],
    oemCenterBore: 78.1,
    compatibleCenterBores: [78.1, 77.8, 78],
    
    enthusiastDiameters: {
      conservative: [20],
      sweetSpot: [20, 22],
      aggressive: [22, 24],
      extreme: [24, 26],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: 15, max: 35 },
      aggressive: { min: -12, max: 44 },
    },
    
    relatedPlatforms: ["gm-truck-k2xx", "gm-suv-t1xx"],
    wheelDonorPlatforms: [],
    sharedComponents: ["6.2L V8", "10-speed trans"],
    
    culturalNotes: [
      "22s are basically standard on these trucks now",
      "Leveling kit + 33s is the classic look",
      "Lots of guys running 35s on stock suspension",
      "Trail Boss/AT4 already lifted from factory",
    ],
    commonMistakes: [
      "Negative offset without considering steering components",
      "Too much tire stretch on aggressive offsets",
    ],
    popularWheelStyles: ["Fuel", "Moto Metal", "KMC", "Black Rhino", "Method"],
    
    commonTireBrands: ["BFGoodrich", "Toyo", "Nitto", "Falken"],
    tireNotes: [
      "33x12.50R22 is super popular",
      "35s require a level at minimum",
    ],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GM SILVERADO/SIERRA (2014-2018 K2XX)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-truck-k2xx",
    name: "GM K2XX Trucks",
    aliases: ["K2", "14-18 Silverado", "14-18 Sierra"],
    
    years: { start: 2014, end: 2018 },
    makes: ["chevrolet", "chevy", "gmc"],
    models: ["silverado", "sierra", "silverado 1500", "sierra 1500"],
    
    oemBoltPattern: "6x5.5",
    oemBoltPatternMetric: "6x139.7",
    commonBoltPatterns: ["6x139.7"],
    oemCenterBore: 78.1,
    compatibleCenterBores: [78.1, 77.8],
    
    enthusiastDiameters: {
      conservative: [18, 20],
      sweetSpot: [20, 22],
      aggressive: [22, 24],
      extreme: [24, 26],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: 15, max: 35 },
      aggressive: { min: -12, max: 44 },
    },
    
    relatedPlatforms: ["gm-truck-t1xx", "gm-truck-gmt900"],
    wheelDonorPlatforms: ["gm-truck-t1xx"],
    sharedComponents: ["5.3L/6.2L V8", "8-speed trans"],
    
    culturalNotes: [
      "Same bolt pattern as the new trucks, lots of wheel choices",
      "Level kit + 22s is the go-to street look",
      "These trucks lift great",
    ],
    commonMistakes: [
      "Forgetting about TPMS when swapping wheels",
    ],
    popularWheelStyles: ["Fuel", "XD", "Hostile", "American Force"],
    
    commonTireBrands: ["BFGoodrich", "Toyo", "Nitto"],
    tireNotes: ["305/55R20 is a common mild upgrade"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FORD F-150 (2015-2020 / 2021+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "ford-f150-p552",
    name: "Ford F-150 (2015+)",
    aliases: ["13th gen F-150", "14th gen F-150", "Aluminum F-150"],
    
    years: { start: 2015, end: 2026 },
    makes: ["ford"],
    models: ["f-150", "f150"],
    
    oemBoltPattern: "6x5.31",
    oemBoltPatternMetric: "6x135",
    commonBoltPatterns: ["6x135"],
    oemCenterBore: 87.1,
    compatibleCenterBores: [87.1, 87],
    
    enthusiastDiameters: {
      conservative: [18, 20],
      sweetSpot: [20, 22],
      aggressive: [22, 24],
      extreme: [24, 26],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: 20, max: 44 },
      aggressive: { min: -12, max: 50 },
    },
    
    relatedPlatforms: ["ford-expedition"],
    wheelDonorPlatforms: [],
    sharedComponents: ["3.5 EcoBoost", "5.0 Coyote", "10-speed"],
    
    culturalNotes: [
      "6x135 is Ford-specific but tons of wheel options",
      "Raptor wheels are super popular across all F-150s",
      "22s are basically standard for street trucks",
      "Leveling kits are almost expected at this point",
    ],
    commonMistakes: [
      "Some wheels hit the TPMS sensor at certain offsets",
    ],
    popularWheelStyles: ["Fuel", "Raptor replicas", "Method", "Gear"],
    
    commonTireBrands: ["BFGoodrich", "Toyo", "Nitto", "General"],
    tireNotes: [
      "35x12.50R20 is the common 'looks good, still drives good' setup",
      "33s fit with a level, 35s need more work",
    ],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DODGE CHALLENGER/CHARGER (LC/LD)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "mopar-lx-lc",
    name: "Mopar LX/LC Platform",
    aliases: ["LX", "LC", "LD"],
    
    years: { start: 2006, end: 2026 },
    makes: ["dodge", "chrysler"],
    models: ["challenger", "charger", "300", "chrysler 300", "300c"],
    
    oemBoltPattern: "5x4.5",
    oemBoltPatternMetric: "5x115",
    commonBoltPatterns: ["5x115"],
    oemCenterBore: 71.5,
    compatibleCenterBores: [71.5, 71.6, 72.56],
    
    enthusiastDiameters: {
      conservative: [18, 20],
      sweetSpot: [20],
      aggressive: [20, 22],
      extreme: [22, 24],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 9,
      rearWidth: 10.5,
      frontOffset: { min: 18, max: 35 },
      rearOffset: { min: 18, max: 35 },
    },
    
    offsetRange: {
      safe: { min: 15, max: 40 },
      aggressive: { min: 5, max: 45 },
    },
    
    relatedPlatforms: [],
    wheelDonorPlatforms: [],
    sharedComponents: ["Hemi V8", "ZF 8-speed"],
    
    culturalNotes: [
      "20s are the sweet spot, fills the wheel wells perfect",
      "Hellcat/Demon wheels are highly sought after",
      "Widebody cars have different fitment - more aggressive options",
      "Staggered is common on Challengers especially",
    ],
    commonMistakes: [
      "Forgetting widebody vs standard body fitment is different",
      "Demon wheels don't fit standard cars without spacers",
    ],
    popularWheelStyles: ["Hellcat replicas", "Demon replicas", "Forged", "Deep dish"],
    
    commonTireBrands: ["Nitto", "Mickey Thompson", "Continental"],
    tireNotes: [
      "305/35R20 rear is common",
      "Widebody can fit 315/40R18 factory!",
    ],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BMW 3-SERIES (E90/E92)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "bmw-e9x",
    name: "BMW E90/E92 3-Series",
    aliases: ["E90", "E92", "E93", "E91"],
    
    years: { start: 2006, end: 2013 },
    makes: ["bmw"],
    models: ["328i", "335i", "m3", "3 series", "328", "335"],
    
    oemBoltPattern: "5x4.72",
    oemBoltPatternMetric: "5x120",
    commonBoltPatterns: ["5x120"],
    oemCenterBore: 72.56,
    compatibleCenterBores: [72.56, 72.5],
    
    enthusiastDiameters: {
      conservative: [18],
      sweetSpot: [18, 19],
      aggressive: [19, 20],
      extreme: [20],
    },
    
    staggeredCommon: true,
    typicalStaggeredSetup: {
      frontWidth: 8.5,
      rearWidth: 9.5,
      frontOffset: { min: 32, max: 40 },
      rearOffset: { min: 35, max: 45 },
    },
    
    offsetRange: {
      safe: { min: 30, max: 45 },
      aggressive: { min: 25, max: 50 },
    },
    
    relatedPlatforms: ["bmw-f30", "bmw-e46"],
    wheelDonorPlatforms: ["bmw-f30"],
    sharedComponents: ["N54/N55 engines", "ZF trans"],
    
    culturalNotes: [
      "5x120 is the BMW standard - tons of options",
      "19s staggered is the classic aggressive look",
      "M3 fitment is different - comp package has wider rear",
      "Arc-8, CSL replicas are always popular",
    ],
    commonMistakes: [
      "Non-M vs M fitment is different",
      "Forgetting hub-centric rings causes vibration",
    ],
    popularWheelStyles: ["Apex", "VMR", "CSL replicas", "TE37 replicas"],
    
    commonTireBrands: ["Michelin", "Continental", "Pirelli"],
    tireNotes: ["265/35R19 rear is a common aggressive setup"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: false,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RAM 1500 (2019+ DT)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "ram-dt",
    name: "Ram 1500 DT",
    aliases: ["DT", "5th gen Ram", "New Ram"],
    
    years: { start: 2019, end: 2026 },
    makes: ["ram", "dodge"],
    models: ["1500", "ram 1500"],
    
    oemBoltPattern: "6x5.5",
    oemBoltPatternMetric: "6x139.7",
    commonBoltPatterns: ["6x139.7"],
    oemCenterBore: 77.8,
    compatibleCenterBores: [77.8, 78.1],
    
    enthusiastDiameters: {
      conservative: [20],
      sweetSpot: [20, 22],
      aggressive: [22, 24],
      extreme: [24, 26],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: 15, max: 35 },
      aggressive: { min: -12, max: 44 },
    },
    
    relatedPlatforms: ["ram-ds", "gm-truck-t1xx"],
    wheelDonorPlatforms: [],
    sharedComponents: ["5.7 Hemi", "eTorque"],
    
    culturalNotes: [
      "Same bolt pattern as GM trucks, lots of wheel choices",
      "TRX is its own beast with different fitment",
      "22s are super common, truck looks great with them",
      "Air suspension trucks need different considerations",
    ],
    commonMistakes: [
      "TRX fitment is NOT the same as regular 1500",
    ],
    popularWheelStyles: ["Fuel", "Moto Metal", "Hostile", "American Force"],
    
    commonTireBrands: ["BFGoodrich", "Toyo", "Nitto"],
    tireNotes: ["35x12.50R20 is common with a level"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OBS CHEVY TRUCKS (1988-1998)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "gm-obs-truck",
    name: "OBS Chevy/GMC Trucks",
    aliases: ["OBS", "Old Body Style", "GMT400"],
    
    years: { start: 1988, end: 1998 },
    makes: ["chevrolet", "chevy", "gmc"],
    models: ["c1500", "k1500", "silverado", "sierra", "c/k", "ck"],
    
    oemBoltPattern: "5x5",
    oemBoltPatternMetric: "5x127",
    commonBoltPatterns: ["5x127", "6x139.7"],
    oemCenterBore: 78.1,
    compatibleCenterBores: [78.1, 78.3],
    
    enthusiastDiameters: {
      conservative: [17, 18],
      sweetSpot: [18, 20],
      aggressive: [20, 22],
      extreme: [22, 24],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: 0, max: 25 },
      aggressive: { min: -12, max: 30 },
    },
    
    relatedPlatforms: ["gm-nbs-truck"],
    wheelDonorPlatforms: [],
    sharedComponents: ["350/454 engines"],
    
    adapterPaths: [
      {
        targetPattern: "6x139.7",
        adapterThickness: [1.5],
        notes: "Converts to modern 6-lug pattern, VERY common swap",
      },
    ],
    
    culturalNotes: [
      "OBS trucks are HOT right now, prices are up",
      "5-lug to 6-lug adapter swap is super common",
      "Lowered OBS with 20s is the classic look",
      "Billets are popular but expensive",
    ],
    commonMistakes: [
      "2WD vs 4WD have different front hubs",
      "Cheap adapters can be dangerous",
    ],
    popularWheelStyles: ["Billet", "Intro", "US Mags", "American Racing"],
    
    commonTireBrands: ["Mickey Thompson", "Nitto", "Toyo"],
    tireNotes: ["Low profile on lowered trucks is the move"],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // JEEP JL WRANGLER (2018+)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    platformId: "jeep-jl",
    name: "Jeep JL Wrangler",
    aliases: ["JL", "JLU", "New Wrangler"],
    
    years: { start: 2018, end: 2026 },
    makes: ["jeep"],
    models: ["wrangler", "wrangler unlimited", "jl", "jlu"],
    
    oemBoltPattern: "5x5",
    oemBoltPatternMetric: "5x127",
    commonBoltPatterns: ["5x127"],
    oemCenterBore: 71.5,
    compatibleCenterBores: [71.5, 71.6],
    
    enthusiastDiameters: {
      conservative: [17],
      sweetSpot: [17, 18],
      aggressive: [18, 20],
      extreme: [20],
    },
    
    staggeredCommon: false,
    
    offsetRange: {
      safe: { min: -12, max: 15 },
      aggressive: { min: -24, max: 20 },
    },
    
    relatedPlatforms: ["jeep-jk", "jeep-gladiator"],
    wheelDonorPlatforms: ["jeep-jk"],
    sharedComponents: ["3.6L Pentastar", "392 Hemi"],
    
    culturalNotes: [
      "17s with 35s is the classic capable look",
      "Beadlocks are popular for off-road",
      "Rubicon has different gearing considerations",
      "Don't go too big on wheel diameter - kills off-road capability",
    ],
    commonMistakes: [
      "Going too big on diameter hurts off-road",
      "Forgetting about backspacing for steering",
    ],
    popularWheelStyles: ["Method", "Black Rhino", "Fuel", "AEV"],
    
    commonTireBrands: ["BFGoodrich", "Falken", "Toyo", "Nitto"],
    tireNotes: [
      "35x12.50R17 is the sweet spot for most builds",
      "37s require significant mods",
    ],
    
    requiresClearanceCheck: true,
    requiresOffsetCalculation: true,
    adapterFriendly: false,
  },
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find a platform profile for a given vehicle
 */
export function lookupPlatform(
  year: number,
  make: string,
  model: string,
  trim?: string
): PlatformLookupResult {
  const normalizedMake = make.toLowerCase().trim();
  const normalizedModel = model.toLowerCase().trim();
  const normalizedTrim = trim?.toLowerCase().trim();
  
  // Check for direct match
  for (const platform of PLATFORM_PROFILES) {
    // Year check
    if (year < platform.years.start || year > platform.years.end) {
      continue;
    }
    
    // Make check
    const makeMatch = platform.makes.some(m => 
      normalizedMake.includes(m) || m.includes(normalizedMake)
    );
    if (!makeMatch) continue;
    
    // Model check (flexible matching)
    const modelMatch = platform.models.some(m => {
      const mNorm = m.toLowerCase();
      return normalizedModel.includes(mNorm) || 
             mNorm.includes(normalizedModel) ||
             normalizedModel.replace(/\s+/g, "").includes(mNorm.replace(/\s+/g, ""));
    });
    
    if (modelMatch) {
      return {
        found: true,
        platform,
        searchHints: buildSearchHints(platform),
        matchType: "exact",
        matchedOn: `${platform.name}`,
      };
    }
    
    // Check trim/alias match (e.g., "Formula", "Trans Am")
    if (normalizedTrim) {
      const trimMatch = platform.models.some(m => 
        normalizedTrim.includes(m.toLowerCase())
      );
      if (trimMatch) {
        return {
          found: true,
          platform,
          searchHints: buildSearchHints(platform),
          matchType: "exact",
          matchedOn: `${platform.name} (trim match)`,
        };
      }
    }
  }
  
  // No direct match found
  return {
    found: false,
    matchType: "none",
  };
}

/**
 * Build search hints from a platform profile
 */
function buildSearchHints(platform: PlatformProfile): PlatformSearchHints {
  const allDiameters = [
    ...platform.enthusiastDiameters.conservative,
    ...platform.enthusiastDiameters.sweetSpot,
    ...platform.enthusiastDiameters.aggressive,
  ];
  const uniqueDiameters = [...new Set(allDiameters)].sort((a, b) => a - b);
  
  // Typical widths based on platform
  const searchWidths = platform.staggeredCommon && platform.typicalStaggeredSetup
    ? [platform.typicalStaggeredSetup.frontWidth, platform.typicalStaggeredSetup.rearWidth]
    : [7.5, 8, 8.5, 9, 9.5, 10];
  
  // Build surrogate platforms
  const surrogates = platform.relatedPlatforms.map(relId => {
    const related = PLATFORM_PROFILES.find(p => p.platformId === relId);
    return {
      platformId: relId,
      name: related?.name || relId,
      reason: platform.wheelDonorPlatforms.includes(relId) 
        ? "Wheels interchange" 
        : "Related platform, similar fitment",
    };
  });
  
  return {
    platformId: platform.platformId,
    platformName: platform.name,
    
    primaryBoltPattern: platform.oemBoltPatternMetric,
    alternateBoltPatterns: platform.commonBoltPatterns.filter(p => p !== platform.oemBoltPatternMetric),
    searchDiameters: uniqueDiameters,
    searchWidths: [...new Set(searchWidths)],
    offsetRange: platform.offsetRange.safe,
    
    surrogatePlatforms: surrogates,
    
    staggeredRecommended: platform.staggeredCommon,
    staggeredHints: platform.staggeredCommon && platform.typicalStaggeredSetup ? {
      frontDiameter: platform.enthusiastDiameters.sweetSpot[0],
      rearDiameter: platform.enthusiastDiameters.sweetSpot[0],
      frontWidths: [platform.typicalStaggeredSetup.frontWidth, platform.typicalStaggeredSetup.frontWidth + 0.5],
      rearWidths: [platform.typicalStaggeredSetup.rearWidth, platform.typicalStaggeredSetup.rearWidth + 0.5],
    } : undefined,
    
    enthusiastGuidance: platform.culturalNotes,
    confidenceNote: "Based on enthusiast platform knowledge - verify final clearance",
  };
}

/**
 * Get enthusiast guidance for a requested wheel size
 */
export function getEnthusiastGuidance(
  platform: PlatformProfile,
  requestedDiameter: number
): {
  feasibility: "recommended" | "common" | "possible" | "challenging" | "extreme";
  guidance: string[];
  staggeredSuggestion?: string;
  offsetGuidance?: string;
} {
  const { enthusiastDiameters } = platform;
  
  let feasibility: "recommended" | "common" | "possible" | "challenging" | "extreme";
  const guidance: string[] = [];
  
  if (enthusiastDiameters.sweetSpot.includes(requestedDiameter)) {
    feasibility = "recommended";
    guidance.push(`${requestedDiameter}s are honestly the sweet spot on ${platform.name} - fills the wheel well perfectly`);
  } else if (enthusiastDiameters.conservative.includes(requestedDiameter)) {
    feasibility = "common";
    guidance.push(`${requestedDiameter}s are a safe, common choice - no clearance issues to worry about`);
  } else if (enthusiastDiameters.aggressive.includes(requestedDiameter)) {
    feasibility = "possible";
    guidance.push(`${requestedDiameter}s are definitely possible - may need some attention to offset and tire size`);
  } else if (enthusiastDiameters.extreme.includes(requestedDiameter)) {
    feasibility = "challenging";
    guidance.push(`${requestedDiameter}s are aggressive on these - you'll need to be careful with offset and probably need fender work`);
  } else if (requestedDiameter > Math.max(...enthusiastDiameters.extreme)) {
    feasibility = "extreme";
    guidance.push(`${requestedDiameter}s are pretty extreme for ${platform.name} - definitely possible but requires serious planning`);
  } else {
    feasibility = "common";
    guidance.push(`${requestedDiameter}s should work fine`);
  }
  
  // Add staggered suggestion if applicable
  let staggeredSuggestion: string | undefined;
  if (platform.staggeredCommon && platform.typicalStaggeredSetup) {
    const setup = platform.typicalStaggeredSetup;
    staggeredSuggestion = `Staggered setups are super common on these - something like ${setup.frontWidth}" front / ${setup.rearWidth}" rear gives that aggressive muscle car stance`;
  }
  
  // Add offset guidance
  let offsetGuidance: string | undefined;
  const { safe, aggressive } = platform.offsetRange;
  if (feasibility === "possible" || feasibility === "challenging") {
    offsetGuidance = `For ${requestedDiameter}s, I'd aim for offset in the +${aggressive.min} to +${aggressive.max} range - any lower and you're looking at fender mods`;
  } else {
    offsetGuidance = `Safe offset range is +${safe.min} to +${safe.max}`;
  }
  
  // Add platform-specific cultural notes
  guidance.push(...platform.culturalNotes.slice(0, 2));
  
  return {
    feasibility,
    guidance,
    staggeredSuggestion,
    offsetGuidance,
  };
}

/**
 * Check if a wheel size is realistic for a platform
 */
export function isRealisticWheelSize(
  platform: PlatformProfile,
  diameter: number
): boolean {
  const allSizes = [
    ...platform.enthusiastDiameters.conservative,
    ...platform.enthusiastDiameters.sweetSpot,
    ...platform.enthusiastDiameters.aggressive,
    ...platform.enthusiastDiameters.extreme,
  ];
  
  const maxSize = Math.max(...allSizes);
  return diameter <= maxSize + 2; // Allow 2" beyond documented extreme
}

/**
 * Get related platforms for surrogate search
 */
export function getRelatedPlatforms(platformId: string): PlatformProfile[] {
  const platform = PLATFORM_PROFILES.find(p => p.platformId === platformId);
  if (!platform) return [];
  
  return platform.relatedPlatforms
    .map(id => PLATFORM_PROFILES.find(p => p.platformId === id))
    .filter((p): p is PlatformProfile => p !== undefined);
}

/**
 * Get all platforms (for admin/diagnostics)
 */
export function getAllPlatforms(): PlatformProfile[] {
  return [...PLATFORM_PROFILES];
}

/**
 * Format platform guidance for Jake's response
 */
export function formatPlatformGuidanceForJake(
  platform: PlatformProfile,
  requestedDiameter?: number
): string {
  const lines: string[] = [];
  
  if (requestedDiameter) {
    const guidance = getEnthusiastGuidance(platform, requestedDiameter);
    lines.push(...guidance.guidance);
    
    if (guidance.staggeredSuggestion) {
      lines.push("");
      lines.push(guidance.staggeredSuggestion);
    }
    
    if (guidance.offsetGuidance) {
      lines.push("");
      lines.push(guidance.offsetGuidance);
    }
  } else {
    lines.push(...platform.culturalNotes.slice(0, 3));
  }
  
  // Add wheel donor info if relevant
  if (platform.wheelDonorPlatforms.length > 0) {
    const donors = platform.wheelDonorPlatforms
      .map(id => PLATFORM_PROFILES.find(p => p.platformId === id)?.name)
      .filter(Boolean);
    if (donors.length > 0) {
      lines.push("");
      lines.push(`Fun fact: ${donors.join(" and ")} wheels are a popular direct-fit option on these`);
    }
  }
  
  // Always add disclaimer
  lines.push("");
  lines.push("⚠️ This is enthusiast guidance - always verify final clearance before purchase.");
  
  return lines.join("\n");
}
