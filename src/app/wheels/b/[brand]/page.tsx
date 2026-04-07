import { redirect, notFound } from "next/navigation";
import { VehicleEntryGate } from "@/components/VehicleEntryGate";
import { BRAND } from "@/lib/brand";
import Link from "next/link";

// Brand code to display name mapping (from WheelPros)
const WHEEL_BRANDS: Record<string, string> = {
  // Premium brands
  "FM": "Fuel",
  "FT": "Fuel Off-Road",
  "MO": "Moto Metal",
  "XD": "XD Series",
  "KM": "KMC",
  "AR": "American Racing",
  "HE": "Helo",
  "VF": "Vision",
  "RC": "Raceline",
  "L8": "Level 8",
  "DC": "Dick Cepek",
  "NC": "Niche",
  "UC": "Ultra",
  "OC": "Ouray",
  "AC": "ATX",
  "TU": "Tuff",
  "PR": "Pro Comp",
  "BK": "Black Rhino",
  "WE": "Wheel Replicas",
  "MA": "Mayhem",
  "RE": "Replica",
  "RO": "Rotiform",
  "AS": "Asanti",
  "DU": "DUB",
  "GI": "Giovanna",
  "LE": "Lexani",
  // Add more as needed
};

// Slugify brand name for URL
function brandSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Reverse lookup: slug or code to brand code
function resolveBrandCode(brandParam: string): string | null {
  const upper = brandParam.toUpperCase();
  
  // Direct code match
  if (WHEEL_BRANDS[upper]) {
    return upper;
  }
  
  // Slug match
  const slug = brandParam.toLowerCase();
  for (const [code, name] of Object.entries(WHEEL_BRANDS)) {
    if (brandSlug(name) === slug) {
      return code;
    }
  }
  
  // Partial name match (for SEO URLs like "fuel-off-road")
  for (const [code, name] of Object.entries(WHEEL_BRANDS)) {
    if (name.toLowerCase().includes(slug.replace(/-/g, " "))) {
      return code;
    }
  }
  
  return null;
}

type Props = {
  params: Promise<{ brand: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { brand } = await params;
  const brandCode = resolveBrandCode(brand);
  const brandName = brandCode ? WHEEL_BRANDS[brandCode] : brand;
  
  return {
    title: `${brandName} Wheels | ${BRAND.name}`,
    description: `Shop ${brandName} wheels with guaranteed fitment. Find ${brandName} wheels that fit your vehicle perfectly.`,
  };
}

export default async function WheelsBrandPage({ params, searchParams }: Props) {
  const { brand } = await params;
  const sp = await searchParams;
  
  // Resolve brand code
  const brandCode = resolveBrandCode(brand);
  
  if (!brandCode) {
    // Brand not found - show 404 or redirect to main wheels page
    notFound();
  }
  
  const brandName = WHEEL_BRANDS[brandCode] || brand;
  
  // Check for vehicle context
  const year = sp.year ? String(sp.year) : "";
  const make = sp.make ? String(sp.make) : "";
  const model = sp.model ? String(sp.model) : "";
  const hasVehicle = Boolean(year && make && model);
  
  // If vehicle context present, redirect to filtered wheels page
  if (hasVehicle) {
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("make", make);
    params.set("model", model);
    if (sp.modification) params.set("modification", String(sp.modification));
    if (sp.trim) params.set("trim", String(sp.trim));
    params.set("brand_cd", brandCode);
    
    redirect(`/wheels?${params.toString()}`);
  }
  
  // No vehicle context - show brand landing with vehicle selector
  return (
    <main className="bg-neutral-50 min-h-screen">
      {/* Brand Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 text-sm">
            <Link href="/wheels" className="text-neutral-500 hover:text-neutral-700">
              Wheels
            </Link>
            <span className="mx-2 text-neutral-300">/</span>
            <span className="text-neutral-900 font-semibold">{brandName}</span>
          </nav>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            {brandName} Wheels
          </h1>
          <p className="mt-2 text-lg text-neutral-600">
            Find {brandName} wheels that fit your vehicle perfectly
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
            We'll show you {brandName} wheels guaranteed to fit
          </p>
        </div>
        
        <VehicleEntryGate productType="wheels" />
      </div>
    </main>
  );
}
