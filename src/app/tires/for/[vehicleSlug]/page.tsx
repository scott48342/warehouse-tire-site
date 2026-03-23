import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  getVehicleBySlug, 
  buildTireSearchUrl, 
  formatVehicleName,
  getStaticVehicleParams,
  TrimOption,
} from '@/lib/seo'

// ISR: Regenerate pages every 24 hours
export const revalidate = 86400

// Pre-build top 100 vehicles, rest are on-demand
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

  // Don't index pages with no trims (dead ends)
  if (vehicle.trims.length === 0) {
    return {
      title: `Tires for ${formatVehicleName(vehicle)}`,
      robots: { index: false, follow: false },
    }
  }

  const vehicleName = formatVehicleName(vehicle)
  
  return {
    title: `Tires for ${vehicleName}`,
    description: `Shop tires for your ${vehicleName}. All options are verified for fitment. Fast shipping and professional installation available at Warehouse Tire Direct.`,
    openGraph: {
      title: `Tires for ${vehicleName} | Warehouse Tire Direct`,
      description: `Find the perfect tires for your ${vehicleName}. Browse our selection of fitment-verified tires with competitive pricing.`,
    },
  }
}

// Trim Selection Card Component
function TrimCard({ trim, vehicle }: { trim: TrimOption; vehicle: { year: string; make: string; model: string } }) {
  return (
    <Link
      href={trim.searchUrl}
      className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all group"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600">
            {trim.label}
          </h3>
          <p className="text-sm text-gray-500">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
        </div>
        <svg 
          className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-transform" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

export default async function VehicleTiresPage({ 
  params 
}: { 
  params: Promise<{ vehicleSlug: string }> 
}) {
  const { vehicleSlug } = await params
  const vehicle = await getVehicleBySlug(vehicleSlug)
  
  // Safety guard: 404 if vehicle cannot be resolved
  if (!vehicle) {
    notFound()
  }

  // If no trims available, still show page but with limited CTA
  if (vehicle.trims.length === 0) {
    notFound()  // Better to 404 than show a dead-end page
  }

  const vehicleName = formatVehicleName(vehicle)
  const hasMultipleTrims = vehicle.trims.length > 1

  // Auto-resolvable: exactly one trim, link directly to results
  const directSearchUrl = vehicle.autoResolvable && vehicle.trims.length === 1
    ? vehicle.trims[0].searchUrl
    : buildTireSearchUrl(vehicle)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-oswald mb-4">
            Tires for {vehicleName}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            {hasMultipleTrims 
              ? `Select your ${vehicle.model} trim to see tires that fit perfectly.`
              : `Find the perfect tires for your ${vehicleName}. All options are verified for fitment.`
            }
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          
          {/* Multiple Trims: Show Trim Selector */}
          {hasMultipleTrims && (
            <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
              <h2 className="text-2xl font-bold mb-2">
                Select Your Trim
              </h2>
              <p className="text-gray-600 mb-6">
                Choose your specific {vehicle.year} {vehicle.make} {vehicle.model} configuration to see compatible tires.
              </p>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {vehicle.trims.map((trim) => (
                  <TrimCard 
                    key={trim.modificationId} 
                    trim={trim} 
                    vehicle={{ year: vehicle.year, make: vehicle.make, model: vehicle.model }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Single Trim: Show Direct CTA */}
          {!hasMultipleTrims && vehicle.trims.length === 1 && (
            <>
              {/* Intro Content */}
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

              {/* CTA Card - Direct Link */}
              <div className="bg-blue-600 rounded-lg shadow-lg p-8 text-center text-white">
                <h2 className="text-2xl font-bold mb-4">
                  Ready to Find Your Tires?
                </h2>
                <p className="text-blue-100 mb-6">
                  Browse our full selection of tires for your {vehicleName}
                </p>
                <Link
                  href={directSearchUrl}
                  className="inline-block bg-white text-blue-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-blue-50 transition-colors"
                >
                  Shop Tires for {vehicleName}
                </Link>
              </div>
            </>
          )}

          {/* SEO Content */}
          <div className="mt-12 prose prose-lg max-w-none">
            <h2>About {vehicle.make} {vehicle.model} Tires</h2>
            <p>
              The {vehicle.make} {vehicle.model} is a popular vehicle that requires 
              quality tires for optimal performance and safety. Whether you&apos;re looking 
              for all-season tires, performance tires, or winter tires, we have options 
              that fit your {vehicle.year} {vehicle.make} {vehicle.model} perfectly.
            </p>
            {hasMultipleTrims && (
              <p>
                Different {vehicle.model} trims may have different wheel and tire sizes. 
                Select your specific trim above to see tires that are guaranteed to fit 
                your vehicle.
              </p>
            )}
            <p>
              At Warehouse Tire Direct, we make it easy to find the right tires for your 
              vehicle. Our fitment system ensures that every tire we show you is 
              compatible with your {vehicleName}. Simply browse our selection, add to 
              cart, and schedule your installation.
            </p>
          </div>

          {/* Related Links */}
          <div className="mt-12 border-t pt-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">
              Also Check Out
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link 
                href={`/wheels?year=${vehicle.year}&make=${encodeURIComponent(vehicle.make)}&model=${encodeURIComponent(vehicle.model)}`}
                className="text-blue-600 hover:underline"
              >
                Wheels for {vehicleName} →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
