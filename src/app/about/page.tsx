import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Us | Warehouse Tire Direct',
  description: 'Learn about Warehouse Tire Direct - your trusted source for tires and wheels in Oakland County, Michigan. Family-owned and operated with decades of experience.',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">About Warehouse Tire</h1>
          <p className="text-xl text-gray-300">
            Your trusted tire and wheel experts in Oakland County, Michigan
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Our Story */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Story</h2>
          <div className="bg-white rounded-xl shadow-sm p-8">
            <p className="text-gray-600 mb-4">
              Warehouse Tire has been serving the Oakland County community for decades. What started 
              as a small tire shop has grown into a trusted destination for drivers looking for 
              quality tires, wheels, and expert service at fair prices.
            </p>
            <p className="text-gray-600 mb-4">
              We believe in doing things the right way — recommending products that actually fit your 
              needs, not just the most expensive option on the shelf. Our team takes pride in helping 
              customers find the perfect tires and wheels for their vehicles, whether it's a daily 
              driver, a lifted truck, or a weekend toy.
            </p>
            <p className="text-gray-600">
              With two convenient locations in Pontiac and Waterford, we're here to serve you with 
              the same honest, knowledgeable service that's made us a trusted name in the community.
            </p>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Why Choose Warehouse Tire?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Expert Knowledge</h3>
              <p className="text-gray-600">
                Our team knows tires and wheels inside and out. We'll help you find the right 
                products for your vehicle, driving style, and budget.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Competitive Pricing</h3>
              <p className="text-gray-600">
                We work directly with top manufacturers to offer quality products at prices 
                that won't break the bank. No hidden fees, no surprises.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Professional Installation</h3>
              <p className="text-gray-600">
                State-of-the-art equipment and trained technicians ensure your tires and wheels 
                are mounted, balanced, and ready to roll.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="bg-blue-100 rounded-lg w-12 h-12 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Community Focus</h3>
              <p className="text-gray-600">
                We're not a faceless corporation — we're your neighbors. We've built our business 
                on relationships and referrals, and we intend to keep it that way.
              </p>
            </div>
          </div>
        </section>

        {/* What We Offer */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">What We Offer</h2>
          <div className="bg-white rounded-xl shadow-sm p-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Products</h3>
                <ul className="space-y-2">
                  {[
                    'Passenger & Light Truck Tires',
                    'Off-Road & All-Terrain Tires',
                    'Performance Tires',
                    'Aftermarket Wheels',
                    'Tire & Wheel Packages',
                    'Lift Kits & Suspension',
                    'TPMS Sensors',
                    'Lug Nuts & Accessories',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Services</h3>
                <ul className="space-y-2">
                  {[
                    'Tire Installation & Balancing',
                    'Wheel Mounting',
                    'TPMS Programming',
                    'Flat Repair',
                    'Tire Rotation',
                    'Alignment',
                    'Lift Kit Installation',
                    'Nationwide Shipping',
                  ].map((item, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Locations Preview */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Visit Us</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Pontiac</h3>
              <p className="text-gray-600 mb-1">1100 Cesar E Chavez Ave</p>
              <p className="text-gray-600 mb-3">Pontiac, MI 48340</p>
              <a href="tel:+12483324120" className="text-blue-600 hover:text-blue-700 font-medium">
                (248) 332-4120
              </a>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Waterford</h3>
              <p className="text-gray-600 mb-1">4459 Pontiac Lake Road</p>
              <p className="text-gray-600 mb-3">Waterford, MI 48328</p>
              <a href="tel:+12486830070" className="text-blue-600 hover:text-blue-700 font-medium">
                (248) 683-0070
              </a>
            </div>
          </div>
          <div className="text-center mt-6">
            <Link 
              href="/locations"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View store hours and directions →
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="bg-blue-600 rounded-xl p-8 text-center text-white">
            <h2 className="text-2xl font-bold mb-3">Ready to Get Started?</h2>
            <p className="text-blue-100 mb-6">
              Browse our selection online or visit us in store. We're here to help.
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
        </section>
      </div>
    </div>
  )
}
