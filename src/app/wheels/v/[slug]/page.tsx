import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WheelsPage from "@/app/wheels/page";
import { vehicleSlug } from "@/lib/vehicleSlug";
import { getVehicleBySlug } from "@/lib/seo/getVehicleBySlug";

export const runtime = "nodejs";

// Canonical URL - Always points to national site
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    alternates: {
      canonical: `https://shop.warehousetiredirect.com/wheels/v/${slug}`,
    },
  };
}

export default async function WheelsVehicleSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};

  const year = (Array.isArray(sp.year) ? sp.year[0] : sp.year) || "";
  const make = (Array.isArray(sp.make) ? sp.make[0] : sp.make) || "";
  const model = (Array.isArray(sp.model) ? sp.model[0] : sp.model) || "";

  if (year && make && model) {
    const want = vehicleSlug(year, make, model);
    if (slug !== want) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(sp)) {
        const val = Array.isArray(v) ? v[0] : v;
        if (val) qs.set(k, val);
      }
      redirect(`/wheels/v/${want}?${qs.toString()}`);
    }

    // Render the real wheels page but keep the SEO-friendly /v/<slug> URL.
    return WheelsPage({ searchParams: Promise.resolve(sp) });
  }

  // No query params: resolve year/make/model FROM THE SLUG so these canonical
  // /wheels/v/<slug> URLs (indexed + shared) never dead-end with zero products.
  const resolved = await getVehicleBySlug(slug);
  if (resolved) {
    const merged: Record<string, string | string[] | undefined> = {
      ...sp,
      year: resolved.year,
      make: resolved.make,
      model: resolved.model,
    };
    return WheelsPage({ searchParams: Promise.resolve(merged) });
  }

  // Slug couldn't be resolved to a real vehicle: send the visitor to the
  // working wheel selector instead of stranding them on a dead-end page.
  redirect("/wheels");
}
