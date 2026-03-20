import { NextResponse } from "next/server";
import { searchWheels, type WheelSearchParams } from "@/lib/wheelprosProduct";

export const runtime = "nodejs";

/**
 * Wheel search using Wheel Pros Product API
 * This provides real-time inventory and proper vehicle fitment
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const t0 = Date.now();

  try {
    const params: WheelSearchParams = {};

    // Vehicle params
    const year = url.searchParams.get("year");
    if (year) params.vehicleYear = parseInt(year, 10);
    
    const make = url.searchParams.get("make");
    if (make) params.vehicleMake = make;
    
    const model = url.searchParams.get("model");
    if (model) params.vehicleModel = model;
    
    const subModel = url.searchParams.get("subModel") || url.searchParams.get("trim");
    if (subModel) params.vehicleSubModel = subModel;

    // Spec filters
    const boltPattern = url.searchParams.get("boltPattern");
    if (boltPattern) params.boltPattern = boltPattern;

    const diameter = url.searchParams.get("diameter");
    if (diameter) params.diameter = parseFloat(diameter);

    const width = url.searchParams.get("width");
    if (width) params.width = width;

    const offsetMin = url.searchParams.get("offsetMin");
    if (offsetMin) params.minOffset = parseFloat(offsetMin);

    const offsetMax = url.searchParams.get("offsetMax");
    if (offsetMax) params.maxOffset = parseFloat(offsetMax);

    const centerbore = url.searchParams.get("centerbore");
    if (centerbore) params.centerbore = centerbore;

    // Other filters
    const brand = url.searchParams.get("brand");
    if (brand) params.brand = brand;

    const finish = url.searchParams.get("finish");
    if (finish) params.finish = finish;

    // Options
    const includeLifted = url.searchParams.get("includeLifted");
    if (includeLifted === "true") params.includeLifted = true;

    // Pagination
    const page = url.searchParams.get("page");
    params.page = page ? Math.max(1, parseInt(page, 10)) : 1;

    const pageSize = url.searchParams.get("pageSize");
    params.pageSize = pageSize ? Math.min(100, Math.max(1, parseInt(pageSize, 10))) : 24;

    // Sorting
    const sortField = url.searchParams.get("sortField") as WheelSearchParams["sortField"];
    if (sortField) params.sortField = sortField;

    const sortOrder = url.searchParams.get("sortOrder") as WheelSearchParams["sortOrder"];
    if (sortOrder) params.sortOrder = sortOrder;

    const result = await searchWheels(params);
    const totalMs = Date.now() - t0;

    // Transform to match our existing frontend format
    const styles = (result.content || []).map(w => ({
      styleKey: w.styleNumber || w.sku || "",
      brand: w.brand || "",
      brandCode: w.brandCode || "",
      model: w.styleName || "",
      imageUrl: w.images?.[0]?.url,
      price: w.msrp || w.mapPrice,
      finishes: [{
        finish: w.finish || "",
        sku: w.sku || "",
        imageUrl: w.images?.[0]?.url,
        price: w.msrp,
        diameter: w.diameter ? String(w.diameter) : undefined,
        width: w.width ? String(w.width) : undefined,
        offset: w.offset ? String(w.offset) : undefined,
      }],
      skus: [{
        sku: w.sku || "",
        diameter: w.diameter ? String(w.diameter) : "",
        width: w.width ? String(w.width) : "",
        offset: w.offset ? String(w.offset) : "",
        boltPattern: w.boltPattern || "",
        centerbore: w.centerbore ? String(w.centerbore) : "",
        finish: w.finish || "",
        price: w.msrp,
      }],
    }));

    // Transform facets
    const facets = {
      brands: (result.facets?.brands || []).map(f => ({
        code: f.key,
        name: f.key,
        count: f.count,
      })),
      finishes: (result.facets?.finishes || []).map(f => ({
        value: f.key,
        count: f.count,
      })),
      diameters: (result.facets?.diameters || []).map(f => ({
        value: String(f.key),
        count: f.count,
      })),
      widths: (result.facets?.widths || []).map(f => ({
        value: String(f.key),
        count: f.count,
      })),
      boltPatterns: (result.facets?.boltPatterns || []).map(f => ({
        value: f.key,
        count: f.count,
      })),
    };

    return NextResponse.json({
      styles,
      totalStyles: result.totalElements || styles.length,
      page: result.pageable?.pageNumber || params.page,
      pageSize: result.pageable?.pageSize || params.pageSize,
      totalPages: result.totalPages || Math.ceil((result.totalElements || 0) / (params.pageSize || 24)),
      facets,
      source: "wheelpros-api",
      timing: { totalMs },
    });

  } catch (err: any) {
    console.error("[wheels/search] WheelPros API error:", err);
    return NextResponse.json(
      { 
        error: "Wheel search failed", 
        message: err?.message || String(err),
        source: "wheelpros-api",
      },
      { status: 502 }
    );
  }
}
