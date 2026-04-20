import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | Warehouse Tire Direct',
  description: 'Privacy policy for Warehouse Tire Direct. Learn how we collect, use, and protect your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6 text-gray-700">
          <p className="text-sm text-gray-500">Last updated: April 2026</p>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Introduction</h2>
            <p>
              Warehouse Tire Direct ("we," "our," or "us") respects your privacy and is committed to protecting 
              your personal information. This Privacy Policy explains how we collect, use, disclose, and 
              safeguard your information when you visit our website warehousetiredirect.com or make a purchase 
              from us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Information We Collect</h2>
            <p className="mb-3">We collect information you provide directly to us, including:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Contact Information:</strong> Name, email address, phone number, shipping and billing addresses</li>
              <li><strong>Payment Information:</strong> Credit card details (processed securely through Stripe—we do not store full card numbers)</li>
              <li><strong>Vehicle Information:</strong> Year, make, model, and trim of your vehicle for fitment purposes</li>
              <li><strong>Order Information:</strong> Products purchased, order history, and preferences</li>
              <li><strong>Communications:</strong> Messages you send us through our contact form or email</li>
            </ul>
            <p className="mt-3">We also automatically collect certain information when you visit our website:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
              <li><strong>Usage Information:</strong> Pages visited, time spent on pages, links clicked</li>
              <li><strong>Location Information:</strong> General location based on IP address</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to your questions and provide customer support</li>
              <li>Recommend products that fit your vehicle</li>
              <li>Improve our website and services</li>
              <li>Send promotional emails (you can opt out at any time)</li>
              <li>Detect and prevent fraud</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Information Sharing</h2>
            <p className="mb-3">We do not sell your personal information. We may share your information with:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Service Providers:</strong> Companies that help us operate our business (payment processing, shipping, email services)</li>
              <li><strong>Shipping Carriers:</strong> To deliver your orders (FedEx, UPS, etc.)</li>
              <li><strong>Payment Processors:</strong> To securely process your payments (Stripe, PayPal)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies and Tracking</h2>
            <p>
              We use cookies and similar technologies to improve your browsing experience, analyze website 
              traffic, and personalize content. You can control cookies through your browser settings, but 
              disabling cookies may affect website functionality.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information 
              against unauthorized access, alteration, disclosure, or destruction. All payment transactions are 
              encrypted using SSL technology and processed through PCI-compliant payment processors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your information (subject to legal requirements)</li>
              <li>Opt out of marketing communications</li>
              <li>Request a copy of your data</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please <Link href="/contact" className="text-blue-600 hover:underline">contact us</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Links</h2>
            <p>
              Our website may contain links to third-party websites. We are not responsible for the privacy 
              practices of these external sites. We encourage you to read their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Children's Privacy</h2>
            <p>
              Our website is not intended for children under 13 years of age. We do not knowingly collect 
              personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes 
              by posting the new policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us:
            </p>
            <div className="mt-3">
              <p><strong>Email:</strong> support@warehousetiredirect.com</p>
              <p><strong>Phone:</strong> (248) 332-4120</p>
              <p className="mt-2">
                <strong>Warehouse Tire Direct</strong><br />
                1100 Cesar E Chavez Ave<br />
                Pontiac, MI 48340
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
