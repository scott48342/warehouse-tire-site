import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ | Warehouse Tire Direct',
  description: 'Frequently asked questions about ordering tires and wheels, shipping, fitment, returns, and more at Warehouse Tire Direct.',
}

const faqs = [
  {
    category: 'Ordering',
    questions: [
      {
        q: 'How do I know if tires or wheels will fit my vehicle?',
        a: 'Use our vehicle selector at the top of any page to enter your year, make, model, and trim. We\'ll only show you products that are confirmed to fit your specific vehicle. If you\'re unsure, contact us and we\'ll help you find the perfect fit.'
      },
      {
        q: 'Can I order online and pick up in store?',
        a: 'Yes! During checkout, select "Store Pickup" and choose either our Pontiac or Waterford location. We\'ll notify you when your order is ready for pickup.'
      },
      {
        q: 'Do you price match?',
        a: 'We strive to offer competitive pricing. If you find a lower price from an authorized dealer, contact us with the details and we\'ll do our best to match or beat it.'
      },
      {
        q: 'Can I order just one tire or wheel?',
        a: 'Yes, you can order any quantity you need. However, we recommend replacing tires in pairs (both front or both rear) for optimal safety and performance.'
      },
    ]
  },
  {
    category: 'Shipping',
    questions: [
      {
        q: 'How long does shipping take?',
        a: 'Most orders ship within 1-2 business days. Standard shipping typically takes 3-7 business days depending on your location. Expedited shipping options are available at checkout.'
      },
      {
        q: 'Do you offer free shipping?',
        a: 'Yes! We offer free standard shipping on most orders over $599. Some oversized items or remote locations may have additional shipping fees.'
      },
      {
        q: 'Do you ship to Alaska, Hawaii, or Puerto Rico?',
        a: 'Yes, we ship nationwide including Alaska, Hawaii, and Puerto Rico. Additional shipping charges may apply for these locations.'
      },
      {
        q: 'Can I track my order?',
        a: 'Absolutely. Once your order ships, you\'ll receive an email with tracking information. You can also check your order status by contacting us with your order number.'
      },
    ]
  },
  {
    category: 'Fitment & Installation',
    questions: [
      {
        q: 'Do you install tires and wheels?',
        a: 'Yes! Both our Pontiac and Waterford locations offer professional installation services. You can schedule an appointment online or call us to book a time.'
      },
      {
        q: 'What is included with wheel installation?',
        a: 'Our wheel installation service includes mounting, balancing, TPMS sensor transfer or replacement, and a final torque check. We\'ll also properly dispose of your old tires.'
      },
      {
        q: 'Do I need new lug nuts with aftermarket wheels?',
        a: 'Often yes. Aftermarket wheels frequently require different lug nuts than your factory wheels. We\'ll help you select the correct lug nuts for your specific wheel and vehicle combination.'
      },
      {
        q: 'What about TPMS sensors?',
        a: 'If your vehicle has TPMS (Tire Pressure Monitoring System), you\'ll need sensors for your new wheels. We can transfer your existing sensors or install new ones. We recommend new sensors if yours are more than 5 years old.'
      },
      {
        q: 'Can I run a different tire size than stock?',
        a: 'In many cases, yes. Our fitment system shows you compatible tire sizes for your vehicle, including plus-size options. Significant size changes may affect speedometer accuracy and should be done carefully.'
      },
    ]
  },
  {
    category: 'Returns & Warranty',
    questions: [
      {
        q: 'What is your return policy?',
        a: 'We accept returns of defective or incorrect items within 30 days of delivery. Items must be unmounted and in original condition. See our full return policy for details.'
      },
      {
        q: 'What if I receive a damaged product?',
        a: 'Contact us immediately with photos of the damage. We\'ll arrange a replacement or refund and provide a prepaid return label for the damaged item.'
      },
      {
        q: 'Are tires and wheels covered by warranty?',
        a: 'Yes. All products are covered by their manufacturer\'s warranty. Warranty terms vary by brand—contact us for specific warranty information on any product.'
      },
      {
        q: 'Can I return tires after they\'ve been mounted?',
        a: 'Unfortunately, mounted tires cannot be returned unless they are defective. Please verify fitment before installation.'
      },
    ]
  },
  {
    category: 'Payment',
    questions: [
      {
        q: 'What payment methods do you accept?',
        a: 'We accept all major credit cards (Visa, MasterCard, American Express, Discover), PayPal, and Shop Pay. For in-store purchases, we also accept cash and debit cards.'
      },
      {
        q: 'Is my payment information secure?',
        a: 'Yes. We use industry-standard SSL encryption and never store your full credit card information. All payments are processed securely through Stripe.'
      },
      {
        q: 'Do you offer financing?',
        a: 'Contact us about financing options for larger purchases. We can help you find a payment plan that works for your budget.'
      },
    ]
  },
]

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Frequently Asked Questions</h1>
        <p className="text-gray-600 mb-8">
          Find answers to common questions about ordering, shipping, fitment, and more.
        </p>
        
        <div className="space-y-8">
          {faqs.map((section) => (
            <div key={section.category} className="bg-white rounded-lg shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 pb-2 border-b border-gray-200">
                {section.category}
              </h2>
              <div className="space-y-6">
                {section.questions.map((item, idx) => (
                  <div key={idx}>
                    <h3 className="font-medium text-gray-900 mb-2">{item.q}</h3>
                    <p className="text-gray-600">{item.a}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 bg-blue-50 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Still have questions?</h2>
          <p className="text-gray-600 mb-4">
            Our team is here to help with any questions about tires, wheels, or your order.
          </p>
          <Link 
            href="/contact" 
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  )
}
