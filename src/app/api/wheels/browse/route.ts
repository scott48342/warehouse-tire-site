import { NextResponse } from "next/server";
import { browseWheels, type BrowseFilters } from "@/lib/techfeed/wheels-browse";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const t0 = Date.now();

  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "24", 10) || 24));

  const filters: BrowseFilters = {};

  const boltPattern = url.searchParams.get("boltPattern");
  if (boltPattern) filters.boltPattern = boltPattern;

  const diameter = url.searchParams.get("diameter");
  if (diameter) filters.diameter = diameter;

  const width = url.searchParams.get("width");
  if (width) filters.width = width;

  const offsetMin = url.searchParams.get("offsetMin");
  if (offsetMin) filters.offsetMin = parseFloat(offsetMin);

  const offsetMax = url.searchParams.get("offsetMax");
  if (offsetMax) filters.offsetMax = parseFloat(offsetMax);

  const centerbore = url.searchParams.get("centerbore");
  if (centerbore) filters.centerbore = centerbore;

  const brandCode = url.searchParams.get("brand_cd");
  if (brandCode) filters.brandCode = brandCode;

  const finish = url.searchParams.get("finish");
  if (finish) filters.finish = finish;

  const priceMin = url.searchParams.get("priceMin");
  if (priceMin) filters.priceMin = parseFloat(priceMin);

  const priceMax = url.searchParams.get("priceMax");
  if (priceMax) filters.priceMax = parseFloat(priceMax);

  const result = await browseWheels(filters, page, pageSize);
  const totalMs = Date.now() - t0;

  return NextResponse.json({
    styles: result.styles,
    totalStyles: result.totalStyles,
    page,
    pageSize,
    totalPages: Math.ceil(result.totalStyles / pageSize),
    facets: result.facets,
    timing: {
      totalMs,
      loadMs: result.loadMs,
      filterMs: result.filterMs,
      cacheHit: result.cacheHit,
    },
  });
}
