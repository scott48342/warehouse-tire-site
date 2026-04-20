import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Financing Options | Warehouse Tire Direct',
  description: 'Flexible financing options for tires and wheels. Pay over time with Affirm or PayPal Credit. See if you prequalify with no impact to your credit score.',
}

export default function FinancingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Flexible Financing Options</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get the tires and wheels you need now and pay over time. We offer multiple financing 
            options to fit your budget — with no impact to your credit score when you prequalify.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Affirm */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-blue-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Affirm</h2>
                <img 
                  src="https://cdn-assets.affirm.com/images/white_logo-transparent_bg.svg" 
                  alt="Affirm" 
                  className="h-6"
                />
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Split your purchase into easy monthly payments. Choose the payment schedule that 
                works best for you.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">3 to 36 month terms</p>
                    <p className="text-sm text-gray-500">Choose what fits your budget</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">0% APR available</p>
                    <p className="text-sm text-gray-500">On qualifying purchases</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">No hidden fees</p>
                    <p className="text-sm text-gray-500">What you see is what you pay</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">$50 - $30,000</p>
                    <p className="text-sm text-gray-500">Purchase range</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Example:</strong> A $1,200 purchase could be as low as $100/month for 12 months.*
                </p>
                <p className="text-xs text-gray-500">
                  *Actual terms based on creditworthiness. Rates from 0-36% APR.
                </p>
              </div>

              <a
                href="https://www.affirm.com/apps/prequal"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
              >
                See if You Prequalify
              </a>
              <p className="text-xs text-gray-500 text-center mt-2">
                No impact to your credit score
              </p>
            </div>
          </div>

          {/* PayPal Credit */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-[#003087] px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">PayPal Credit</h2>
                <img 
                  src="https://www.paypalobjects.com/webstatic/mktg/logo/AM_SbyPP_mc_vs_dc_ae.jpg" 
                  alt="PayPal" 
                  className="h-6 rounded"
                />
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Get 6 months special financing on purchases of $99 or more when you check out 
                with PayPal Credit.
              </p>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">No Interest if paid in full in 6 months</p>
                    <p className="text-sm text-gray-500">On purchases of $99 or more</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Reusable credit line</p>
                    <p className="text-sm text-gray-500">Use it again and again</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Quick application</p>
                    <p className="text-sm text-gray-500">Get a decision in seconds</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 rounded-full p-1 mt-0.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Use your PayPal account</p>
                    <p className="text-sm text-gray-500">Easy checkout integration</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Example:</strong> Buy $1,200 in tires, pay it off within 6 months, and pay $0 in interest.
                </p>
                <p className="text-xs text-gray-500">
                  *Subject to credit approval. Interest charged from purchase date if not paid in full within 6 months.
                </p>
              </div>

              <a
                href="https://www.paypal.com/ppcreditapply/da/us/lander"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-[#003087] hover:bg-[#002266] text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
              >
                Apply for PayPal Credit
              </a>
              <p className="text-xs text-gray-500 text-center mt-2">
                Check if you prequalify with no credit impact
              </p>
            </div>
          </div>
        </div>

        {/* PayPal Pay in 4 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-12">
          <div className="bg-[#ffc439] px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">PayPal Pay in 4</h2>
              <span className="text-sm font-medium text-gray-700 bg-white/50 px-3 py-1 rounded-full">Interest-Free</span>
            </div>
          </div>
          <div className="p-6">
            <div className="md:flex md:items-center md:gap-8">
              <div className="md:flex-1 mb-6 md:mb-0">
                <p className="text-gray-600 mb-4">
                  Split your purchase into 4 interest-free payments. No extra fees when you pay on time.
                </p>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">0% interest</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">No fees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">$30 - $1,500</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-gray-700">6 weeks to pay</span>
                  </div>
                </div>
              </div>
              
              <div className="md:w-80 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 mb-3">Example: $400 purchase</p>
                <div className="flex justify-between items-center text-sm">
                  <div className="text-center">
                    <p className="font-bold text-gray-900">$100</p>
                    <p className="text-xs text-gray-500">Today</p>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">$100</p>
                    <p className="text-xs text-gray-500">2 weeks</p>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">$100</p>
                    <p className="text-xs text-gray-500">4 weeks</p>
                  </div>
                  <div className="text-gray-300">→</div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">$100</p>
                    <p className="text-xs text-gray-500">6 weeks</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Pay in 4 is available at checkout for eligible purchases. Just select PayPal and choose "Pay in 4" at checkout.
            </p>
          </div>
        </div>

        {/* How to Use */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Shop</h3>
              <p className="text-sm text-gray-600">
                Browse our selection of tires, wheels, and accessories
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Checkout</h3>
              <p className="text-sm text-gray-600">
                Select Affirm, PayPal Credit, or Pay in 4 at checkout
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Get Approved</h3>
              <p className="text-sm text-gray-600">
                Quick approval decision — usually in seconds
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <span className="text-xl font-bold text-blue-600">4</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Pay Over Time</h3>
              <p className="text-sm text-gray-600">
                Make easy payments that fit your budget
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Financing FAQ</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Does prequalifying affect my credit score?</h3>
              <p className="text-gray-600">
                No. Checking if you prequalify uses a soft credit check, which does not affect your credit score. 
                A hard credit check only occurs if you proceed with the full application.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Which financing option is best for me?</h3>
              <p className="text-gray-600">
                <strong>Affirm</strong> is great for larger purchases where you want predictable monthly payments over 3-36 months. 
                <strong> PayPal Credit</strong> is ideal if you can pay off your purchase within 6 months to avoid interest. 
                <strong> Pay in 4</strong> works well for smaller purchases you can pay off in 6 weeks.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I pay off my balance early?</h3>
              <p className="text-gray-600">
                Yes! Both Affirm and PayPal Credit allow early payoff with no prepayment penalties.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What if I'm not approved?</h3>
              <p className="text-gray-600">
                Approval depends on your credit profile. If you're not approved for one option, you may still 
                qualify for another. You can also use traditional payment methods like credit cards.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">Ready to shop?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/tires"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Shop Tires
            </Link>
            <Link 
              href="/wheels"
              className="inline-block bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Shop Wheels
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
