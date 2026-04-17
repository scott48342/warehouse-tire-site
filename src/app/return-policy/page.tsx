import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Return Policy | Warehouse Tire Direct',
  description: 'Return policy for defective products at Warehouse Tire Direct.',
}

export default function ReturnPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Return Policy</h1>
        
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Defective Product Returns</h2>
            <p>
              At Warehouse Tire Direct, we stand behind the quality of our products. If you receive 
              a defective tire or wheel, we will work with you to make it right.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Return Eligibility</h2>
            <p className="mb-3">We accept returns for products that are:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Defective or damaged upon arrival</li>
              <li>Incorrect items shipped (wrong size, wrong product)</li>
              <li>Manufacturing defects discovered before installation</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Return Window</h2>
            <p>
              Defective products must be reported within <strong>30 days</strong> of delivery. 
              Please contact us as soon as you discover any defects or issues with your order.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">How to Request a Return</h2>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Contact our customer service team with your order number</li>
              <li>Provide photos of the defective product</li>
              <li>We will review your request and provide return instructions</li>
              <li>Once approved, we will provide a prepaid shipping label for defective items</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Return Shipping</h2>
            <p>
              For verified defective products, Warehouse Tire Direct will cover the return 
              shipping costs. We will provide a prepaid shipping label once your return is approved.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Refunds & Replacements</h2>
            <p>
              Once we receive and inspect the returned item, we will process your refund or 
              send a replacement, based on your preference and product availability. Refunds 
              are typically processed within 5-7 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Non-Returnable Items</h2>
            <p className="mb-3">The following items cannot be returned:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tires or wheels that have been mounted or installed</li>
              <li>Products with damage caused by improper installation or use</li>
              <li>Items returned after the 30-day return window</li>
              <li>Products without original packaging (when possible)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Us</h2>
            <p>
              For return requests or questions about our return policy, please contact us:
            </p>
            <p className="mt-3">
              <strong>Email:</strong> support@warehousetiredirect.com<br />
              <strong>Phone:</strong> (555) 123-4567
            </p>
          </section>

          <section className="pt-4 border-t border-gray-200 text-sm text-gray-500">
            <p>Last updated: July 2025</p>
          </section>
        </div>
      </div>
    </div>
  )
}
