/**
 * Wheel Pros Accessory Search API client
 * Endpoint: GET https://api.wheelpros.com/products/v1/search/accessory
 */

import { getWheelProsToken } from "@/lib/wheelprosAuth";

function baseUrl() {
  return process.env.WHEELPROS_ACCESSORY_API_BASE_URL || "https://api.wheelpros.com/products/v1";
}

export type WheelProsAccessoryPrice = {
  currencyAmount?: number;
  currencyCode?: string;
};

export type WheelProsAccessoryResult = {
  sku?: string;
  title?: string;
  brand?: { code?: string; description?: string };
  prices?: {
    msrp?: WheelProsAccessoryPrice[];
    map?: WheelProsAccessoryPrice[];
    nip?: WheelProsAccessoryPrice[];
  };
  inventory?: { type?: string }[];
};

export type WheelProsAccessorySearchResponse = {
  results?: WheelProsAccessoryResult[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export async function searchAccessories(params: {
  filter: string;
  fields?: string; // "inventory,price"
  priceType?: string; // "msrp,map,nip"
  company: string;
  page?: number;
  pageSize?: number;
}): Promise<WheelProsAccessorySearchResponse> {
  const token = await getWheelProsToken();

  const url = new URL("/search/accessory", baseUrl());
  url.searchParams.set("filter", params.filter);
  url.searchParams.set("fields", params.fields || "inventory,price");
  url.searchParams.set("priceType", params.priceType || "msrp,map,nip");
  url.searchParams.set("company", params.company);
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("pageSize", String(params.pageSize || 50));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {}
    throw new Error(`WheelPros accessory search failed: HTTP ${res.status}${detail ? ` :: ${detail}` : ""}`);
  }

  return (await res.json()) as WheelProsAccessorySearchResponse;
}
