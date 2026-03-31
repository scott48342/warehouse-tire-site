/**
 * Tire Description Parser
 * 
 * Extracts clean model names from cryptic supplier descriptions.
 * 
 * K&M format: "LH 265/60R20/E*LIONCLAW ATX2" → "Lionclaw ATX2"
 * WheelPros format: "TRAILTEK RT LT275/55R20 120/117Q E 32.1" → "Trailtek RT"
 */

// Known brand codes used by K&M
const KM_BRAND_CODES: Record<string, string> = {
  'LH': 'Lionhart',
  'LX': 'Lexani',
  'RB': 'RBP',
  'IH': 'Ironhead',
  'TH': 'Thunderer',
  'KD': 'Kenda',
  'NX': 'Nexen',
  'HK': 'Hankook',
  'YK': 'Yokohama',
  'GY': 'Goodyear',
  'CT': 'Continental',
  'MC': 'Mastercraft',
  'ML': 'Milestar',
  'BF': 'BFGoodrich',
  'MI': 'Michelin',
  'PI': 'Pirelli',
  'TO': 'Toyo',
  'NI': 'Nitto',
  'FI': 'Firestone',
  'CO': 'Cooper',
  'FT': 'Falken',
  'KU': 'Kumho',
  'GE': 'General',
  'UN': 'Uniroyal',
  'DU': 'Dunlop',
  'BR': 'Bridgestone',
  'SM': 'Sumitomo',
  'AC': 'Achilles',
  'AT': 'Atturo',
  'FU': 'Fury',
  'KY': 'Kenda',
  'VN': 'Venom',
  'TY': 'Toyo',
};

// Tire size patterns to strip out
const SIZE_PATTERNS = [
  /\b\d{2,3}\/\d{2,3}R\d{2}\b/i,           // 265/60R20
  /\bLT\d{2,3}\/\d{2,3}R\d{2}\b/i,         // LT265/60R20
  /\bP\d{2,3}\/\d{2,3}R\d{2}\b/i,          // P265/60R20
  /\b\d{2,3}x\d+\.?\d*R\d{2}\b/i,          // 35x12.50R20
  /\b\d{2}x\d+\.?\d*-\d{2}\b/i,            // 33x12.50-20
  /\b\d{1,2}\.\d-\d{2}\b/i,                // 11.2-24 (ag tires)
  /\bAT\s*\d{2}X\d+-\d{2}\b/i,             // AT 33X9-20 (ag tires)
];

// Specs to strip from end (load index, speed rating, ply rating, diameter)
const TRAILING_SPECS = /\s+(\d{2,3}\/?\d*[QHSTWVY]?\s*)?([A-Z]\d*)?\s*\d+\.?\d*$/i;

// Load range patterns
const LOAD_RANGE = /\/[A-Z]+\*?/g;

export interface ParsedTire {
  model: string;
  modelNormalized: string;  // lowercase, no spaces, for matching
  brand: string | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Parse a K&M tire description to extract clean model name
 */
export function parseKmDescription(description: string, brand?: string): ParsedTire {
  let model = description.trim();
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // Remove brand code prefix (first 2-3 chars if they match a known code)
  const brandCodeMatch = model.match(/^([A-Z]{2,3})\s+/i);
  if (brandCodeMatch) {
    const code = brandCodeMatch[1].toUpperCase();
    if (KM_BRAND_CODES[code]) {
      model = model.slice(brandCodeMatch[0].length);
    }
  }
  
  // Remove tire size
  for (const pattern of SIZE_PATTERNS) {
    model = model.replace(pattern, ' ');
  }
  
  // Remove load range
  model = model.replace(LOAD_RANGE, ' ');
  
  // Remove asterisks
  model = model.replace(/\*/g, ' ');
  
  // Remove trailing specs (load index, speed rating, diameter)
  model = model.replace(TRAILING_SPECS, '');
  
  // Clean up whitespace
  model = model.replace(/\s+/g, ' ').trim();
  
  // If model starts with brand name, optionally keep or remove it
  // e.g., "RBP GUARANTOR HT" - keep as "Guarantor HT" since brand is known
  if (brand) {
    const brandUpper = brand.toUpperCase();
    const modelUpper = model.toUpperCase();
    if (modelUpper.startsWith(brandUpper + ' ')) {
      model = model.slice(brand.length + 1);
    }
    // Also check common abbreviations
    const abbrevMatch = Object.entries(KM_BRAND_CODES).find(([_, b]) => 
      b.toUpperCase() === brandUpper
    );
    if (abbrevMatch && modelUpper.startsWith(abbrevMatch[0] + ' ')) {
      model = model.slice(abbrevMatch[0].length + 1);
    }
  }
  
  // Title case the model name
  model = titleCase(model);
  
  // Determine confidence
  if (model.length < 3) {
    confidence = 'low';
  } else if (model.length < 6 || /^\d+$/.test(model)) {
    confidence = 'medium';
  }
  
  return {
    model,
    modelNormalized: model.toLowerCase().replace(/[\s\-]/g, ''),
    brand: brand || null,
    confidence,
  };
}

/**
 * Parse a WheelPros tire description to extract clean model name
 */
export function parseWheelProsDescription(description: string, brand?: string): ParsedTire {
  let model = description.trim();
  let confidence: 'high' | 'medium' | 'low' = 'high';
  
  // WheelPros format: MODEL SIZE SPECS
  // Find where the size starts and take everything before it
  let sizeStart = model.length;
  for (const pattern of SIZE_PATTERNS) {
    const match = model.match(pattern);
    if (match && match.index !== undefined && match.index < sizeStart) {
      sizeStart = match.index;
    }
  }
  
  if (sizeStart > 0 && sizeStart < model.length) {
    model = model.slice(0, sizeStart).trim();
  } else {
    // No size found, try removing trailing specs
    model = model.replace(TRAILING_SPECS, '').trim();
    confidence = 'medium';
  }
  
  // Title case
  model = titleCase(model);
  
  if (model.length < 3) {
    confidence = 'low';
  }
  
  return {
    model,
    modelNormalized: model.toLowerCase().replace(/[\s\-]/g, ''),
    brand: brand || null,
    confidence,
  };
}

/**
 * Smart title case that handles abbreviations
 */
function titleCase(str: string): string {
  // Words that should stay uppercase
  const keepUpper = ['AT', 'HT', 'MT', 'RT', 'LT', 'HP', 'UHP', 'II', 'III', 'IV', 'SL', 'XL'];
  
  return str
    .toLowerCase()
    .split(/(\s+)/)
    .map(word => {
      const upper = word.toUpperCase();
      if (keepUpper.includes(upper)) {
        return upper;
      }
      // Check for model numbers like "LXHT-206" - keep the number part
      if (/^[a-z]+-\d+$/i.test(word)) {
        return word.toUpperCase();
      }
      // Standard title case
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Parse any tire description (auto-detects source)
 */
export function parseTireDescription(
  description: string, 
  brand?: string,
  source?: 'km' | 'wheelpros' | 'tirewire'
): ParsedTire {
  if (!description) {
    return {
      model: '',
      modelNormalized: '',
      brand: brand || null,
      confidence: 'low',
    };
  }
  
  // Auto-detect source if not provided
  if (!source) {
    // K&M descriptions typically start with 2-letter brand code + size
    const looksLikeKm = /^[A-Z]{2}\s+\d{2,3}[\/x]/i.test(description);
    source = looksLikeKm ? 'km' : 'wheelpros';
  }
  
  if (source === 'km') {
    return parseKmDescription(description, brand);
  } else {
    return parseWheelProsDescription(description, brand);
  }
}
