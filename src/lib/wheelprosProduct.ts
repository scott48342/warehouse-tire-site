/**
 * Wheel Pros Product API client
 * Docs: https://developer.wheelpros.com/assets/specs/product-api/openapi/api.html
 */

import { getWheelProsToken } from "@/lib/wheelprosAuth";

function baseUrl() {
  // Note: endpoint is /products/v1/ (plural), not /product/v1/
  const base = process.env.WHEELPROS_PRODUCT_API_BASE_URL || "https://api.wheelpros.com/products/v1";
  // Ensure trailing slash so relative URLs resolve correctly
  return base.endsWith("/") ? base : base + "/";
}

export type WheelSearchParams = {
  // Vehicle fitment
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleSubModel?: string;
  
  // Specs
  boltPattern?: string;
  diameter?: number;
  width?: string;
  minOffset?: number;
  maxOffset?: number;
  centerbore?: string;
  
  // Filters
  brand?: string;
  finish?: string;
  
  // Options
  includeLifted?: boolean;
  includeStaggered?: boolean;
  availabilityType?: "ALL" | "LOCAL" | "AVAILABLE";
  
  // Pagination
  page?: number;
  pageSize?: number;
  
  // Sorting
  sortField?: "brand" | "popularity" | "price" | "status" | "style" | "styleNumber";
  sortOrder?: "asc" | "desc";
  
  // Extra fields
  fields?: string; // e.g., "inventory,price"
};

export type WheelSearchResult = {
  content: Array<{
    sku?: string;
    styleNumber?: string;
    styleName?: string;
    brand?: string;
    brandCode?: string;
    finish?: string;
    diameter?: number;
    width?: number;
    offset?: number;
    boltPattern?: string;
    centerbore?: number;
    msrp?: number;
    mapPrice?: number;
    images?: Array<{ url?: string; type?: string }>;
    inventory?: Array<{ warehouse?: string; quantity?: number }>;
  }>;
  pageable?: {
    pageNumber?: number;
    pageSize?: number;
  };
  totalElements?: number;
  totalPages?: number;
  facets?: {
    brands?: Array<{ key: string; count: number }>;
    finishes?: Array<{ key: string; count: number }>;
    diameters?: Array<{ key: number; count: number }>;
    widths?: Array<{ key: number; count: number }>;
    boltPatterns?: Array<{ key: string; count: number }>;
  };
};

export async function searchWheels(params: WheelSearchParams): Promise<WheelSearchResult> {
  const token = await getWheelProsToken();
  const url = new URL("search/wheel", baseUrl());
  
  // Add query params (API uses snake_case parameter names)
  if (params.vehicleYear) url.searchParams.set("year", String(params.vehicleYear));
  if (params.vehicleMake) url.searchParams.set("vehicle_make", params.vehicleMake);
  if (params.vehicleModel) url.searchParams.set("vehicle_model", params.vehicleModel);
  if (params.vehicleSubModel) url.searchParams.set("vehicle_submodel", params.vehicleSubModel);
  
  if (params.boltPattern) url.searchParams.set("bolt_pattern_metric", params.boltPattern);
  if (params.diameter) url.searchParams.set("wheel_diameter", String(params.diameter));
  if (params.width) url.searchParams.set("width", params.width);
  if (params.minOffset !== undefined) url.searchParams.set("min_offset", String(params.minOffset));
  if (params.maxOffset !== undefined) url.searchParams.set("max_offset", String(params.maxOffset));
  if (params.centerbore) url.searchParams.set("centerbore", params.centerbore);
  
  if (params.brand) url.searchParams.set("brand_cd", params.brand);
  if (params.finish) url.searchParams.set("abbreviated_finish_desc", params.finish);
  
  if (params.includeLifted) url.searchParams.set("include_lifted", "true");
  if (params.includeStaggered) url.searchParams.set("include_staggered", "true");
  if (params.availabilityType) url.searchParams.set("availability_type", params.availabilityType);
  
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("pageSize", String(params.pageSize || 50));
  
  if (params.sortField) url.searchParams.set("sortField", params.sortField);
  if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
  
  // Request price info (note: facetCount not supported in new API)
  if (params.fields) url.searchParams.set("fields", params.fields);
  
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {}
    throw new Error(`WheelPros wheel search failed: HTTP ${res.status}${detail ? ` :: ${detail}` : ""}`);
  }
  
  const raw = await res.json();
  
  // Transform new API response format to our expected format
  // New API returns: { results, totalCount, page, pageSize, facets }
  // We need: { content, totalElements, totalPages, pageable, facets }
  const content = (raw.results || []).map((item: any) => ({
    sku: item.sku,
    styleNumber: item.sku?.replace(/-/g, "").substring(0, 10),
    styleName: item.title,
    brand: item.brand?.description || item.brand,
    brandCode: item.brand?.code,
    finish: item.properties?.finish || item.properties?.finishCode,
    diameter: item.properties?.diameter,
    width: item.properties?.width,
    offset: item.properties?.offset,
    boltPattern: item.properties?.boltPattern,
    centerbore: item.properties?.centerbore,
    msrp: item.prices?.msrp?.[0]?.value,
    mapPrice: item.prices?.map?.[0]?.value,
    images: item.images ? (Array.isArray(item.images) ? item.images : [{ url: item.images }]) : [],
    inventory: item.inventory ? [{
      warehouse: "global",
      quantity: (item.inventory.localStock || 0) + (item.inventory.globalStock || 0),
    }] : [],
  }));
  
  const pageSize = raw.pageSize || params.pageSize || 50;
  const totalElements = raw.totalCount || 0;
  
  return {
    content,
    pageable: {
      pageNumber: raw.page || 1,
      pageSize,
    },
    totalElements,
    totalPages: Math.ceil(totalElements / pageSize),
    facets: raw.facets ? {
      brands: extractStringFacets(raw.facets.brand_desc || raw.facets.brand_cd),
      finishes: extractStringFacets(raw.facets.abbreviated_finish_desc),
      diameters: extractNumberFacets(raw.facets.wheel_diameter),
      widths: extractNumberFacets(raw.facets.width),
      boltPatterns: extractStringFacets(raw.facets.bolt_pattern_metric),
    } : undefined,
  };
}

// Helper to extract string-keyed facet buckets
function extractStringFacets(facet: any): Array<{ key: string; count: number }> | undefined {
  if (!facet?.buckets) return undefined;
  if (Array.isArray(facet.buckets)) {
    return facet.buckets.map((b: any) => ({
      key: String(b.key ?? b.value ?? b),
      count: b.doc_count ?? b.count ?? 0,
    }));
  }
  if (typeof facet.buckets === "object") {
    return Object.entries(facet.buckets).map(([key, val]: [string, any]) => ({
      key,
      count: typeof val === "number" ? val : (val?.doc_count ?? val?.count ?? 0),
    }));
  }
  return undefined;
}

// Helper to extract number-keyed facet buckets (for diameters, widths)
function extractNumberFacets(facet: any): Array<{ key: number; count: number }> | undefined {
  if (!facet?.buckets) return undefined;
  if (Array.isArray(facet.buckets)) {
    return facet.buckets.map((b: any) => ({
      key: Number(b.key ?? b.value ?? b),
      count: b.doc_count ?? b.count ?? 0,
    }));
  }
  if (typeof facet.buckets === "object") {
    return Object.entries(facet.buckets).map(([key, val]: [string, any]) => ({
      key: Number(key),
      count: typeof val === "number" ? val : (val?.doc_count ?? val?.count ?? 0),
    }));
  }
  return undefined;
}
