import { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/fitment-db";
import { galleryBuilds, buildToJakeContext } from "@/lib/fitment-db/schema";
import { eq, and, ne } from "drizzle-orm";
import { BuildDetailClient } from "./BuildDetailClient";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// METADATA (SEO)
// ═══════════════════════════════════════════════════════════════════════════

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const [build] = await db
    .select()
    .from(galleryBuilds)
    .where(and(
      eq(galleryBuilds.slug, slug),
      eq(galleryBuilds.isActive, true)
    ))
    .limit(1);
  
  if (!build) {
    return {
      title: "Build Not Found | Warehouse Tire Direct",
    };
  }
  
  const vehicleLabel = `${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}`;
  const wheelLabel = `${build.wheelBrand} ${build.wheelModel}`;
  const tireLabel = `${build.tireBrand} ${build.tireModel}`;
  const styleLabel = build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  
  const title = `${vehicleLabel} with ${wheelLabel} Wheels & ${tireLabel} Tires`;
  const description = `See this ${styleLabel} ${vehicleLabel} build featuring ${wheelLabel} wheels (${build.wheelSize}) and ${tireLabel} tires (${build.tireSize}). Build something similar for your vehicle!`;
  
  return {
    title: `${title} | Build Gallery`,
    description,
    keywords: [
      `${build.vehicleMake} ${build.vehicleModel} wheels`,
      `${build.wheelBrand} ${build.wheelModel}`,
      `${build.tireBrand} ${build.tireModel}`,
      `${build.vehicleModel} wheel setup`,
      `${styleLabel} ${build.vehicleModel}`,
      `${build.tireSize} tires`,
      build.liftLevel ? `lifted ${build.vehicleModel}` : null,
    ].filter(Boolean) as string[],
    openGraph: {
      title,
      description,
      images: [build.heroImageUrl],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [build.heroImageUrl],
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT (Server)
// ═══════════════════════════════════════════════════════════════════════════

export default async function BuildDetailPage({ params }: PageProps) {
  const { slug } = await params;
  
  // Fetch build
  const [build] = await db
    .select()
    .from(galleryBuilds)
    .where(and(
      eq(galleryBuilds.slug, slug),
      eq(galleryBuilds.isActive, true)
    ))
    .limit(1);
  
  if (!build) {
    notFound();
  }
  
  // Generate Jake context
  const jakeContext = buildToJakeContext(build);
  
  // Fetch related builds (same make or style)
  const related = await db
    .select()
    .from(galleryBuilds)
    .where(and(
      eq(galleryBuilds.isActive, true),
      ne(galleryBuilds.id, build.id)
    ))
    .limit(6);
  
  const vehicleLabel = `${build.vehicleYear} ${build.vehicleMake} ${build.vehicleModel}`;
  const styleLabel = build.buildStyle.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const liftLabel = build.liftLevel && build.liftLevel !== "stock" 
    ? build.liftLevel.includes("level") ? "Leveled" : `${build.liftLevel} Lift`
    : null;
  
  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <div className="relative">
        {/* Hero Image */}
        <div className="relative h-[50vh] md:h-[70vh] w-full">
          <Image
            src={build.heroImageUrl}
            alt={`${build.wheelBrand} ${build.wheelModel} on ${vehicleLabel}`}
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/30 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
        </div>
        
        {/* Back Button */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/build-gallery"
            className="inline-flex items-center gap-2 bg-black/50 backdrop-blur-sm text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-black/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Gallery
          </Link>
        </div>
        
        {/* Badges */}
        <div className="absolute top-4 right-4 z-10 flex gap-2">
          {build.isFeatured && (
            <span className="bg-amber-500/90 backdrop-blur-sm text-black text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
              ⭐ Featured Build
            </span>
          )}
          {liftLabel && (
            <span className="bg-white/10 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {liftLabel}
            </span>
          )}
        </div>
      </div>
      
      {/* Build Details */}
      <div className="mx-auto max-w-7xl px-4 -mt-32 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Title Card */}
            <div className="bg-neutral-900/80 backdrop-blur-xl rounded-3xl border border-white/10 p-6 md:p-8 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-white/10 text-white/80 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                  {styleLabel}
                </span>
                {build.vehicleTrim && (
                  <span className="text-white/50 text-sm">{build.vehicleTrim}</span>
                )}
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-white mb-4">
                {vehicleLabel}
              </h1>
              
              {build.description && (
                <p className="text-white/60 text-lg leading-relaxed mb-6">
                  {build.description}
                </p>
              )}
              
              {/* Spec Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Wheels</div>
                  <div className="text-white font-bold">{build.wheelBrand}</div>
                  <div className="text-white/80 text-sm">{build.wheelModel}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Wheel Size</div>
                  <div className="text-white font-bold">{build.wheelSize}</div>
                  {build.wheelOffset && (
                    <div className="text-white/80 text-sm">Offset: {build.wheelOffset}</div>
                  )}
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Tires</div>
                  <div className="text-white font-bold">{build.tireBrand}</div>
                  <div className="text-white/80 text-sm">{build.tireModel}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Tire Size</div>
                  <div className="text-white font-bold">{build.tireSize}</div>
                </div>
              </div>
              
              {/* Additional Specs */}
              {(build.wheelFinish || build.wheelBoltPattern) && (
                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-4 text-sm">
                  {build.wheelFinish && (
                    <div>
                      <span className="text-white/50">Finish:</span>{" "}
                      <span className="text-white">{build.wheelFinish}</span>
                    </div>
                  )}
                  {build.wheelBoltPattern && (
                    <div>
                      <span className="text-white/50">Bolt Pattern:</span>{" "}
                      <span className="text-white">{build.wheelBoltPattern}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Additional Images */}
            {build.additionalImages && build.additionalImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {build.additionalImages.map((url, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-xl overflow-hidden">
                    <Image
                      src={url}
                      alt={`${vehicleLabel} - Image ${i + 2}`}
                      fill
                      className="object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                ))}
              </div>
            )}
            
            {/* Tags */}
            {build.tags && build.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {build.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/build-gallery?tag=${encodeURIComponent(tag)}`}
                    className="bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
          
          {/* Sidebar - CTA */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              {/* Primary CTA Card */}
              <div className="bg-gradient-to-br from-red-900/50 to-red-950/50 backdrop-blur-xl rounded-3xl border border-red-500/20 p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-2xl">🔥</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">Love This Build?</h3>
                    <p className="text-white/60 text-sm">Let Jake build it for your vehicle</p>
                  </div>
                </div>
                
                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                  Click below and Jake will help you create a similar setup that fits your specific vehicle, with the same style and vibe.
                </p>
                
                {/* Client component for Jake integration */}
                <BuildDetailClient 
                  jakeContext={jakeContext}
                  vehicleLabel={vehicleLabel}
                  wheelLabel={`${build.wheelBrand} ${build.wheelModel}`}
                  tireLabel={`${build.tireBrand} ${build.tireModel}`}
                />
              </div>
              
              {/* Source Attribution */}
              {build.sourceAttribution && (
                <div className="bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">
                    Build by
                  </div>
                  <div className="text-white font-medium">
                    {build.sourceAttribution}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Related Builds */}
        {related.length > 0 && (
          <div className="mt-16 mb-12">
            <h2 className="text-2xl font-bold text-white mb-6">More Builds You Might Like</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/build-gallery/${r.slug}`}
                  className="group relative rounded-2xl overflow-hidden bg-neutral-900/50 border border-white/10 hover:border-red-500/50 transition-all"
                >
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={r.heroImageUrl}
                      alt={`${r.wheelBrand} ${r.wheelModel} on ${r.vehicleYear} ${r.vehicleMake} ${r.vehicleModel}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <div className="text-white font-bold text-sm mb-1">
                        {r.vehicleYear} {r.vehicleMake} {r.vehicleModel}
                      </div>
                      <div className="text-white/60 text-xs">
                        {r.wheelBrand} {r.wheelModel} • {r.wheelSize}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
