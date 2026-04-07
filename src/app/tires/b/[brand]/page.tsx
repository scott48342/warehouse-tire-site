import { redirect, notFound } from "next/navigation";
import { VehicleEntryGate } from "@/components/VehicleEntryGate";
import { BRAND } from "@/lib/brand";
import Link from "next/link";

// Popular tire brands with display names
const TIRE_BRANDS: Record<string, { name: string; premium?: boolean }> = {
  // Premium
  "michelin": { name: "Michelin", premium: true },
  "bridgestone": { name: "Bridgestone", premium: true },
  "continental": { name: "Continental", premium: true },
  "goodyear": { name: "Goodyear", premium: true },
  "pirelli": { name: "Pirelli", premium: true },
  
  // Mid-tier
  "cooper": { name: "Cooper Tires" },
  "toyo": { name: "Toyo Tires" },
  "bfgoodrich": { name: "BFGoodrich" },
  "yokohama": { name: "Yokohama" },
  "hankook": { name: "Hankook" },
  "falken": { name: "Falken" },
  "general": { name: "General Tire" },
  "kumho": { name: "Kumho" },
  "nexen": { name: "Nexen" },
  "nitto": { name: "Nitto" },
  "firestone": { name: "Firestone" },
  "dunlop": { name: "Dunlop" },
  "uniroyal": { name: "Uniroyal" },
  
  // Value
  "achilles": { name: "Achilles" },
  "atlas": { name: "Atlas" },
  "accelera": { name: "Accelera" },
  "arizonian": { name: "Arizonian" },
  "atturo": { name: "Atturo" },
  "crosswind": { name: "Crosswind" },
  "delinte": { name: "Delinte" },
  "federal": { name: "Federal" },
  "fuzion": { name: "Fuzion" },
  "ironman": { name: "Ironman" },
  "lexani": { name: "Lexani" },
  "lionhart": { name: "Lionhart" },
  "milestar": { name: "Milestar" },
  "ohtsu": { name: "Ohtsu" },
  "sailun": { name: "Sailun" },
  "sentury": { name: "Sentury" },
  "sumitomo": { name: "Sumitomo" },
  "thunderer": { name: "Thunderer" },
  "vercelli": { name: "Vercelli" },
  "westlake": { name: "Westlake" },
  "zenna": { name: "Zenna" },
};

// Slugify brand name for URL
function brandSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Resolve brand from URL param to canonical name
function resolveBrand(brandParam: string): { slug: string; name: string; premium?: boolean } | null {
  const slug = brandParam.toLowerCase();
  
  // Direct match
  if (TIRE_BRANDS[slug]) {
    return { slug, ...TIRE_BRANDS[slug] };
  }
  
  // Try matching by display name slug
  for (const [key, data] of Object.entries(TIRE_BRANDS)) {
    if (brandSlug(data.name) === slug) {
      return { slug: key, ...data };
    }
  }
  
  // Fuzzy match - brand might be slightly different
  const normalized = slug.replace(/-/g, "");
  for (const [key, data] of Object.entries(TIRE_BRANDS)) {
    const keyNorm = key.replace(/-/g, "");
    if (keyNorm === normalized || data.name.toLowerCase().replace(/[^a-z0-9]/g, "") === normalized) {
      return { slug: key, ...data };
    }
  }
  
  // Not found but allow anyway - might be a valid brand not in our list
  return {
    slug: slug,
    name: brandParam.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
  };
}

type Props = {
  params: Promise<{ brand: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { brand } = await params;
  const resolved = resolveBrand(brand);
  const brandName = resolved?.name || brand;
  
  return {
    title: `${brandName} Tires | ${BRAND.name}`,
    description: `Shop ${brandName} tires with guaranteed fitment. Find ${brandName} tires that fit your vehicle perfectly.`,
  };
}

export default async function TiresBrandPage({ params, searchParams }: Props) {
  const { brand } = await params;
  const sp = await searchParams;
  
  // Resolve brand
  const resolved = resolveBrand(brand);
  if (!resolved) {
    notFound();
  }
  
  const { name: brandName, premium } = resolved;
  
  // Check for vehicle context
  const year = sp.year ? String(sp.year) : "";
  const make = sp.make ? String(sp.make) : "";
  const model = sp.model ? String(sp.model) : "";
  const hasVehicle = Boolean(year && make && model);
  
  // If vehicle context present, redirect to filtered tires page
  if (hasVehicle) {
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("make", make);
    params.set("model", model);
    if (sp.modification) params.set("modification", String(sp.modification));
    if (sp.trim) params.set("trim", String(sp.trim));
    params.set("brand", brandName);
    
    redirect(`/tires?${params.toString()}`);
  }
  
  // No vehicle context - show brand landing with vehicle selector
  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Brand Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 text-sm">
            <Link href="/tires" className="text-neutral-500 hover:text-neutral-700">
              Tires
            </Link>
            <span className="mx-2 text-neutral-300">/</span>
            <span className="text-neutral-900 font-semibold">{brandName}</span>
          </nav>
          
          <div className="flex items-center gap-3">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
              {brandName} Tires
            </h1>
            {premium && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                Premium Brand
              </span>
            )}
          </div>
          <p className="mt-2 text-lg text-neutral-600">
            Find {brandName} tires that fit your vehicle perfectly
          </p>
        </div>
      </div>
      
      {/* Vehicle Selector */}
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white mb-4">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Fitment Verified
          </div>
          <h2 className="text-2xl font-extrabold text-neutral-900">
            Select Your Vehicle
          </h2>
          <p className="mt-2 text-neutral-600">
            We'll show you {brandName} tires guaranteed to fit
          </p>
        </div>
        
        <VehicleEntryGate productType="tires" />
      </div>
    </main>
  );
}
