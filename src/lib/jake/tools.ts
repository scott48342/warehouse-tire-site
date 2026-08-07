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
    name: "generate_wheel_mockup",
    description: `Generate an AI mockup showing a wheel on the customer's vehicle.

USE AFTER: Customer has seen wheel options and says "show me" / "what would it look like" / picks a wheel.

FLOW:
1. You already showed wheel search results (which include imageUrl)
2. Customer picks one or asks to see it on their truck
3. Call this tool with the wheel's imageUrl from your search results
4. Show the generated image with disclaimer

REQUIRED DATA (you already have from search results):
- wheelSku: the sku field from search results (PREFERRED - server looks up the exact image)
- wheelBrand: brand name
- wheelModel: model name  
- wheelSize: diameter in inches

IMPORTANT: Pass the wheelSku (short product id like "D69618901857"). Do NOT try to copy the long image URL by hand - the server resolves the correct image and finish from the SKU automatically. Only pass wheelImageUrl as a fallback if no SKU is available.

DISCLAIMER (always say after showing):
"AI visual mockup only. Wheel shown is a representation and may not be exact. Final appearance may vary by trim, wheel size, offset, tire size, suspension, and lighting."`,
    input_schema: {
      type: "object" as const,
      properties: {
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" },
        color: { type: "string", description: "Vehicle color (black, white, red, silver, blue, etc.)" },
        wheelBrand: { type: "string", description: "Wheel brand from search results" },
        wheelModel: { type: "string", description: "Wheel model from search results" },
        wheelSku: { type: "string", description: "The sku from your search results (e.g., 'D69618901857'). PREFERRED - server resolves the exact image and finish from this." },
        wheelImageUrl: { type: "string", description: "Fallback only: the imageUrl from search results. Prefer passing wheelSku instead." },
        wheelFinish: { type: "string", description: "The finish/color description (e.g., 'Matte Bronze with Black Bead Ring', 'Gloss Black'). Server will override with authoritative finish if SKU is provided." },
        wheelSize: { type: "number", description: "Wheel diameter (e.g., 20, 22)" },
        tireSize: { type: "string", description: "Tire size if known (e.g., '275/60R20', '35x12.50R20')" },
        tireSku: { type: "string", description: "The sku/partNumber of the tire from search_tires results. If provided WITH tireSize, the server resolves the real tire image so the mockup shows the actual tread/sidewall." },
        tireBrand: { type: "string", description: "Tire brand from search_tires results (e.g., 'Hercules')" },
        tireModel: { type: "string", description: "Tire model from search_tires results (e.g., 'Terra Trac AT')" },
        tireTerrain: { type: "string", description: "Tire terrain category from search results (e.g., 'All-Terrain', 'Highway/Touring', 'Mud-Terrain')" },
        lift: { type: "string", description: "Lift level if known (e.g., 'stock', 'leveled', '4 inch lift')" }
      },
      required: ["year", "make", "model", "color", "wheelBrand", "wheelModel", "wheelSize"]
    }
  },
  {
    name: "web_search",
    description: `Search the web for information you don't have in your knowledge base.

USE THIS WHEN:
- Customer asks about fitment issues not in your database (rubbing, clearance, fender mods)
- Classic/custom cars with unusual setups
- "Will X fit?" questions where you're not confident
- Technical questions about wheel adapters, spacers, lift kits
- Forum discussions about specific builds
- Any real-world experience/advice questions

EXAMPLES:
- "65 Malibu 18 inch wheels rear fender clearance"
- "4th gen Camaro 275 tire rubbing fix"
- "F-150 leveling kit 35 inch tires"
- "wheel spacers safe for daily driving"

The search returns relevant results with snippets. Use the information to give the customer REAL, ACTIONABLE advice - not just "call the store".`,
    input_schema: {
      type: "object" as const,
      properties: {
        query: { 
          type: "string", 
          description: "Search query - be specific, include year/make/model and the problem" 
        },
        focus: {
          type: "string",
          description: "Optional focus: 'forums' for enthusiast discussions, 'technical' for specs/how-to",
          enum: ["general", "forums", "technical"]
        }
      },
      required: ["query"]
    }
  },
  {
    name: "fetch_webpage",
    description: `Fetch and read content from a specific URL. Use after web_search to get more detail from a promising result, or when customer shares a link.

USE THIS WHEN:
- web_search found a good forum thread and you need more detail
- Customer shares a link and asks about it
- You need to read a specific article/guide

Returns the main text content of the page (cleaned up, no ads/navigation).`,
    input_schema: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "Full URL to fetch" },
        maxLength: { type: "number", description: "Max characters to return (default 8000)" }
      },
      required: ["url"]
    }
  },
  {
    name: "build_cart",
    description: `Generate a ready-to-checkout cart link for the customer's selected wheels and/or tires. Call this whenever the customer agrees to a build, says they want to buy / check out / add to cart, or you've presented a final total. Pass every product they're buying (each wheel position and each tire position) using the sku/partNumber and price from your earlier search results. Returns a cartUrl the UI shows as a green "Your Cart is Ready" checkout button. For staggered setups include all front AND rear items with their correct quantities (usually 2 each). ALWAYS prefer this over telling the customer to call the store.`,
    input_schema: {
      type: "object" as const,
      properties: {
        items: {
          type: "array",
          description: "Every product in the build. One entry per distinct SKU (use quantity for multiples, e.g. 2 front + 2 rear = two entries qty 2).",
          items: {
            type: "object",
            properties: {
              sku: { type: "string", description: "SKU / partNumber from search results" },
              type: { type: "string", description: "'wheel' or 'tire'" },
              quantity: { type: "number", description: "How many of this item (front pair = 2, rear pair = 2, square set = 4)" },
              brand: { type: "string", description: "Brand name" },
              model: { type: "string", description: "Model name" },
              size: { type: "string", description: "Size, e.g. '20x9' or '245/45R20'" },
              price: { type: "number", description: "Per-unit price from search results" },
              imageUrl: { type: "string", description: "Product image URL from search results (optional)" }
            },
            required: ["sku", "type", "quantity"]
          }
        },
        year: { type: "number", description: "Vehicle year" },
        make: { type: "string", description: "Vehicle make" },
        model: { type: "string", description: "Vehicle model" }
      },
      required: ["items"]
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
    
    case "generate_wheel_mockup": {
      const { year, make, model, color, wheelBrand, wheelModel, wheelSku, wheelImageUrl, wheelFinish, wheelSize, tireSize, tireSku, tireBrand, tireModel, tireTerrain, lift } = input;
      
      console.log(`[Jake Tool] generate_wheel_mockup: ${color} ${year} ${make} ${model}`);
      console.log(`[Jake Tool] Wheel: ${wheelSize}" ${wheelBrand} ${wheelModel} - sku=${wheelSku || 'none'} - ${wheelFinish || 'unknown finish'}`);
      
      try {
        // Import and call the new clean mockup generator directly
        const { generateWheelMockup, MOCKUP_DISCLAIMER } = await import("./wheelMockup");
        
        // ─────────────────────────────────────────────────────────────────
        // RESOLVE AUTHORITATIVE IMAGE + FINISH FROM SKU (server-side)
        // The LLM is bad at copying long CDN URLs by hand, which caused
        // wrong-color / wrong-style mockups. If we have a SKU, look up the
        // real product image and finish from our own data instead of
        // trusting an LLM-pasted URL.
        // ─────────────────────────────────────────────────────────────────
        let resolvedImageUrl = wheelImageUrl ? String(wheelImageUrl) : "";
        let resolvedFinish = wheelFinish ? String(wheelFinish) : undefined;
        let resolvedBrand = String(wheelBrand || "");
        let resolvedModel = String(wheelModel || "");

        if (wheelSku) {
          try {
            const lookupUrl = `${baseUrl}/api/search?q=${encodeURIComponent(String(wheelSku))}`;
            console.log(`[Jake Tool] Resolving wheel image from SKU: ${lookupUrl}`);
            const lookupRes = await fetch(lookupUrl, { cache: "no-store" });
            if (lookupRes.ok) {
              const lookupData = await lookupRes.json() as any;
              const hit = (lookupData.results || []).find(
                (r: any) => r.type === "wheel" && String(r.sku) === String(wheelSku)
              ) || (lookupData.results || [])[0];
              if (hit?.image) {
                resolvedImageUrl = hit.image;
                if (hit.brand) resolvedBrand = hit.brand;
                if (hit.name) resolvedModel = hit.name;
                console.log(`[Jake Tool] ✅ Resolved image from SKU: ${resolvedImageUrl.substring(0, 70)}...`);
              } else {
                console.warn(`[Jake Tool] ⚠️ SKU ${wheelSku} returned no image; falling back to provided URL`);
              }
            } else {
              console.warn(`[Jake Tool] ⚠️ SKU lookup failed (${lookupRes.status}); using provided URL`);
            }
          } catch (lookupErr) {
            console.warn(`[Jake Tool] ⚠️ SKU lookup error: ${lookupErr}; using provided URL`);
          }
        }

        if (!resolvedImageUrl) {
          return {
            success: false,
            error: "No wheel image could be resolved (provide a valid wheelSku or wheelImageUrl)",
            disclaimer: MOCKUP_DISCLAIMER,
          };
        }

        // ─────────────────────────────────────────────────────────────────
        // RESOLVE TIRE IMAGE FROM SKU (same approach as wheels)
        // Tire search is by size, so we need tireSize + tireSku to resolve
        // the exact product image. Falls back to terrain text if unavailable.
        // ─────────────────────────────────────────────────────────────────
        let tireImageUrl: string | undefined;
        if (tireSku && tireSize) {
          try {
            const tParams = new URLSearchParams({ size: String(tireSize), partNumber: String(tireSku), limit: "1" });
            const tLookupUrl = `${baseUrl}/api/tires/search?${tParams}`;
            console.log(`[Jake Tool] Resolving tire image: ${tLookupUrl}`);
            const tRes = await fetch(tLookupUrl, { cache: "no-store" });
            if (tRes.ok) {
              const tData = await tRes.json() as any;
              const tHit = (tData.results || tData.tires || []).find(
                (t: any) => String(t.partNumber || t.sku) === String(tireSku)
              ) || (tData.results || tData.tires || [])[0];
              if (tHit?.imageUrl) {
                tireImageUrl = tHit.imageUrl;
                console.log(`[Jake Tool] ✅ Resolved tire image: ${String(tireImageUrl).substring(0, 70)}...`);
              } else {
                console.warn(`[Jake Tool] ⚠️ Tire ${tireSku} returned no image; using terrain fallback`);
              }
            }
          } catch (tErr) {
            console.warn(`[Jake Tool] ⚠️ Tire lookup error: ${tErr}; using terrain fallback`);
          }
        }

        const tireInput = (tireSize || tireSku || tireBrand || tireTerrain)
          ? {
              size: tireSize ? String(tireSize) : undefined,
              brand: tireBrand ? String(tireBrand) : undefined,
              model: tireModel ? String(tireModel) : undefined,
              imageUrl: tireImageUrl,
              terrain: tireTerrain ? String(tireTerrain) : undefined,
            }
          : undefined;

        const result = await generateWheelMockup({
          vehicle: {
            year: Number(year),
            make: String(make),
            model: String(model),
            color: String(color),
          },
          wheel: {
            brand: resolvedBrand,
            model: resolvedModel,
            imageUrl: resolvedImageUrl,
            finish: resolvedFinish,
            size: Number(wheelSize),
          },
          tire: tireInput,
          lift: lift ? String(lift) : undefined,
        });
        
        if (!result.success) {
          return {
            success: false,
            error: result.error || "Generation failed",
            disclaimer: MOCKUP_DISCLAIMER,
          };
        }
        
        return {
          success: true,
          imageUrl: result.imageUrl,
          disclaimer: MOCKUP_DISCLAIMER,
          cached: result.cached,
          generationTimeMs: result.generationTimeMs,
          confidence: result.confidence,
          method: result.method,
        };
      } catch (err) {
        return {
          success: false,
          error: `Generation failed: ${err}`,
          disclaimer: "AI visual mockup only. Wheel shown is a representation and may not be exact. Final appearance may vary by trim, wheel size, offset, tire size, suspension, and lighting.",
        };
      }
    }
    
    case "build_cart": {
      const { items, year, make, model } = input as {
        items: Array<Record<string, unknown>>;
        year?: number; make?: string; model?: string;
      };
      console.log(`[Jake Tool] build_cart: ${Array.isArray(items) ? items.length : 0} item(s)`);
      try {
        if (!Array.isArray(items) || items.length === 0) {
          return { success: false, error: "No items provided to build a cart." };
        }
        const res = await fetch(`${baseUrl}/api/ai/create-cart-link`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            items: items.map((it) => ({
              sku: String(it.sku || ""),
              type: String(it.type || "tire"),
              quantity: Number(it.quantity) || 1,
              brand: it.brand ? String(it.brand) : undefined,
              model: it.model ? String(it.model) : undefined,
              size: it.size ? String(it.size) : undefined,
              price: it.price != null ? Number(it.price) : undefined,
              imageUrl: it.imageUrl ? String(it.imageUrl) : undefined,
            })),
            vehicle: (year || make || model)
              ? { year: year ? Number(year) : undefined, make: make ? String(make) : undefined, model: model ? String(model) : undefined }
              : undefined,
          }),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.warn(`[Jake Tool] build_cart failed (${res.status}): ${txt.slice(0, 200)}`);
          return { success: false, error: `Cart link service returned ${res.status}` };
        }
        const data = await res.json() as any;
        const cartUrl = data.url || data.cartUrl;
        if (!cartUrl) return { success: false, error: "Cart link service returned no URL." };
        console.log(`[Jake Tool] ✅ build_cart → ${String(cartUrl).slice(0, 80)}`);
        return { success: true, cartUrl };
      } catch (err) {
        console.warn(`[Jake Tool] build_cart error: ${err}`);
        return { success: false, error: `Cart build failed: ${err}` };
      }
    }

    case "web_search": {
      const { query, focus } = input as { query: string; focus?: string };
      console.log(`[Jake Tool] web_search: "${query}" (focus: ${focus || 'general'})`);
      
      // Try Perplexity first (better for research queries), fall back to Brave
      const perplexityKey = process.env.PERPLEXITY_API_KEY;
      const braveKey = process.env.BRAVE_SEARCH_API_KEY;
      
      if (perplexityKey) {
        try {
          const res = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${perplexityKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                {
                  role: "system",
                  content: "You are a helpful automotive research assistant. Provide concise, factual answers about wheel/tire fitment, clearance issues, and modifications. Include specific measurements and real-world experiences when available. Cite sources when possible."
                },
                {
                  role: "user",
                  content: query
                }
              ],
              max_tokens: 1024,
              return_citations: true,
              search_recency_filter: "year"
            }),
          });
          
          if (res.ok) {
            const data = await res.json() as any;
            const answer = data.choices?.[0]?.message?.content || "";
            const citations = data.citations || [];
            console.log(`[Jake Tool] ✅ Perplexity returned ${answer.length} chars, ${citations.length} citations`);
            return {
              success: true,
              source: "perplexity",
              answer,
              citations: citations.slice(0, 5),
            };
          } else {
            console.warn(`[Jake Tool] Perplexity failed (${res.status}), trying Brave...`);
          }
        } catch (err) {
          console.warn(`[Jake Tool] Perplexity error: ${err}, trying Brave...`);
        }
      }
      
      if (braveKey) {
        try {
          const params = new URLSearchParams({
            q: query,
            count: "8",
            text_decorations: "false",
            search_lang: "en",
          });
          const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
            headers: { "X-Subscription-Token": braveKey },
          });
          
          if (res.ok) {
            const data = await res.json() as any;
            const results = (data.web?.results || []).slice(0, 6).map((r: any) => ({
              title: r.title,
              url: r.url,
              snippet: r.description,
            }));
            console.log(`[Jake Tool] ✅ Brave returned ${results.length} results`);
            return {
              success: true,
              source: "brave",
              results,
              tip: "Use fetch_webpage to get more detail from any of these URLs."
            };
          }
        } catch (err) {
          console.warn(`[Jake Tool] Brave search error: ${err}`);
        }
      }
      
      // Neither API available or both failed
      return {
        success: false,
        error: "Web search is not configured. Please ask the store for help with this question.",
        fallback: "Call us at (248) 332-4120 - we can research this for you!"
      };
    }

    case "fetch_webpage": {
      const { url, maxLength = 8000 } = input as { url: string; maxLength?: number };
      console.log(`[Jake Tool] fetch_webpage: ${url}`);
      
      try {
        // Use a readability-style extraction
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; WTDBot/1.0; +https://warehousetiredirect.com)",
            "Accept": "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
        
        if (!res.ok) {
          return { success: false, error: `Failed to fetch: ${res.status}` };
        }
        
        const html = await res.text();
        
        // Basic HTML to text extraction (strip tags, decode entities)
        let text = html
          // Remove script/style/nav/header/footer content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '')
          // Convert common elements to newlines
          .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, '\n')
          // Strip remaining tags
          .replace(/<[^>]+>/g, ' ')
          // Decode common entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          // Clean up whitespace
          .replace(/[ \t]+/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
        
        // Truncate if needed
        if (text.length > maxLength) {
          text = text.substring(0, maxLength) + "\n\n[... content truncated ...]";
        }
        
        console.log(`[Jake Tool] ✅ Fetched ${text.length} chars from ${url}`);
        return {
          success: true,
          url,
          content: text,
          charCount: text.length,
        };
      } catch (err) {
        console.warn(`[Jake Tool] fetch_webpage error: ${err}`);
        return { success: false, error: `Fetch failed: ${err}` };
      }
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
