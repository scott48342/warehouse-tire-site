/**
 * Jake's Fitment Tools
 * 
 * Tools that Jake can use to look up fitment data.
 * These call internal APIs directly since we're in the same codebase.
 */

import Anthropic from "@anthropic-ai/sdk";

// Base URL for API calls (internal calls go through the same host)
const getBaseUrl = () => {
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL || "https://shop.warehousetiredirect.com";
};

// Enthusiast platform knowledge for confident responses
const ENTHUSIAST_PLATFORMS: Record<string, {
  boltPattern: string;
  sweetSpotDiameters: number[];
  aggressiveDiameters: number[];
  staggeredCommon: boolean;
  relatedPlatforms: string[];
  confidence: string;
}> = {
  "4th_gen_fbody": {
    boltPattern: "5x120.65",
    sweetSpotDiameters: [18, 19, 20],
    aggressiveDiameters: [21, 22],
    staggeredCommon: true,
    relatedPlatforms: ["c5_corvette", "c4_corvette"],
    confidence: "20s are the sweet spot on these cars",
  },
  "c5_corvette": {
    boltPattern: "5x120.65",
    sweetSpotDiameters: [18, 19],
    aggressiveDiameters: [19, 20],
    staggeredCommon: true,
    relatedPlatforms: ["4th_gen_fbody", "c4_corvette"],
    confidence: "Factory staggered - embrace it",
  },
  "s197_mustang": {
    boltPattern: "5x114.3",
    sweetSpotDiameters: [19, 20],
    aggressiveDiameters: [20, 22],
    staggeredCommon: true,
    relatedPlatforms: ["s550_mustang"],
    confidence: "Massive aftermarket support",
  },
  "s550_mustang": {
    boltPattern: "5x114.3",
    sweetSpotDiameters: [19, 20],
    aggressiveDiameters: [20, 22],
    staggeredCommon: true,
    relatedPlatforms: ["s197_mustang"],
    confidence: "20s are basically standard at this point",
  },
  "mopar_lx": {
    boltPattern: "5x115",
    sweetSpotDiameters: [20],
    aggressiveDiameters: [22, 24],
    staggeredCommon: true,
    relatedPlatforms: [],
    confidence: "20s are the sweet spot",
  },
  "gm_truck_modern": {
    boltPattern: "6x139.7",
    sweetSpotDiameters: [20, 22],
    aggressiveDiameters: [22, 24],
    staggeredCommon: false,
    relatedPlatforms: [],
    confidence: "22s are basically standard now",
  },
  "ford_f150_modern": {
    boltPattern: "6x135",
    sweetSpotDiameters: [20, 22],
    aggressiveDiameters: [22, 24],
    staggeredCommon: false,
    relatedPlatforms: [],
    confidence: "22s are standard for street trucks",
  },
};

// Helper to detect enthusiast platform
function detectEnthusiastPlatform(year: number, make: string, model: string): string | null {
  const makeLower = make.toLowerCase();
  const modelLower = model.toLowerCase();
  
  // 4th Gen F-Body (1993-2002 Camaro/Firebird)
  if (year >= 1993 && year <= 2002) {
    if ((makeLower === "chevrolet" || makeLower === "chevy") && modelLower.includes("camaro")) {
      return "4th_gen_fbody";
    }
    if (makeLower === "pontiac" && (modelLower.includes("firebird") || modelLower.includes("trans am"))) {
      return "4th_gen_fbody";
    }
  }
  
  // C5 Corvette
  if (year >= 1997 && year <= 2004 && (makeLower === "chevrolet" || makeLower === "chevy") && modelLower.includes("corvette")) {
    return "c5_corvette";
  }
  
  // S197 Mustang
  if (year >= 2005 && year <= 2014 && makeLower === "ford" && modelLower.includes("mustang")) {
    return "s197_mustang";
  }
  
  // S550 Mustang
  if (year >= 2015 && year <= 2023 && makeLower === "ford" && modelLower.includes("mustang")) {
    return "s550_mustang";
  }
  
  // Mopar LX/LC
  if (year >= 2006 && (makeLower === "dodge" || makeLower === "chrysler")) {
    if (modelLower.includes("challenger") || modelLower.includes("charger") || modelLower.includes("300")) {
      return "mopar_lx";
    }
  }
  
  // Modern GM Trucks
  if (year >= 2014 && (makeLower === "chevrolet" || makeLower === "chevy" || makeLower === "gmc")) {
    if (modelLower.includes("silverado") || modelLower.includes("sierra")) {
      return "gm_truck_modern";
    }
  }
  
  // Modern F-150
  if (year >= 2015 && makeLower === "ford" && modelLower.includes("f-150")) {
    return "ford_f150_modern";
  }
  
  return null;
}

// Tool definitions for Claude
export const JAKE_TOOLS: Anthropic.Tool[] = [
  {
    name: "lookup_tire_sizes",
    description: `Look up OEM tire sizes for a specific vehicle. Returns tire sizes, bolt pattern, staggered info.
Use when customer asks "what tires fit X" or "what size tires for my Y".
Must have year, make, model. Trim is optional but improves accuracy for performance vehicles.`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year (e.g., 2024)" },
        make: { type: "string", description: "Vehicle make (e.g., Ford, Chevrolet, Toyota)" },
        model: { type: "string", description: "Vehicle model (e.g., F-150, Camaro, Camry)" },
        trim: { type: "string", description: "Vehicle trim/variant (optional)" }
      },
      required: ["year", "make", "model"]
    }
  },
  {
    name: "lookup_wheel_fitment",
    description: `Look up wheel fitment specs for a vehicle. Returns bolt pattern, center bore, offset range, and available wheel diameters.`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        trim: { type: "string", description: "Vehicle trim (optional)" }
      },
      required: ["year", "make", "model"]
    }
  },
  {
    name: "list_trims",
    description: `List available trims for a specific year/make/model.`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" }
      },
      required: ["year", "make", "model"]
    }
  },
  {
    name: "search_wheels",
    description: `Search for actual wheel products that fit a vehicle. Returns products with prices and links. Use excludeFinishes to filter out unwanted finishes (e.g., when customer says "no black wheels").`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        diameter: { type: "number", description: "Desired wheel diameter (e.g., 20)" },
        limit: { type: "number", description: "Max results (default 6)" },
        excludeFinishes: { 
          type: "array", 
          items: { type: "string" },
          description: "Finish types to exclude (e.g., ['black', 'matte black', 'gloss black']). Use when customer says they don't want certain colors."
        },
        preferFinish: { 
          type: "string", 
          description: "Preferred finish to prioritize (e.g., 'Chrome', 'Bronze', 'Gunmetal'). Results with this finish will appear first."
        }
      },
      required: ["year", "make", "model"]
    }
  },
  {
    name: "search_tires",
    description: `Search for tires by size or vehicle. Returns products with prices and links.`,
    input_schema: {
      type: "object" as const,
      properties: {
        size: { type: "string", description: "Tire size (e.g., 275/55R20)" },
        year: { type: "number", description: "Vehicle year (alternative to size)" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        limit: { type: "number", description: "Max results (default 6)" }
      },
      required: []
    }
  },
  {
    name: "get_platform_context",
    description: `Get enthusiast platform knowledge for a vehicle. Use this FIRST for muscle cars, trucks, and performance vehicles.`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" }
      },
      required: ["year", "make", "model"]
    }
  },
  {
    name: "generate_visual_mockup",
    description: `Generate a visual mockup showing approximate wheel/tire look on customer's vehicle.
    
USE FOR: Visual inspiration ONLY - NOT for fitment verification!
WHEN TO USE: After showing product options, offer: "Want to see a quick visual mockup of this on your vehicle?"
ALWAYS INCLUDE: The disclaimer that this is for visual inspiration only.

ACCURACY TIPS (Phase 3):
1. PART NUMBERS: Include wheelPartNumber and tirePartNumber when you have them from search results! This enables the system to look up actual product images for reference.
2. TIRE DETAILS: Include tireBrand and tireModel for better tire representation.
3. VEHICLE COLOR: Be specific (black, white, red, silver, gray, blue, etc.) - the color will be enforced exactly.

After generating, say something like:
"Here's a mockup to give you an idea of the vibe! This is for visual inspiration – the actual products may look slightly different. I'll verify exact fitment before we build your cart."`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        trim: { type: "string", description: "Vehicle trim (optional)" },
        color: { type: "string", description: "Vehicle color - MUST be specific (black, white, red, silver, gray, blue, etc.)" },
        buildStyle: { 
          type: "string", 
          description: "Build style: stock, leveled, lifted-2, lifted-4, lifted-6, or lowered"
        },
        wheelStyle: { type: "string", description: "Wheel description (brand model finish, e.g., 'Fuel Rebel D679 Matte Black')" },
        wheelSize: { type: "number", description: "Wheel diameter in inches (e.g., 20)" },
        wheelPartNumber: { type: "string", description: "Wheel SKU/part number from search results - enables image reference lookup!" },
        tireStyle: { 
          type: "string", 
          description: "Tire terrain type: all-terrain, mud-terrain, highway, performance, or all-season"
        },
        tireBrand: { type: "string", description: "Tire brand (e.g., 'Nitto', 'Toyo', 'BFGoodrich')" },
        tireModel: { type: "string", description: "Tire model (e.g., 'Terra Grappler G2', 'Open Country AT3')" },
        tirePartNumber: { type: "string", description: "Tire SKU/part number from search results - enables image reference lookup!" },
        tireSize: { type: "string", description: "Tire size (e.g., '285/50R22', '35x12.50R20')" }
      },
      required: ["year", "make", "model", "color", "wheelStyle", "wheelSize", "tireStyle"]
    }
  }
];

// Tool execution
export async function executeTool(
  toolName: string, 
  input: Record<string, unknown>
): Promise<unknown> {
  const baseUrl = getBaseUrl();
  
  switch (toolName) {
    case "lookup_tire_sizes": {
      const { year, make, model, trim } = input;
      const params = new URLSearchParams({
        year: String(year),
        make: String(make),
        model: String(model),
      });
      if (trim) params.set("trim", String(trim));
      
      const url = `${baseUrl}/api/vehicles/tire-sizes?${params}`;
      console.log(`[Jake Tool] lookup_tire_sizes: ${url}`);
      
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          return { error: `API error: ${res.status}` };
        }
        const data = await res.json() as any;
        return {
          tireSizes: data.tireSizes || [],
          staggered: data.staggered || null,
          boltPattern: data.fitment?.boltPattern || null,
          source: data.source,
        };
      } catch (err) {
        return { error: `Fetch error: ${err}` };
      }
    }
    
    case "lookup_wheel_fitment": {
      const { year, make, model, trim } = input;
      const params = new URLSearchParams({
        year: String(year),
        make: String(make),
        model: String(model),
      });
      if (trim) params.set("trim", String(trim));
      
      const url = `${baseUrl}/api/vehicles/tire-sizes?${params}`;
      const platform = detectEnthusiastPlatform(Number(year), String(make), String(model));
      const platformContext = platform ? ENTHUSIAST_PLATFORMS[platform] : null;
      
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok && platformContext) {
          return {
            boltPattern: platformContext.boltPattern,
            wheelDiameters: platformContext.sweetSpotDiameters,
            isEnthusiastPlatform: true,
            platformGuidance: platformContext.confidence,
          };
        }
        const data = await res.json() as any;
        
        const result: Record<string, any> = {
          boltPattern: data.fitment?.boltPattern || platformContext?.boltPattern || null,
          centerBore: data.fitment?.centerBore || null,
          wheelDiameters: data.wheelDiameters?.available || platformContext?.sweetSpotDiameters || [],
          staggered: data.staggered || null,
        };
        
        if (platformContext) {
          result.isEnthusiastPlatform = true;
          result.platformGuidance = platformContext.confidence;
          result.sweetSpotDiameters = platformContext.sweetSpotDiameters;
          result.staggeredCommon = platformContext.staggeredCommon;
        }
        
        return result;
      } catch (err) {
        if (platformContext) {
          return {
            boltPattern: platformContext.boltPattern,
            wheelDiameters: platformContext.sweetSpotDiameters,
            isEnthusiastPlatform: true,
            platformGuidance: platformContext.confidence,
          };
        }
        return { error: `Fetch error: ${err}` };
      }
    }
    
    case "list_trims": {
      const { year, make, model } = input;
      const params = new URLSearchParams({
        year: String(year),
        make: String(make),
        model: String(model),
      });
      
      const url = `${baseUrl}/api/vehicles/trims?${params}`;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { error: `API error: ${res.status}` };
        const data = await res.json() as any;
        return { trims: data.trims || [], count: data.trims?.length || 0 };
      } catch (err) {
        return { error: `Fetch error: ${err}` };
      }
    }
    
    case "search_wheels": {
      const { year, make, model, diameter, limit = 6, excludeFinishes, preferFinish } = input as {
        year: number; make: string; model: string; diameter?: number; limit?: number;
        excludeFinishes?: string[]; preferFinish?: string;
      };
      // Request more results if we're filtering, so we have enough after exclusion
      // When excluding finishes (like "no black"), we need to fetch A LOT more because
      // black wheels dominate most inventories (often 80%+ of results)
      const fetchLimit = excludeFinishes?.length ? Math.min(Number(limit) * 20, 200) : Number(limit);
      
      const params = new URLSearchParams({
        year: String(year),
        make: String(make),
        model: String(model),
      });
      if (diameter) params.set("diameter", String(diameter));
      params.set("limit", String(fetchLimit));
      
      // Pass preferFinish to API for server-side filtering (much more efficient)
      // This ensures we get results IN that finish, not just prioritize them client-side
      if (preferFinish) {
        params.set("finish", preferFinish);
      }
      
      const url = `${baseUrl}/api/wheels/fitment-search?${params}`;
      console.log(`[Jake Tool] search_wheels: ${url}${excludeFinishes ? ` (excluding: ${excludeFinishes.join(', ')})` : ''}`);
      
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { error: `API error: ${res.status}`, wheels: [] };
        const data = await res.json() as any;
        
        // Map the wheel API response to Jake's expected format
        // API returns wheels in 'results' array, not 'wheels'
        const wheelData = data.results || data.wheels || [];
        
        // Helper to check if a finish should be excluded
        const shouldExcludeFinish = (finishDesc: string, normalizedFinish: string): boolean => {
          if (!excludeFinishes?.length) return false;
          const lower = (finishDesc || "").toLowerCase();
          const normalizedLower = (normalizedFinish || "").toLowerCase();
          
          return excludeFinishes.some(exclude => {
            const excludeLower = exclude.toLowerCase();
            // Check for exact or partial matches
            return lower.includes(excludeLower) || 
                   normalizedLower.includes(excludeLower) ||
                   normalizedLower === excludeLower;
          });
        };
        
        // Helper to check if finish matches preference (for sorting)
        const matchesPreference = (finishDesc: string, normalizedFinish: string): boolean => {
          if (!preferFinish) return false;
          const prefLower = preferFinish.toLowerCase();
          const lower = (finishDesc || "").toLowerCase();
          const normalizedLower = (normalizedFinish || "").toLowerCase();
          return lower.includes(prefLower) || normalizedLower.includes(prefLower);
        };
        
        let wheels = wheelData.map((w: any) => {
          const brandName = w.brand?.description || w.brand || "Unknown";
          const diam = w.properties?.diameter || w.diameter || "";
          const width = w.properties?.width || w.width || "";
          // Use fancy_finish_desc as primary - it's more descriptive (e.g., "MACHINED W/ MATTE BLACK LIP")
          // abbreviated_finish_desc is too ambiguous (e.g., "Black / Machined" - which is which?)
          const finishDescription = w.properties?.fancy_finish_desc || w.properties?.abbreviated_finish_desc || w.finish || "";
          const finish = w.properties?.abbreviated_finish_desc || "";
          const msrp = w.prices?.msrp?.[0]?.currencyAmount;
          const price = msrp ? parseFloat(msrp) : null;
          const imageUrl = w.images?.[0]?.imageUrlLarge || w.imageUrl || null;
          // Extract style/model from title (e.g., "GRS 17X9 6X5.5 106 +0 S-BLK" -> "GRS")
          const style = w.title?.split(" ")?.[0] || w.style || "";
          
          return {
            name: `${brandName} ${style} ${diam}x${width}`,
            brand: brandName,
            model: style,
            sku: w.sku,
            price: price ? `$${price}` : "Call for price",
            priceNum: price,
            size: `${diam}x${width}`,
            finish,
            // IMPORTANT: finishDescription is the detailed finish - USE THIS FOR MOCKUPS
            // e.g., "MACHINED W/ MATTE BLACK LIP" tells you exactly what colors go where
            finishDescription,
            productUrl: `${baseUrl}/wheels/${w.sku}`,
            imageUrl,
            fitmentLabel: w.fitmentGuidance?.levelLabel || null,
            inStock: w.availability?.confirmed || false,
            _excluded: shouldExcludeFinish(finishDescription, finish),
            _preferred: matchesPreference(finishDescription, finish),
          };
        });
        
        // Filter out excluded finishes
        if (excludeFinishes?.length) {
          const beforeCount = wheels.length;
          wheels = wheels.filter((w: any) => !w._excluded);
          console.log(`[Jake Tool] Filtered ${beforeCount - wheels.length} wheels with excluded finishes`);
        }
        
        // Sort preferred finishes to the top
        if (preferFinish) {
          wheels.sort((a: any, b: any) => {
            if (a._preferred && !b._preferred) return -1;
            if (!a._preferred && b._preferred) return 1;
            return 0;
          });
        }
        
        // Clean up internal properties and limit results
        wheels = wheels.slice(0, Number(limit)).map((w: any) => {
          const { _excluded, _preferred, ...clean } = w;
          return clean;
        });
        
        const result = { 
          wheels, 
          count: wheels.length, 
          totalAvailable: data.totalCount || wheels.length,
          finishFilters: {
            excluded: excludeFinishes || [],
            preferred: preferFinish || null,
          }
        };
        
        // Add helpful message if we filtered everything out
        if (wheels.length === 0 && excludeFinishes?.length) {
          return {
            ...result,
            message: `No wheels found after excluding ${excludeFinishes.join(', ')} finishes. Try broadening the search or considering different finish options.`
          };
        }
        
        return result;
      } catch (err) {
        return { error: `Fetch error: ${err}`, wheels: [] };
      }
    }
    
    case "search_tires": {
      const { size, year, make, model, limit = 6 } = input;
      const params = new URLSearchParams();
      if (size) params.set("size", String(size));
      if (year) params.set("year", String(year));
      if (make) params.set("make", String(make));
      if (model) params.set("model", String(model));
      params.set("limit", String(limit));
      
      const url = `${baseUrl}/api/tires/search?${params}`;
      console.log(`[Jake Tool] search_tires: ${url}`);
      
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { error: `API error: ${res.status}`, tires: [] };
        const data = await res.json() as any;
        
        // API returns tires in 'results' array, not 'tires'
        const tireData = data.results || data.tires || [];
        
        // Check for no results with reason
        if (tireData.length === 0 && data.noResultsReason) {
          return { 
            tires: [], 
            count: 0, 
            noResults: true,
            reason: data.noResultsReason,
            oemSizes: data.oemTireSizes || [],
          };
        }
        
        const tires = tireData.slice(0, Number(limit)).map((t: any) => {
          // API uses 'price' for sell price, 'cost' for cost
          const sellPrice = t.price || t.sellPrice;
          const warrantyMiles = t.badges?.warrantyMiles || t.warrantyMiles;
          const terrain = t.badges?.terrain || t.enrichment?.treadCategory;
          
          return {
            name: `${t.brand} ${t.model}`,
            brand: t.brand,
            model: t.model,
            sku: t.partNumber || t.sku,
            price: sellPrice ? `$${sellPrice.toFixed(2)}` : "Call for price",
            priceNum: sellPrice,
            size: t.size,
            productUrl: `${baseUrl}/tires/${t.partNumber || t.sku}?source=${t.source?.includes('tireweb') ? 'tireweb' : 'usautoforce'}`,
            imageUrl: t.imageUrl,
            warranty: warrantyMiles ? `${Number(warrantyMiles).toLocaleString()} miles` : undefined,
            terrain,
            loadRange: t.enrichment?.loadRange || t.badges?.construction,
            inStock: (t.quantity?.primary || 0) >= 4,
          };
        });
        
        return { tires, count: tires.length };
      } catch (err) {
        return { error: `Fetch error: ${err}`, tires: [] };
      }
    }
    
    case "get_platform_context": {
      const { year, make, model } = input;
      const platform = detectEnthusiastPlatform(Number(year), String(make), String(model));
      
      if (!platform) {
        return {
          isEnthusiastPlatform: false,
          message: "Standard vehicle - use normal fitment lookup.",
        };
      }
      
      const data = ENTHUSIAST_PLATFORMS[platform];
      return {
        isEnthusiastPlatform: true,
        platformId: platform,
        boltPattern: data.boltPattern,
        sweetSpotDiameters: data.sweetSpotDiameters,
        aggressiveDiameters: data.aggressiveDiameters,
        staggeredCommon: data.staggeredCommon,
        confidence: data.confidence,
        guidance: {
          recommended: `${data.sweetSpotDiameters.join('" or ')}" wheels are the sweet spot`,
          staggered: data.staggeredCommon 
            ? "Staggered setups are super common" 
            : "Square setups are typical",
        },
      };
    }
    
    case "generate_visual_mockup": {
      const { year, make, model, trim, color, buildStyle, wheelStyle, wheelSize, wheelPartNumber, tireStyle, tireBrand, tireModel, tirePartNumber, tireSize } = input;
      
      const url = `${baseUrl}/api/jake/mockup`;
      console.log(`[Jake Tool] generate_visual_mockup: ${color} ${year} ${make} ${model} with ${wheelStyle}`);
      if (wheelPartNumber) {
        console.log(`[Jake Tool] Wheel PN: ${wheelPartNumber}`);
      }
      if (tireBrand && tireModel) {
        console.log(`[Jake Tool] Tire: ${tireBrand} ${tireModel}`);
      }
      if (tirePartNumber) {
        console.log(`[Jake Tool] Tire PN: ${tirePartNumber}`);
      }
      
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle: {
              year: Number(year),
              make: String(make),
              model: String(model),
              trim: trim ? String(trim) : undefined,
              color: String(color),
            },
            build: {
              style: buildStyle || "stock",
              wheelStyle: String(wheelStyle),
              wheelSize: Number(wheelSize),
              tireStyle: String(tireStyle),
              // Phase 2: Include tire brand/model for better accuracy
              tireBrand: tireBrand ? String(tireBrand) : undefined,
              tireModel: tireModel ? String(tireModel) : undefined,
              tireSize: tireSize ? String(tireSize) : undefined,
              // Phase 3: Include part numbers for image lookup
              wheelPartNumber: wheelPartNumber ? String(wheelPartNumber) : undefined,
              tirePartNumber: tirePartNumber ? String(tirePartNumber) : undefined,
            },
          }),
        });
        
        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          return {
            success: false,
            error: error.error || `API error: ${res.status}`,
            disclaimer: "Mockup is for visual inspiration only.",
          };
        }
        
        const data = await res.json();
        return {
          success: true,
          imageUrl: data.imageUrl,
          disclaimer: data.disclaimer,
          generationMethod: data.generationMethod,
          cached: data.cached,
          generationTime: data.generationTime,
          // Phase 2: Include confidence and product metadata
          confidence: data.confidence,
          productMeta: data.productMeta,
        };
      } catch (err) {
        return {
          success: false,
          error: `Generation failed: ${err}`,
          disclaimer: "Mockup is for visual inspiration only.",
        };
      }
    }
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
