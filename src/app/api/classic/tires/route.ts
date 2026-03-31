/**
 * Classic Tire Search API
 * 
 * GET /api/classic/tires?year=1969&make=chevrolet&model=camaro&wheelDiameter=17
 * 
 * Returns tire options for classic vehicles with proper upsizing
 * based on stock tire size and selected wheel diameter.
 * 
 * ONLY for classic vehicles - modern vehicles should use /api/tires/search
 */

import { NextRequest, NextResponse } from "next/server";
import { getClassicFitment } from "@/lib/classic-fitment/classicLookup";
import {
  parseTireSize,
  calculateOverallDiameter,
  getClassicTireSizesForWheelDiameter,
  generateClassicUpsizeTable,
} from "@/lib/classic-fitment/classicTireUpsize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const year = parseInt(searchParams.get("year") || "", 10);
  const make = searchParams.get("make") || "";
  const model = searchParams.get("model") || "";
  const wheelDiameter = parseInt(searchParams.get("wheelDiameter") || "", 10);
  
  // Validate required params
  if (!year || !make || !model) {
    return NextResponse.json(
      { error: "Missing required parameters: year, make, model" },
      { status: 400 }
    );
  }
  
  try {
    // Get classic fitment data
    const classicData = await getClassicFitment(year, make, model);
    
    if (!classicData || !classicData.isClassicVehicle) {
      return NextResponse.json(
        {
          error: "Not a classic vehicle",
          message: "Use /api/tires/search for modern vehicles",
          isClassicVehicle: false,
        },
        { status: 404 }
      );
    }
    
    // Get stock tire size from classic fitment data
    const stockTireSize = classicData.stockReference?.tireSize;
    
    if (!stockTireSize) {
      return NextResponse.json(
        {
          error: "No stock tire size found",
          isClassicVehicle: true,
          platform: classicData.platform,
        },
        { status: 404 }
      );
    }
    
    // Parse stock size
    const parsedStock = parseTireSize(stockTireSize);
    if (!parsedStock) {
      return NextResponse.json(
        {
          error: `Could not parse stock tire size: ${stockTireSize}`,
          isClassicVehicle: true,
        },
        { status: 500 }
      );
    }
    
    const stockDiameter = calculateOverallDiameter(parsedStock);
    
    // If specific wheel diameter requested, return sizes for that diameter
    if (wheelDiameter) {
      const recommendedSizes = getClassicTireSizesForWheelDiameter(
        stockTireSize,
        wheelDiameter,
        5 // Return top 5 options
      );
      
      // Calculate details for each size
      const sizeDetails = recommendedSizes.map(sizeStr => {
        const parsed = parseTireSize(sizeStr)!;
        const od = calculateOverallDiameter(parsed);
        const variance = Math.abs((od - stockDiameter) / stockDiameter) * 100;
        
        return {
          size: sizeStr,
          width: parsed.width,
          aspectRatio: parsed.aspectRatio,
          rimDiameter: parsed.rimDiameter,
          overallDiameter: parseFloat(od.toFixed(2)),
          variancePercent: parseFloat(variance.toFixed(2)),
          recommended: variance <= 2,
        };
      });
      
      return NextResponse.json({
        isClassicVehicle: true,
        fitmentMode: "classic",
        
        vehicle: {
          year,
          make,
          model,
        },
        
        platform: classicData.platform,
        
        stockTire: {
          original: stockTireSize,
          metric: parsedStock.metric,
          overallDiameter: parseFloat(stockDiameter.toFixed(2)),
        },
        
        wheelDiameter,
        
        recommendedSizes: sizeDetails,
        
        searchSizes: recommendedSizes, // For use in tire search query
        
        notes: [
          `Stock tire: ${stockTireSize} (${parsedStock.metric})`,
          `Target overall diameter: ${stockDiameter.toFixed(1)}" ±3%`,
          "Narrower widths may provide better fender clearance",
        ],
      });
    }
    
    // No specific diameter - return full upsize table
    const upsizeTable = generateClassicUpsizeTable(stockTireSize, {
      targetDiameters: [15, 16, 17, 18, 19, 20],
      maxVariance: 3,
    });
    
    return NextResponse.json({
      isClassicVehicle: true,
      fitmentMode: "classic",
      
      vehicle: {
        year,
        make,
        model,
      },
      
      platform: classicData.platform,
      
      stockTire: {
        original: stockTireSize,
        metric: parsedStock.metric,
        overallDiameter: parseFloat(stockDiameter.toFixed(2)),
        rimDiameter: parsedStock.rimDiameter,
      },
      
      upsizeTable: upsizeTable.map(row => ({
        wheelDiameter: row.rimDiameter,
        recommended: row.recommended,
        variancePercent: parseFloat(row.diameterVariance.toFixed(2)),
        sizes: row.sizes.slice(0, 3).map(s => ({
          size: s.metric,
          width: s.width,
          aspectRatio: s.aspectRatio,
        })),
      })),
      
      recommendedDiameterRange: {
        min: classicData.recommendedRange?.diameter?.min || 14,
        max: 20, // Expanded for classic upsizing
      },
    });
    
  } catch (err: any) {
    console.error("[classic/tires] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err?.message },
      { status: 500 }
    );
  }
}
