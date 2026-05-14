import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Shipping Information | Warehouse Tire Direct',
  description: 'Fast nationwide shipping on tires and wheels. Most in-stock tire orders arrive in 1-3 business days from our nationwide distribution network.',
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Shipping Information</h1>

        {/* Free Shipping Banner */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            <span className="text-xl font-bold text-green-800">Free Shipping on Orders Over $1,500</span>
          </div>
          <p className="text-green-700">
            Most in-stock tire orders arrive in 1-3 business days
          </p>
        </div>

        {/* Fast Nationwide Fulfillment - NEW CONVERSION SECTION */}
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-8 mb-10">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-900 mb-2">Fast Nationwide Fulfillment</h2>
              <p className="text-blue-800 mb-3">
                Most in-stock tire orders are shipped from the nearest available supplier warehouse. 
                With distribution points across the country, many customers receive tires in as little 
                as <strong>1 business day</strong>, and most qualifying orders arrive within <strong>1-3 business days</strong>.
              </p>
              <p className="text-blue-700 text-sm">
                Delivery times depend on inventory availability, your location, and carrier schedules. 
                You'll receive tracking information via email as soon as your order ships.
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-8">
          {/* Shipping Methods */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Methods & Estimated Delivery</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 font-semibold text-gray-900">Product Type</th>
                    <th className="text-left py-3 font-semibold text-gray-900">Estimated Delivery</th>
                    <th className="text-left py-3 font-semibold text-gray-900">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="py-4">
                      <div className="font-medium text-gray-900">Standard Tire Shipping</div>
                      <div className="text-sm text-gray-500">Individual tires, sets of 4</div>
                    </td>
                    <td className="py-4">
                      <div className="text-gray-700 font-medium">Usually 1-3 business days</div>
                      <div className="text-sm text-gray-500">Many in-stock orders arrive next business day*</div>
                    </td>
                    <td className="py-4 text-gray-600">Free over $1,500 / Calculated at checkout</td>
                  </tr>
                  <tr>
                    <td className="py-4">
                      <div className="font-medium text-gray-900">Wheel Shipping</div>
                      <div className="text-sm text-gray-500">Individual wheels, sets of 4</div>
                    </td>
                    <td className="py-4">
                      <div className="text-gray-700 font-medium">Usually 2-5 business days</div>
                      <div className="text-sm text-gray-500">Varies by brand, finish, and availability</div>
                    </td>
                    <td className="py-4 text-gray-600">Free over $1,500 / Calculated at checkout</td>
                  </tr>
                  <tr>
                    <td className="py-4">
                      <div className="font-medium text-gray-900">Wheel & Tire Packages</div>
                      <div className="text-sm text-gray-500">Complete mounted assemblies</div>
                    </td>
                    <td className="py-4">
                      <div className="text-gray-700 font-medium">Usually 2-5 business days</div>
                      <div className="text-sm text-gray-500">Extra processing for matching & safe handling</div>
                    </td>
                    <td className="py-4 text-gray-600">Free over $1,500 / Calculated at checkout</td>
                  </tr>
                  <tr>
                    <td className="py-4">
                      <div className="font-medium text-gray-900">Store Pickup</div>
                      <div className="text-sm text-gray-500">Michigan locations only</div>
                    </td>
                    <td className="py-4">
                      <div className="text-gray-700 font-medium">Usually same or next day</div>
                      <div className="text-sm text-gray-500">We'll notify you when ready</div>
                    </td>
                    <td className="py-4 text-gray-600">Free</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>*Important:</strong> Delivery times are estimates. Actual delivery depends on 
                product availability, order cutoff time, carrier pickup schedules, product type, and 
                your destination. Tracking is emailed once your order ships.
              </p>
            </div>
          </section>

          {/* Processing Time */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Time</h2>
            <p className="text-gray-600 mb-4">
              Most in-stock orders are processed and shipped within <strong>1-2 business days</strong>. 
              Orders placed before 12:00 PM EST on business days are often processed the same day, 
              depending on inventory location.
            </p>
            <p className="text-gray-600">
              Orders ship from the warehouse closest to you with available inventory. You'll receive 
              tracking information via email once your order ships, typically within 24-48 hours.
            </p>
          </section>

          {/* Shipping Destinations */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Where We Ship</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Continental US</h3>
                <p className="text-gray-600">
                  We ship to all 48 contiguous states. Standard shipping rates apply, with free 
                  shipping available on qualifying orders.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Alaska, Hawaii & Puerto Rico</h3>
                <p className="text-gray-600">
                  We ship to these locations. Additional shipping charges apply due to distance 
                  and carrier surcharges. Rates calculated at checkout.
                </p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Note:</strong> We currently do not ship internationally. For international 
                inquiries, please <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link>.
              </p>
            </div>
          </section>

          {/* Carriers */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Shipping Carriers</h2>
            <p className="text-gray-600 mb-4">
              We work with trusted carriers to ensure your tires and wheels arrive safely:
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-gray-100 px-4 py-2 rounded-lg font-medium text-gray-700">FedEx</div>
              <div className="bg-gray-100 px-4 py-2 rounded-lg font-medium text-gray-700">UPS</div>
              <div className="bg-gray-100 px-4 py-2 rounded-lg font-medium text-gray-700">Freight (LTL)</div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Larger orders (typically 4+ wheels or full tire/wheel packages) may ship via freight 
              carrier for safe handling.
            </p>
          </section>

          {/* Order Tracking */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Tracking</h2>
            <p className="text-gray-600 mb-4">
              Once your order ships, you'll receive an email with tracking information. You can 
              track your package directly through the carrier's website or app.
            </p>
            <p className="text-gray-600">
              If you haven't received tracking information within 3 business days of placing your 
              order, please <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link> with 
              your order number.
            </p>
          </section>

          {/* Damaged Shipments */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Damaged or Missing Shipments</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Inspect Upon Delivery</h3>
                <p className="text-gray-600">
                  Please inspect your package upon delivery. If the packaging is visibly damaged, 
                  note the damage with the driver before signing.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Report Damage Promptly</h3>
                <p className="text-gray-600">
                  If you discover damage after opening your package, contact us within 48 hours 
                  with photos of the damage. We'll work with the carrier to resolve the issue.
                </p>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Missing Items</h3>
                <p className="text-gray-600">
                  If your order is missing items, check your tracking — items may ship separately. 
                  If all packages show delivered but items are missing, contact us immediately.
                </p>
              </div>
            </div>
          </section>

          {/* Store Pickup */}
          <section className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Store Pickup</h2>
            <p className="text-gray-600 mb-4">
              Skip the shipping and pick up your order at one of our Michigan locations:
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">Pontiac</p>
                <p className="text-gray-600 text-sm">1100 Cesar E Chavez Ave</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900">Waterford</p>
                <p className="text-gray-600 text-sm">4459 Pontiac Lake Road</p>
              </div>
            </div>
            <p className="text-gray-600">
              Select "Store Pickup" at checkout and choose your preferred location. We'll notify 
              you when your order is ready — usually the same or next business day.
            </p>
          </section>

          {/* Questions */}
          <section className="bg-blue-50 rounded-xl p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Questions About Your Shipment?</h2>
            <p className="text-gray-600 mb-4">
              Our team is here to help with any shipping questions or concerns.
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
                className="inline-block bg-white hover:bg-gray-100 text-gray-900 font-semibold py-2 px-6 rounded-lg transition-colors border border-gray-200"
              >
                Call (248) 332-4120
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
