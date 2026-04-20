import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Warranty Information | Warehouse Tire Direct',
  description: 'Warranty information for tires and wheels sold at Warehouse Tire Direct. Learn about manufacturer warranties for Fuel, KMC, American Racing, Nitto, BFGoodrich, and more.',
}

const wheelBrands = [
  {
    name: 'Fuel Off-Road',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty against peeling, flaking, or blistering under normal conditions.',
    url: 'https://www.fueloffroad.com/warranty',
  },
  {
    name: 'KMC Wheels',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.kmcwheels.com/warranty',
  },
  {
    name: 'American Racing',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.americanracing.com/warranty',
  },
  {
    name: 'XD Series',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.xdwheels.com/warranty',
  },
  {
    name: 'Moto Metal',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.motometalwheels.com/warranty',
  },
  {
    name: 'Asanti',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.asantiwheels.com/warranty',
  },
  {
    name: 'Black Rhino',
    warranty: 'Lifetime Structural Warranty',
    coverage: 'Warrants wheels free from structural failure under normal and intended use for as long as the original retail purchaser owns the product.',
    finish: '1 year finish warranty under normal conditions.',
    url: 'https://www.blackrhinowheels.com/warranty',
  },
]

const tireBrands = [
  {
    name: 'Nitto',
    warranty: 'Limited Manufacturer Warranty',
    coverage: 'All Nitto tires are covered by a limited manufacturer warranty against defects in workmanship and materials.',
    mileage: 'Mileage warranties vary by tire line (up to 65,000 miles on select models).',
    url: 'https://www.nittotire.com/tires-101/warranty-information/',
  },
  {
    name: 'BFGoodrich',
    warranty: '6-Year Limited Warranty',
    coverage: 'Covers defects in workmanship and materials for 6 years from date of purchase.',
    mileage: 'Treadwear warranties vary by product (up to 80,000 miles on select models).',
    url: 'https://www.bfgoodrichtires.com/assistance/standard-limited-warranty',
  },
  {
    name: 'Toyo',
    warranty: 'Limited Manufacturer Warranty',
    coverage: 'Covers defects in workmanship and materials. Duration varies by tire type.',
    mileage: 'Treadwear warranties available on many passenger and light truck tires.',
    url: 'https://www.toyotires.com/support/warranty',
  },
  {
    name: 'Cooper',
    warranty: 'Limited Manufacturer Warranty',
    coverage: 'Covers defects in workmanship and materials for the life of the original usable tread.',
    mileage: 'Treadwear warranties up to 80,000 miles on select models.',
    url: 'https://us.coopertire.com/support/tire-warranty',
  },
  {
    name: 'Falken',
    warranty: 'Limited Manufacturer Warranty',
    coverage: 'Covers defects in workmanship and materials.',
    mileage: 'Mileage warranties vary by tire model.',
    url: 'https://www.falkentire.com/warranty',
  },
  {
    name: 'Mickey Thompson',
    warranty: 'Limited Manufacturer Warranty',
    coverage: 'Covers defects in workmanship and materials for off-road and performance tires.',
    mileage: 'Warranty terms vary by tire line.',
    url: 'https://www.mickeythompsontires.com/customer-service/warranty',
  },
]

export default function WarrantyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Warranty Information</h1>
        <p className="text-gray-600 mb-8">
          All tires and wheels sold by Warehouse Tire Direct are covered by their respective 
          manufacturer warranties. Below you'll find warranty details for major brands we carry.
        </p>

        {/* General Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-10">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">How Warranty Claims Work</h2>
          <p className="text-blue-800 mb-3">
            If you believe you have a warranty issue with your tires or wheels:
          </p>
          <ol className="list-decimal pl-6 space-y-2 text-blue-800">
            <li>Contact us with your order number and description of the issue</li>
            <li>We'll help you determine if the issue is covered under warranty</li>
            <li>For valid claims, we'll coordinate with the manufacturer on your behalf</li>
            <li>Approved claims will result in repair, replacement, or pro-rated credit</li>
          </ol>
          <p className="text-sm text-blue-700 mt-4">
            <strong>Keep your receipt!</strong> Proof of purchase is required for all warranty claims.
          </p>
        </div>

        {/* Wheel Warranties */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Wheel Warranties</h2>
          <div className="grid gap-4">
            {wheelBrands.map((brand) => (
              <div key={brand.name} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{brand.name}</h3>
                    <p className="text-blue-600 font-medium text-sm mb-2">{brand.warranty}</p>
                    <p className="text-gray-600 text-sm mb-2">{brand.coverage}</p>
                    <p className="text-gray-500 text-sm"><strong>Finish:</strong> {brand.finish}</p>
                  </div>
                  <a
                    href={brand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    View Full Warranty →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tire Warranties */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Tire Warranties</h2>
          <div className="grid gap-4">
            {tireBrands.map((brand) => (
              <div key={brand.name} className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{brand.name}</h3>
                    <p className="text-blue-600 font-medium text-sm mb-2">{brand.warranty}</p>
                    <p className="text-gray-600 text-sm mb-2">{brand.coverage}</p>
                    <p className="text-gray-500 text-sm"><strong>Mileage:</strong> {brand.mileage}</p>
                  </div>
                  <a
                    href={brand.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-700 whitespace-nowrap"
                  >
                    View Full Warranty →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* What's Not Covered */}
        <section className="mb-12">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">What's Typically Not Covered</h2>
            <p className="text-gray-600 mb-4">
              Manufacturer warranties generally do not cover:
            </p>
            <ul className="grid md:grid-cols-2 gap-3">
              {[
                'Road hazard damage (punctures, cuts, impacts)',
                'Damage from accidents or collisions',
                'Improper installation or maintenance',
                'Use on vehicles other than specified',
                'Racing or competition use',
                'Damage from overloading or underinflation',
                'Cosmetic damage from curbs or debris',
                'Normal wear and tear',
                'Wheels used with incorrect lug nuts',
                'Products purchased used or second-hand',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-600">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Road Hazard */}
        <section className="mb-12">
          <div className="bg-gray-900 rounded-lg p-8 text-white">
            <h2 className="text-xl font-bold mb-3">Road Hazard Protection</h2>
            <p className="text-gray-300 mb-4">
              Worried about potholes, nails, or debris? Ask us about road hazard protection 
              plans that cover damage not included in manufacturer warranties.
            </p>
            <Link 
              href="/contact"
              className="inline-block bg-white text-gray-900 font-semibold py-2 px-6 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Ask About Road Hazard Coverage
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section>
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Have a Warranty Question?</h2>
            <p className="text-gray-600 mb-4">
              Our team can help you understand your warranty coverage and assist with claims.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/contact"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Contact Us
              </Link>
              <a 
                href="tel:+12483324120"
                className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Call (248) 332-4120
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
