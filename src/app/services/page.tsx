import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Tire & Wheel Services in Pontiac & Waterford, MI | Warehouse Tire',
  description: 'Professional tire and wheel services in Pontiac and Waterford, Michigan. Tire installation, mounting, balancing, flat repair, TPMS service, and more. Visit our local shops today.',
  keywords: 'tire services pontiac mi, wheel services waterford mi, tire installation oakland county, tire balancing pontiac, tire mounting waterford, flat tire repair, tpms service michigan',
  openGraph: {
    title: 'Tire & Wheel Services | Warehouse Tire - Pontiac & Waterford, MI',
    description: 'Expert tire and wheel services in Oakland County. Installation, mounting, balancing, and repairs at our Pontiac and Waterford locations.',
  },
}

const services = [
  {
    name: 'Tire Installation',
    description: 'Professional mounting of new tires on your vehicle. We handle all sizes from passenger cars to heavy-duty trucks.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" strokeWidth={2} />
        <circle cx="12" cy="12" r="3" strokeWidth={2} />
      </svg>
    ),
    price: 'From $20/tire',
  },
  {
    name: 'Wheel Mounting & Balancing',
    description: 'Precision balancing ensures smooth rides and even tire wear. State-of-the-art Hunter equipment for accurate results.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    price: 'From $15/wheel',
  },
  {
    name: 'Flat Tire Repair',
    description: 'Quick puncture repairs to get you back on the road. We inspect and repair when safe, or recommend replacement if needed.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    price: 'From $25',
  },
  {
    name: 'Tire Rotation',
    description: 'Regular rotation extends tire life and ensures even wear. Recommended every 5,000-7,500 miles.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    price: 'From $30',
  },
  {
    name: 'TPMS Service',
    description: 'Tire Pressure Monitoring System diagnosis, sensor replacement, and programming for all makes and models.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    price: 'From $50/sensor',
  },
  {
    name: 'Custom Wheel Packages',
    description: 'Complete tire and wheel packages built for your vehicle. We handle fitment, mounting, balancing, and installation.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    price: 'Varies',
  },
]

const locations = [
  {
    name: 'Pontiac',
    address: '1100 Cesar E Chavez Ave',
    city: 'Pontiac, MI 48340',
    phone: '(248) 332-4120',
    hours: 'Mon-Fri 8am-6pm, Sat 8am-3pm',
    mapUrl: 'https://maps.google.com/?q=1100+Cesar+E+Chavez+Ave+Pontiac+MI+48340',
  },
  {
    name: 'Waterford',
    address: '4459 Pontiac Lake Road',
    city: 'Waterford, MI 48328',
    phone: '(248) 683-0070',
    hours: 'Mon-Fri 8am-6pm, Sat 8am-3pm',
    mapUrl: 'https://maps.google.com/?q=4459+Pontiac+Lake+Road+Waterford+MI+48328',
  },
]

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Tire & Wheel Services
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Pontiac & Waterford, Michigan
          </p>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Professional tire installation, mounting, balancing, and repairs from Oakland County's 
            trusted tire experts. Two convenient locations to serve you.
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Our Services</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, idx) => (
            <div 
              key={idx}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6"
            >
              <div className="text-blue-600 mb-4">
                {service.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {service.name}
              </h3>
              <p className="text-gray-600 text-sm mb-3">
                {service.description}
              </p>
              <p className="text-blue-600 font-medium text-sm">
                {service.price}
              </p>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 text-sm mt-6">
          * Prices may vary based on vehicle type and tire size. Call for exact quotes.
        </p>
      </div>

      {/* Why Choose Us */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Why Choose Warehouse Tire?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fast Service</h3>
              <p className="text-gray-600">
                Most installations completed same-day. Walk-ins welcome or schedule ahead.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Tire & Wheel Experts</h3>
              <p className="text-gray-600">
                Decades of experience with proper training and equipment for any tire or wheel job.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fair Pricing</h3>
              <p className="text-gray-600">
                Competitive rates with no hidden fees. We'll explain costs before we start.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Locations */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          Visit Our Locations
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          {locations.map((loc) => (
            <div 
              key={loc.name}
              className="bg-white rounded-xl shadow-sm p-8"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-4">{loc.name}</h3>
              <div className="space-y-3 text-gray-600">
                <p>
                  <span className="font-medium text-gray-900">Address:</span><br />
                  {loc.address}<br />
                  {loc.city}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Phone:</span><br />
                  <a href={`tel:${loc.phone.replace(/[^0-9]/g, '')}`} className="text-blue-600 hover:underline">
                    {loc.phone}
                  </a>
                </p>
                <p>
                  <span className="font-medium text-gray-900">Hours:</span><br />
                  {loc.hours}
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <a 
                  href={loc.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Directions
                </a>
                <a 
                  href={`tel:${loc.phone.replace(/[^0-9]/g, '')}`}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call Now
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Areas Served */}
      <div className="bg-gray-100 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Serving Oakland County & Beyond
          </h2>
          <p className="text-gray-600 text-center max-w-3xl mx-auto mb-8">
            Our Pontiac and Waterford locations serve customers throughout Oakland County and 
            surrounding areas. Whether you're in Bloomfield Hills, Auburn Hills, Lake Orion, 
            Clarkston, or anywhere nearby — we're here to help with all your tire and wheel needs.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {[
              'Pontiac', 'Waterford', 'Bloomfield Hills', 'Auburn Hills', 
              'Lake Orion', 'Clarkston', 'Rochester Hills', 'Troy', 
              'West Bloomfield', 'Commerce Township', 'White Lake', 'Orion Township'
            ].map((area) => (
              <span 
                key={area}
                className="bg-white px-4 py-2 rounded-full text-gray-700 shadow-sm"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="bg-blue-600 rounded-xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Need Tires or Wheels?</h2>
          <p className="text-blue-100 mb-6 max-w-xl mx-auto">
            Shop online or stop by one of our locations. We'll take care of you.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/tires"
              className="inline-block bg-white text-blue-600 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Shop Tires
            </Link>
            <Link 
              href="/wheels"
              className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Shop Wheels
            </Link>
            <Link 
              href="/contact"
              className="inline-block border-2 border-white text-white font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "TireShop",
            "name": "Warehouse Tire",
            "description": "Professional tire and wheel services in Pontiac and Waterford, Michigan. Installation, mounting, balancing, and repairs.",
            "url": "https://shop.warehousetire.net/services",
            "areaServed": [
              { "@type": "City", "name": "Pontiac", "addressRegion": "MI" },
              { "@type": "City", "name": "Waterford", "addressRegion": "MI" },
              { "@type": "AdministrativeArea", "name": "Oakland County", "addressRegion": "MI" }
            ],
            "hasOfferCatalog": {
              "@type": "OfferCatalog",
              "name": "Tire & Wheel Services",
              "itemListElement": [
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Tire Installation" }},
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Wheel Mounting" }},
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Wheel Balancing" }},
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Flat Tire Repair" }},
                { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "TPMS Service" }}
              ]
            },
            "location": [
              {
                "@type": "Place",
                "name": "Warehouse Tire - Pontiac",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "1100 Cesar E Chavez Ave",
                  "addressLocality": "Pontiac",
                  "addressRegion": "MI",
                  "postalCode": "48340"
                },
                "telephone": "+1-248-332-4120"
              },
              {
                "@type": "Place",
                "name": "Warehouse Tire - Waterford",
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "4459 Pontiac Lake Road",
                  "addressLocality": "Waterford",
                  "addressRegion": "MI",
                  "postalCode": "48328"
                },
                "telephone": "+1-248-683-0070"
              }
            ]
          })
        }}
      />
    </div>
  )
}
