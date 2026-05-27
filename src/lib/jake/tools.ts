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
    description: `Search for actual wheel products that fit a vehicle. Returns products with prices and links.`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        diameter: { type: "number", description: "Desired wheel diameter (e.g., 20)" },
        limit: { type: "number", description: "Max results (default 6)" }
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
      const { year, make, model, diameter, limit = 6 } = input;
      const params = new URLSearchParams({
        year: String(year),
        make: String(make),
        model: String(model),
      });
      if (diameter) params.set("diameter", String(diameter));
      params.set("limit", String(limit));
      
      const url = `${baseUrl}/api/wheels/fitment-search?${params}`;
      console.log(`[Jake Tool] search_wheels: ${url}`);
      
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return { error: `API error: ${res.status}`, wheels: [] };
        const data = await res.json() as any;
        
        // Map the wheel API response to Jake's expected format
        // API returns wheels in 'results' array, not 'wheels'
        const wheelData = data.results || data.wheels || [];
        const wheels = wheelData.slice(0, Number(limit)).map((w: any) => {
          const brandName = w.brand?.description || w.brand || "Unknown";
          const diam = w.properties?.diameter || w.diameter || "";
          const width = w.properties?.width || w.width || "";
          const finish = w.properties?.abbreviated_finish_desc || w.properties?.fancy_finish_desc || w.finish || "";
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
            productUrl: `${baseUrl}/wheels/${w.sku}`,
            imageUrl,
            fitmentLabel: w.fitmentGuidance?.levelLabel || null,
            inStock: w.availability?.confirmed || false,
          };
        });
        
        return { wheels, count: wheels.length, totalAvailable: data.totalCount || wheels.length };
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
        
        const tires = (data.tires || []).slice(0, Number(limit)).map((t: any) => ({
          name: `${t.brand} ${t.model}`,
          brand: t.brand,
          model: t.model,
          sku: t.sku,
          price: t.sellPrice ? `$${t.sellPrice}` : "Call for price",
          priceNum: t.sellPrice,
          size: t.size,
          productUrl: `${baseUrl}/tires/${t.sku}`,
          imageUrl: t.imageUrl,
          warranty: t.warrantyMiles ? `${Number(t.warrantyMiles).toLocaleString()} miles` : undefined,
        }));
        
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
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
