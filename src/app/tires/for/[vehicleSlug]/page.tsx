import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Script from 'next/script'
import { VehicleTrimSelector } from '@/components/VehicleTrimSelector'
import { 
  getVehicleBySlug,
  formatVehicleName,
  getStaticVehicleParams,
  getRelatedVehicles,
  slugifyVehicle,
} from '@/lib/seo'

const BASE_URL = 'https://shop.warehousetiredirect.com'

// ISR: Regenerate pages daily (trims loaded client-side)
export const revalidate = 86400

// Pre-build top ~200 vehicles for fast initial load
// Remaining 2000+ vehicles generated on-demand via ISR
export async function generateStaticParams() {
  return getStaticVehicleParams()
}

// Dynamic metadata for SEO
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ vehicleSlug: string }> 
}): Promise<Metadata> {
  const { vehicleSlug } = await params
  const vehicle = await getVehicleBySlug(vehicleSlug)
  
  if (!vehicle) {
    return {
      title: 'Vehicle Not Found',
      robots: { index: false, follow: false },
    }
  }

  const vehicleName = formatVehicleName(vehicle)
  const canonicalUrl = `${BASE_URL}/tires/for/${vehicleSlug}`
  
  return {
    title: `Tires for ${vehicleName}`,
    description: `Shop tires for your ${vehicleName}. All options verified for fitment. Fast shipping and professional installation at Warehouse Tire Direct.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Tires for ${vehicleName} | Warehouse Tire Direct`,
      description: `Find the perfect tires for your ${vehicleName}. Fitment-verified options with competitive pricing.`,
      url: canonicalUrl,
      type: 'website',
    },
  }
}

// Structured data for SEO
function generateStructuredData(vehicle: { year: string; make: string; model: string }, slug: string) {
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  
  return {
    '@context': 'https://schema.org',
    '@graph': [
      // BreadcrumbList
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Tires',
            'item': `${BASE_URL}/tires`,
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': vehicle.make,
            'item': `${BASE_URL}/tires/for/${vehicle.year.toLowerCase()}-${vehicle.make.toLowerCase()}`,
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': `${vehicleName} Tires`,
            'item': `${BASE_URL}/tires/for/${slug}`,
          },
        ],
      },
      // WebPage
      {
        '@type': 'WebPage',
        'name': `Tires for ${vehicleName}`,
        'description': `Shop tires for your ${vehicleName}. All options verified for fitment.`,
        'url': `${BASE_URL}/tires/for/${slug}`,
        'isPartOf': {
          '@type': 'WebSite',
          'name': 'Warehouse Tire Direct',
          'url': BASE_URL,
        },
      },
    ],
  }
}

export default async function VehicleTiresPage({ 
  params 
}: { 
  params: Promise<{ vehicleSlug: string }> 
}) {
  const { vehicleSlug } = await params
  const vehicle = await getVehicleBySlug(vehicleSlug)
  
  // 404 if vehicle slug is invalid
  if (!vehicle) {
    notFound()
  }

  const vehicleName = formatVehicleName(vehicle)
  const relatedVehicles = await getRelatedVehicles(vehicle.year, vehicle.make, vehicle.model)
  const structuredData = generateStructuredData(vehicle as any, vehicleSlug)

  return (
    <>
      {/* Structured Data */}
      <Script
        id="structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
          <div className="container mx-auto px-4">
            {/* Breadcrumb */}
            <nav className="text-sm text-gray-400 mb-4">
              <Link href="/tires" className="hover:text-white">Tires</Link>
              <span className="mx-2">›</span>
              <span className="text-gray-300">{vehicleName}</span>
            </nav>
            
            <h1 className="text-4xl md:text-5xl font-bold font-oswald mb-4">
              Tires for {vehicleName}
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl">
              Find the perfect tires for your {vehicleName}. All options are verified for fitment.
            </p>
          </div>
        </section>

        {/* Content Section */}
        <section className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto">
            
            {/* Client-side Trim Selector */}
            <VehicleTrimSelector
              year={String(vehicle.year)}
              make={vehicle.make}
              model={vehicle.model}
              vehicleName={vehicleName}
            />

            {/* Why Choose Us */}
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <h2 className="text-2xl font-bold mb-4">
                Why Choose Warehouse Tire Direct?
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Fitment Verified:</strong> Every tire is confirmed to fit your {vehicleName}</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Competitive Pricing:</strong> We match or beat any advertised price</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>Professional Installation:</strong> Schedule installation at our shop</span>
                </li>
                <li className="flex items-start">
                  <svg className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span><strong>In-Stock Selection:</strong> Only showing tires that are available now</span>
                </li>
              </ul>
            </div>

            {/* SEO Content */}
            <div className="prose prose-lg max-w-none mb-8">
              <h2>About {vehicle.make} {vehicle.model} Tires</h2>
              <p>
                The {vehicle.make} {vehicle.model} is a popular vehicle that requires 
                quality tires for optimal performance and safety. Whether you&apos;re looking 
                for all-season tires, performance tires, or winter tires, we have options 
                that fit your {vehicle.year} {vehicle.make} {vehicle.model} perfectly.
              </p>
              <p>
                Different {vehicle.model} trims may have different wheel and tire sizes. 
                Select your specific trim above to see tires that are guaranteed to fit 
                your vehicle.
              </p>
              <p>
                At Warehouse Tire Direct, we make it easy to find the right tires for your 
                vehicle. Our fitment system ensures that every tire we show you is 
                compatible with your {vehicleName}. Simply browse our selection, add to 
                cart, and schedule your installation.
              </p>
            </div>

            {/* Related Vehicles - Internal Linking */}
            {relatedVehicles.length > 0 && (
              <div className="bg-gray-100 rounded-lg p-6 mb-8">
                <h3 className="text-lg font-semibold mb-4 text-gray-700">
                  Related Vehicles
                </h3>
                <div className="flex flex-wrap gap-2">
                  {relatedVehicles.map((rv) => {
                    const rvSlug = slugifyVehicle(rv)
                    const rvName = `${rv.year} ${rv.make} ${rv.model}`
                    return (
                      <Link
                        key={rvSlug}
                        href={`/tires/for/${rvSlug}`}
                        className="px-3 py-1.5 bg-white rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-gray-200"
                      >
                        {rvName}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Also Check Out */}
            <div className="border-t pt-8">
              <h3 className="text-lg font-semibold mb-4 text-gray-700">
                Also Check Out
              </h3>
              <div className="flex flex-wrap gap-4">
                <Link 
                  href={`/wheels?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`}
                  className="text-blue-600 hover:underline"
                >
                  Wheels for {vehicleName} →
                </Link>
                <Link 
                  href="/tires/c/all-season"
                  className="text-blue-600 hover:underline"
                >
                  All-Season Tires →
                </Link>
                <Link 
                  href="/tires/c/all-terrain"
                  className="text-blue-600 hover:underline"
                >
                  All-Terrain Tires →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
