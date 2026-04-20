import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | Warehouse Tire Direct',
  description: 'Terms of service and conditions of use for Warehouse Tire Direct website and services.',
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Last updated: April 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Agreement to Terms</h2>
            <p>
              By accessing or using the Warehouse Tire Direct website (warehousetiredirect.com) and services, 
              you agree to be bound by these Terms of Service. If you do not agree to these terms, please do 
              not use our website or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Products and Services</h2>
            <p className="mb-3">
              Warehouse Tire Direct sells tires, wheels, and related automotive accessories. We also provide 
              installation services at our physical locations.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>All products are subject to availability</li>
              <li>We reserve the right to limit quantities</li>
              <li>Product images are for illustration purposes and may vary slightly from actual products</li>
              <li>Specifications are provided by manufacturers and believed to be accurate</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Pricing and Payment</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>All prices are in US dollars and are subject to change without notice</li>
              <li>Prices do not include shipping, taxes, or installation unless explicitly stated</li>
              <li>We reserve the right to correct pricing errors</li>
              <li>Payment is due at the time of order</li>
              <li>Orders are not confirmed until payment is successfully processed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Orders and Cancellations</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Order confirmation emails are sent after successful payment</li>
              <li>We reserve the right to refuse or cancel any order for any reason</li>
              <li>Orders may be cancelled if products are unavailable or pricing errors occur</li>
              <li>To cancel an order, contact us immediately—orders that have shipped cannot be cancelled</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Shipping</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Shipping times are estimates and not guaranteed</li>
              <li>Risk of loss passes to you upon delivery to the carrier</li>
              <li>You are responsible for providing accurate shipping information</li>
              <li>Additional charges may apply for address corrections or redelivery</li>
              <li>We are not responsible for delays caused by carriers, weather, or other circumstances beyond our control</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Returns and Refunds</h2>
            <p>
              Please review our <Link href="/return-policy" className="text-blue-600 hover:underline">Return Policy</Link> for 
              detailed information about returns, refunds, and exchanges. Key points:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>Defective or incorrect items may be returned within 30 days</li>
              <li>Mounted or installed products cannot be returned unless defective</li>
              <li>Refunds are processed to the original payment method</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Fitment Responsibility</h2>
            <p className="mb-3">
              While we provide fitment guidance based on manufacturer data:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are ultimately responsible for verifying that products fit your vehicle</li>
              <li>Modifications to your vehicle may affect fitment</li>
              <li>If you are unsure about fitment, contact us before ordering</li>
              <li>We are not liable for products that don't fit due to incorrect vehicle information provided by you</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Installation Services</h2>
            <p className="mb-3">
              For installation services at our physical locations:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Appointments are recommended but walk-ins may be accommodated</li>
              <li>You must disclose any known vehicle issues before service</li>
              <li>We are not responsible for pre-existing vehicle conditions discovered during service</li>
              <li>Installation warranties cover workmanship only, not product defects</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Warranty</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Products are covered by their respective manufacturer warranties</li>
              <li>We do not provide additional warranties beyond manufacturer warranties</li>
              <li>Warranty claims must be processed according to manufacturer procedures</li>
              <li>We can assist with warranty claims but are not the warrantor</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Warehouse Tire Direct shall not be liable for any 
              indirect, incidental, special, consequential, or punitive damages arising from your use of 
              our website or products, including but not limited to vehicle damage, personal injury, or 
              loss of use. Our total liability shall not exceed the amount you paid for the specific 
              product or service giving rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless Warehouse Tire Direct, its owners, employees, and 
              affiliates from any claims, damages, or expenses arising from your use of our website or 
              services, your violation of these terms, or your violation of any rights of another party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Intellectual Property</h2>
            <p>
              All content on this website, including text, images, logos, and software, is the property of 
              Warehouse Tire Direct or its licensors and is protected by copyright and trademark laws. You 
              may not reproduce, distribute, or create derivative works without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">User Conduct</h2>
            <p className="mb-3">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use the website for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with the proper functioning of the website</li>
              <li>Submit false or misleading information</li>
              <li>Use automated systems to access the website without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Governing Law</h2>
            <p>
              These Terms of Service shall be governed by the laws of the State of Michigan, without regard 
              to conflict of law provisions. Any disputes shall be resolved in the courts of Oakland County, 
              Michigan.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. Changes will be effective 
              immediately upon posting to the website. Your continued use of the website after changes 
              constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Severability</h2>
            <p>
              If any provision of these Terms is found to be unenforceable, the remaining provisions shall 
              continue in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p>
              If you have any questions about these Terms of Service, please <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link>.
            </p>
            <div className="mt-3">
              <p><strong>Warehouse Tire Direct</strong></p>
              <p>1100 Cesar E Chavez Ave</p>
              <p>Pontiac, MI 48340</p>
              <p>Phone: (248) 332-4120</p>
              <p>Email: support@warehousetiredirect.com</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
