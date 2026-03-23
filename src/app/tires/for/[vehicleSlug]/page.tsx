import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { 
  getVehicleBySlug, 
  buildTireSearchUrl, 
  formatVehicleName,
  getStaticVehicleParams 
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

  const vehicleName = formatVehicleName(vehicle)
  const searchUrl = buildTireSearchUrl(vehicle)

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold font-oswald mb-4">
            Tires for {vehicleName}
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl">
            Find the perfect tires for your {vehicleName}. All options are verified 
            for fitment and backed by our price match guarantee.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
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
                <span><strong>Fitment Verified:</strong> Every tire is confirmed to fit your {vehicle.year} {vehicle.make} {vehicle.model}</span>
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
                <span><strong>Professional Installation:</strong> Schedule installation at our shop or one of our partners</span>
              </li>
              <li className="flex items-start">
                <svg className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span><strong>In-Stock Selection:</strong> Only showing tires that are available now</span>
              </li>
            </ul>
          </div>

          {/* CTA Card */}
          <div className="bg-blue-600 rounded-lg shadow-lg p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-4">
              Ready to Find Your Tires?
            </h2>
            <p className="text-blue-100 mb-6">
              Browse our full selection of tires for your {vehicleName}
            </p>
            <Link
              href={searchUrl}
              className="inline-block bg-white text-blue-600 font-bold py-4 px-8 rounded-lg text-lg hover:bg-blue-50 transition-colors"
            >
              Shop Tires for {vehicle.year} {vehicle.make} {vehicle.model}
            </Link>
          </div>

          {/* SEO Content */}
          <div className="mt-12 prose prose-lg max-w-none">
            <h2>About {vehicle.make} {vehicle.model} Tires</h2>
            <p>
              The {vehicle.make} {vehicle.model} is a popular vehicle that requires 
              quality tires for optimal performance and safety. Whether you&apos;re looking 
              for all-season tires, performance tires, or winter tires, we have options 
              that fit your {vehicle.year} {vehicle.make} {vehicle.model} perfectly.
            </p>
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
