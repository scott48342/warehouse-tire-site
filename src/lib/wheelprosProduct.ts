/**
 * Wheel Pros Product API client
 * Docs: https://developer.wheelpros.com/assets/specs/product-api/openapi/api.html
 */

import { getWheelProsToken } from "@/lib/wheelprosAuth";

function baseUrl() {
  const base = process.env.WHEELPROS_PRODUCT_API_BASE_URL || "https://api.wheelpros.com/product/v1";
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
  const url = new URL("wheel/search", baseUrl());
  
  // Add query params
  if (params.vehicleYear) url.searchParams.set("vehicleYear", String(params.vehicleYear));
  if (params.vehicleMake) url.searchParams.set("vehicleMake", params.vehicleMake);
  if (params.vehicleModel) url.searchParams.set("vehicleModel", params.vehicleModel);
  if (params.vehicleSubModel) url.searchParams.set("vehicleSubModel", params.vehicleSubModel);
  
  if (params.boltPattern) url.searchParams.set("boltPattern", params.boltPattern);
  if (params.diameter) url.searchParams.set("diameter", String(params.diameter));
  if (params.width) url.searchParams.set("width", params.width);
  if (params.minOffset !== undefined) url.searchParams.set("minOffset", String(params.minOffset));
  if (params.maxOffset !== undefined) url.searchParams.set("maxOffset", String(params.maxOffset));
  if (params.centerbore) url.searchParams.set("centerbore", params.centerbore);
  
  if (params.brand) url.searchParams.set("brand", params.brand);
  if (params.finish) url.searchParams.set("finish", params.finish);
  
  if (params.includeLifted) url.searchParams.set("includeLifted", "true");
  if (params.includeStaggered) url.searchParams.set("includeStaggered", "true");
  if (params.availabilityType) url.searchParams.set("availabilityType", params.availabilityType);
  
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("pageSize", String(params.pageSize || 50));
  
  if (params.sortField) url.searchParams.set("sortField", params.sortField);
  if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
  
  // Always request price info
  url.searchParams.set("fields", params.fields || "price");
  url.searchParams.set("facetCount", "50"); // Get more facet buckets
  
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
  
  return (await res.json()) as WheelSearchResult;
}
