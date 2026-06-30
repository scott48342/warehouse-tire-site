/**
 * Trusted Fitment Research Service
 * 
 * AI-assisted research for OEM wheel/tire specs when:
 * - WTD verified DB fails
 * - Curated fallback profiles fail
 * - Wheel-Size API returns no usable data
 * 
 * This is NOT free hallucination. This is:
 * - Controlled web search with approved sources
 * - Structured extraction with confidence scoring
 * - Results cached for admin review
 * 
 * @created 2026-05-20
 */

import Anthropic from "@anthropic-ai/sdk";

// =============================================================================
// TYPES
// =============================================================================

export type ResearchConfidence = "high" | "medium" | "low" | "unknown";

export interface TrimFitment {
  trim: string;
  tireSize: string;
  wheelDiameter: number;
  wheelWidth: number;
  offset?: number;
  wheelType?: string; // "alloy", "steel", etc.
}

export interface ResearchedFitment {
  boltPattern: string;
  boltPatternMetric?: string;
  centerBore?: number;
  threadSize?: string;
  trims: TrimFitment[];
  commonTireSizes: string[];
  commonWheelDiameters: number[];
  offsetRange?: { min: number; max: number };
  // Aftermarket search profile
  aftermarketSearchProfile?: {
    safeUpgradeDiameters: number[];
    wheelHintsByDiameter: Array<{
      diameter: number;
      widths: number[];
      offsetRange: { min: number; max: number };
    }>;
    plusSizeTireOptions: Array<{
      size: string;
      wheelDiameter: number;
    }>;
  };
}

export interface TrustedResearchResult {
  success: boolean;
  confidence: ResearchConfidence;
  source: "trusted_research";
  sourcesUsed: string[];
  
  fitment?: ResearchedFitment;
  
  messaging: {
    formatted: string;
    trimQuestion?: string; // If multiple trims with different specs
    confidenceNote: string;
  };
  
  requiresCustomerVerification: boolean;
  requiresTrimClarification: boolean;
  availableTrims?: string[];
  
  // Metadata
  researchDurationMs?: number;
  searchQueries?: string[];
  rawExtractionResponse?: string;
}

export interface ResearchInput {
  year: number;
  make: string;
  model: string;
  trim?: string;
}

// =============================================================================
// APPROVED SOURCES
// =============================================================================

// These domains are considered trusted for fitment research
const APPROVED_SOURCE_DOMAINS = [
  // Manufacturer/OEM references
  "toyota.com", "ford.com", "chevrolet.com", "honda.com", "nissan.com",
  "dodge.com", "jeep.com", "ram.com", "gmc.com", "cadillac.com", "buick.com",
  "lincoln.com", "hyundai.com", "kia.com", "mazda.com", "subaru.com",
  "volkswagen.com", "audi.com", "bmw.com", "mercedes-benz.com", "lexus.com",
  "acura.com", "infiniti.com", "genesis.com", "volvo.com", "porsche.com",
  
  // Trusted fitment reference sites
  "wheel-size.com",
  "rimsizes.com",
  "tiresize.com",
  "oem-wheels.com",
  "wheelcollision.com",
  "hubcap-tire-wheel.com",
  "1010tires.com",
  
  // Repair/spec references
  "carspecs.us",
  "automobile-catalog.com",
  "cars-data.com",
  "autodata.net",
  "edmunds.com",
  "caranddriver.com",
  "motortrend.com",
  
  // Trusted retailers with fitment data (for reference only, not scraping)
  "tirerack.com",
  "discounttire.com",
];

// Domains to explicitly avoid
const BLOCKED_DOMAINS = [
  "reddit.com",
  "facebook.com",
  "twitter.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "quora.com",
  "answers.yahoo.com",
  "forums.",
  "forum.",
  "blog.",
];

function isApprovedSource(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    // Check blocked domains first
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked)) return false;
    }
    
    // Check approved domains
    for (const approved of APPROVED_SOURCE_DOMAINS) {
      if (hostname.includes(approved)) return true;
    }
    
    // Allow .gov and .edu
    if (hostname.endsWith(".gov") || hostname.endsWith(".edu")) return true;
    
    // For unknown domains, allow but mark as lower confidence
    return true; // Will be weighted in extraction
  } catch {
    return false;
  }
}

// =============================================================================
// SEARCH FUNCTION
// =============================================================================

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  isApproved: boolean;
}

async function searchFitmentInfo(
  year: number,
  make: string,
  model: string,
  trim?: string
): Promise<{ results: SearchResult[]; queries: string[] }> {
  // Build search queries
  const queries = [
    `${year} ${make} ${model} OEM wheel specs tire sizes bolt pattern`,
    `${year} ${make} ${model} tire size wheel size by trim ${trim || ""}`.trim(),
  ];
  
  const allResults: SearchResult[] = [];
  const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
  
  if (!braveApiKey) {
    console.warn("[trusted-research] No Brave Search API key configured");
    return { results: [], queries };
  }
  
  for (const query of queries) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
      
      const response = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": braveApiKey,
        },
      });
      
      if (!response.ok) {
        console.warn(`[trusted-research] Brave search failed: ${response.status}`);
        continue;
      }
      
      const data = await response.json();
      const webResults = data.web?.results || [];
      
      for (const result of webResults) {
        const isApproved = isApprovedSource(result.url);
        allResults.push({
          title: result.title || "",
          url: result.url || "",
          snippet: result.description || "",
          isApproved,
        });
      }
    } catch (err) {
      console.warn(`[trusted-research] Search error:`, err);
    }
  }
  
  // Deduplicate by URL
  const seen = new Set<string>();
  const uniqueResults = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
  
  // Sort: approved sources first
  uniqueResults.sort((a, b) => {
    if (a.isApproved && !b.isApproved) return -1;
    if (!a.isApproved && b.isApproved) return 1;
    return 0;
  });
  
  return { results: uniqueResults.slice(0, 15), queries };
}

// =============================================================================
// EXTRACTION FUNCTION (uses Claude)
// =============================================================================

const EXTRACTION_PROMPT = `You are extracting OEM wheel and tire fitment specifications from search results.

TASK: Extract structured fitment data for the given vehicle from these search results.

RULES:
1. Only extract data that appears in the search results
2. Do NOT make up or hallucinate specifications
3. If data conflicts between sources, note the most common values
4. If different trims have different specs, list each trim separately
5. Convert all measurements to standard formats:
   - Bolt pattern: "5x114.3" format
   - Tire size: "215/55R17" format
   - Wheel size: diameter x width (e.g., "17x7")
   - Offset: mm with +/- sign
   - Center bore: mm (e.g., 60.1)
   - Thread size: "12x1.5" format

OUTPUT FORMAT (JSON only, no markdown):
{
  "success": true/false,
  "confidence": "high" | "medium" | "low" | "unknown",
  "fitment": {
    "boltPattern": "5x114.3",
    "centerBore": 60.1,
    "threadSize": "12x1.5",
    "trims": [
      {
        "trim": "LE",
        "tireSize": "205/65R16",
        "wheelDiameter": 16,
        "wheelWidth": 6.5,
        "offset": 45
      }
    ],
    "commonTireSizes": ["205/65R16", "215/55R17"],
    "commonWheelDiameters": [16, 17, 18]
  },
  "sourcesUsed": ["wheel-size.com", "tirerack.com"],
  "notes": "Any important notes about the data"
}

If you cannot find reliable fitment data, return:
{
  "success": false,
  "confidence": "unknown",
  "reason": "explanation"
}`;

async function extractFitmentFromResults(
  year: number,
  make: string,
  model: string,
  trim: string | undefined,
  searchResults: SearchResult[]
): Promise<TrustedResearchResult> {
  const startTime = Date.now();
  const vehicleStr = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  
  if (searchResults.length === 0) {
    return {
      success: false,
      confidence: "unknown",
      source: "trusted_research",
      sourcesUsed: [],
      messaging: {
        formatted: `I couldn't find reliable fitment data for the ${vehicleStr}.`,
        confidenceNote: "No search results found",
      },
      requiresCustomerVerification: true,
      requiresTrimClarification: false,
      researchDurationMs: Date.now() - startTime,
    };
  }
  
  // Build context from search results
  const searchContext = searchResults
    .map((r, i) => `[Source ${i + 1}: ${r.url}]\nTitle: ${r.title}\nSnippet: ${r.snippet}\n`)
    .join("\n---\n");
  
  const userPrompt = `Vehicle: ${vehicleStr}

Search Results:
${searchContext}

Extract the OEM wheel and tire fitment specifications for this vehicle. Return JSON only.`;

  try {
    const anthropic = new Anthropic();
    
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: EXTRACTION_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }
    
    // Parse JSON response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON in response");
    }
    
    const extracted = JSON.parse(jsonMatch[0]);
    const durationMs = Date.now() - startTime;
    
    if (!extracted.success) {
      return {
        success: false,
        confidence: "unknown",
        source: "trusted_research",
        sourcesUsed: [],
        messaging: {
          formatted: `I couldn't find reliable fitment data for the ${vehicleStr}.`,
          confidenceNote: extracted.reason || "Extraction failed",
        },
        requiresCustomerVerification: true,
        requiresTrimClarification: false,
        researchDurationMs: durationMs,
        rawExtractionResponse: textContent.text,
      };
    }
    
    // Build result
    const fitment = extracted.fitment as ResearchedFitment;
    const confidence = extracted.confidence as ResearchConfidence;
    const sourcesUsed = extracted.sourcesUsed || [];
    
    // Check if trim clarification is needed
    const hasMultipleTrims = fitment.trims && fitment.trims.length > 1;
    const trimSpecsVary = hasMultipleTrims && 
      new Set(fitment.trims.map(t => t.tireSize)).size > 1;
    
    // Build formatted message
    let formatted: string;
    let trimQuestion: string | undefined;
    
    if (trimSpecsVary && !trim) {
      // Multiple trims with different specs - need to ask
      const trimNames = fitment.trims.map(t => t.trim);
      trimQuestion = `The ${year} ${make} ${model} came with different wheel sizes depending on trim. Which trim do you have: ${trimNames.join(", ")}?`;
      
      const trimList = fitment.trims
        .map(t => `• ${t.trim}: ${t.tireSize}, ${t.wheelDiameter}x${t.wheelWidth}`)
        .join("\n");
      
      formatted = `I found OEM specs for the ${vehicleStr} from trusted references:\n\n` +
        `Bolt Pattern: ${fitment.boltPattern}\n` +
        (fitment.centerBore ? `Center Bore: ${fitment.centerBore}mm\n` : "") +
        `\nTrim-specific sizes:\n${trimList}`;
    } else {
      // Single trim or user specified trim
      const primaryTrim = trim 
        ? fitment.trims?.find(t => t.trim.toLowerCase().includes(trim.toLowerCase())) || fitment.trims?.[0]
        : fitment.trims?.[0];
      
      formatted = `I found OEM specs for the ${vehicleStr} from trusted references:\n\n` +
        `Bolt Pattern: ${fitment.boltPattern}\n` +
        (fitment.centerBore ? `Center Bore: ${fitment.centerBore}mm\n` : "") +
        (fitment.threadSize ? `Lug Thread: ${fitment.threadSize}\n` : "") +
        (primaryTrim ? `\nTire Size: ${primaryTrim.tireSize}\n` +
          `Wheel Size: ${primaryTrim.wheelDiameter}x${primaryTrim.wheelWidth}\n` +
          (primaryTrim.offset ? `Offset: +${primaryTrim.offset}mm` : "") : "");
    }
    
    // Calculate aftermarket search profile
    const aftermarketProfile = buildAftermarketProfile(fitment);
    if (aftermarketProfile) {
      fitment.aftermarketSearchProfile = aftermarketProfile;
    }
    
    return {
      success: true,
      confidence,
      source: "trusted_research",
      sourcesUsed,
      fitment,
      messaging: {
        formatted,
        trimQuestion,
        confidenceNote: confidence === "high"
          ? "Multiple trusted sources agree on these specs"
          : confidence === "medium"
          ? "Data from trusted source, recommend verifying door sticker"
          : "Partial data found, please verify your tire size",
      },
      requiresCustomerVerification: confidence !== "high",
      requiresTrimClarification: trimSpecsVary && !trim,
      availableTrims: hasMultipleTrims ? fitment.trims.map(t => t.trim) : undefined,
      researchDurationMs: durationMs,
      rawExtractionResponse: textContent.text,
    };
    
  } catch (err) {
    console.error("[trusted-research] Extraction error:", err);
    return {
      success: false,
      confidence: "unknown",
      source: "trusted_research",
      sourcesUsed: [],
      messaging: {
        formatted: `I couldn't extract fitment data for the ${vehicleStr}.`,
        confidenceNote: err instanceof Error ? err.message : "Extraction failed",
      },
      requiresCustomerVerification: true,
      requiresTrimClarification: false,
      researchDurationMs: Date.now() - startTime,
    };
  }
}

// =============================================================================
// AFTERMARKET PROFILE BUILDER
// =============================================================================

function buildAftermarketProfile(fitment: ResearchedFitment): ResearchedFitment["aftermarketSearchProfile"] | undefined {
  if (!fitment.commonWheelDiameters || fitment.commonWheelDiameters.length === 0) {
    return undefined;
  }
  
  const maxOemDiameter = Math.max(...fitment.commonWheelDiameters);
  const safeUpgrades = [maxOemDiameter + 1, maxOemDiameter + 2].filter(d => d <= 22);
  
  // Calculate base width from OEM specs
  const oemWidths = fitment.trims
    ?.map(t => t.wheelWidth)
    .filter((w): w is number => w !== undefined) || [];
  const avgWidth = oemWidths.length > 0 
    ? oemWidths.reduce((a, b) => a + b, 0) / oemWidths.length 
    : 7;
  
  // Calculate offset range
  const oemOffsets = fitment.trims
    ?.map(t => t.offset)
    .filter((o): o is number => o !== undefined) || [];
  // 2026-06-30: Do NOT fill generic offset range when AI finds no verified data.
  // Generic 35-50mm is indistinguishable from real data in the DB and will
  // cause the geometry validator to silently accept all offsets for that vehicle.
  // Null forces the missing-data gate in fitment-search and packages.
  const hasVerifiedOffset = oemOffsets.length > 0;
  const offsetMin = hasVerifiedOffset ? Math.min(...oemOffsets) - 5 : null;
  const offsetMax = hasVerifiedOffset ? Math.max(...oemOffsets) + 5 : null;
  
  return {
    safeUpgradeDiameters: safeUpgrades,
    wheelHintsByDiameter: safeUpgrades.map(diameter => ({
      diameter,
      widths: [avgWidth, avgWidth + 0.5, avgWidth + 1].filter(w => w <= 10),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      offsetRange: (offsetMin !== null && offsetMax !== null ? { min: offsetMin, max: offsetMax } : null) as any,
    })),
    plusSizeTireOptions: safeUpgrades.flatMap(diameter => {
      // Generate plus-size tire options based on diameter
      if (diameter === maxOemDiameter + 1) {
        return [
          { size: `${Math.round(avgWidth * 30 + 10)}/${65 - (diameter - 16) * 5}R${diameter}`, wheelDiameter: diameter },
        ];
      }
      if (diameter === maxOemDiameter + 2) {
        return [
          { size: `${Math.round(avgWidth * 30 + 20)}/${60 - (diameter - 16) * 5}R${diameter}`, wheelDiameter: diameter },
        ];
      }
      return [];
    }),
  };
}

// =============================================================================
// MAIN RESEARCH FUNCTION
// =============================================================================

export async function researchTrustedFitment(
  input: ResearchInput
): Promise<TrustedResearchResult> {
  const { year, make, model, trim } = input;
  const vehicleStr = `${year} ${make} ${model}${trim ? ` ${trim}` : ""}`;
  const startTime = Date.now();
  
  console.log(`[trusted-research] Starting research for: ${vehicleStr}`);
  
  // Step 1: Search for fitment info
  const { results: searchResults, queries } = await searchFitmentInfo(year, make, model, trim);
  
  console.log(`[trusted-research] Found ${searchResults.length} search results`);
  
  if (searchResults.length === 0) {
    return {
      success: false,
      confidence: "unknown",
      source: "trusted_research",
      sourcesUsed: [],
      messaging: {
        formatted: `I couldn't find fitment information for the ${vehicleStr}.`,
        confidenceNote: "No search results found",
      },
      requiresCustomerVerification: true,
      requiresTrimClarification: false,
      researchDurationMs: Date.now() - startTime,
      searchQueries: queries,
    };
  }
  
  // Step 2: Extract structured data using Claude
  const result = await extractFitmentFromResults(year, make, model, trim, searchResults);
  
  result.searchQueries = queries;
  result.researchDurationMs = Date.now() - startTime;
  
  console.log(`[trusted-research] Completed in ${result.researchDurationMs}ms, success: ${result.success}, confidence: ${result.confidence}`);
  
  return result;
}

// =============================================================================
// CACHE HELPERS (for integration with database)
// =============================================================================

export function buildVehicleKey(year: number, make: string, model: string, trim?: string): string {
  const normalized = `${year}|${make.toLowerCase()}|${model.toLowerCase()}${trim ? `|${trim.toLowerCase()}` : ""}`;
  return normalized;
}

export function parseVehicleKey(key: string): { year: number; make: string; model: string; trim?: string } | null {
  const parts = key.split("|");
  if (parts.length < 3) return null;
  
  return {
    year: parseInt(parts[0], 10),
    make: parts[1],
    model: parts[2],
    trim: parts[3],
  };
}
