import { Metadata } from 'next';
import { 
  StatCard, 
  PricingCard, 
  ApiExample, 
  FaqAccordion, 
  AccessRequestForm 
} from '@/components/fitment-api';

export const metadata: Metadata = {
  title: 'Vehicle Fitment API | 14,000+ Verified Fitments | Production-Ready',
  description: 'Production-ready vehicle fitment API with bolt patterns, center bore, wheel sizes, tire sizes, and staggered fitment detection. No external dependencies. Built for tire and wheel ecommerce.',
};

// Primary API Example for hero section
const primaryApiExample = {
  endpoint: 'GET /api/public/fitment/specs?year=2020&make=Ford&model=F-150',
  response: {
    boltPattern: '6x135',
    centerBore: 87.1,
    threadSize: 'M14x1.5',
    offsetRange: [20, 44],
    wheelSizes: ['17x7.5', '18x8', '20x9'],
    tireSizes: ['265/70R17', '275/65R18'],
    staggered: false
  }
};

// FAQ Items
const faqItems = [
  {
    question: 'Is this data accurate?',
    answer: 'Yes. Our data is sourced from OEM specifications and continuously validated. This exact API powers a live tire and wheel ecommerce platform processing real customer orders. We stake our business on data accuracy.'
  },
  {
    question: 'Can I use this commercially?',
    answer: 'Absolutely. All plans are licensed for commercial use including production ecommerce sites, marketplaces, and SaaS platforms. You own the integration — we provide the data.'
  },
  {
    question: 'Do you allow caching?',
    answer: 'Yes. We encourage reasonable caching (24-48 hours recommended) to optimize your application performance. Vehicle fitment data changes infrequently, so caching is both allowed and smart.'
  },
  {
    question: 'Is this a replacement for Wheel-Size?',
    answer: 'Yes. If you\'re currently using Wheel-Size, scraping data, or maintaining your own fitment database, this API is a drop-in replacement with cleaner data, better reliability, and zero external dependencies.'
  },
  {
    question: 'What rate limits apply?',
    answer: 'Rate limits depend on your plan: Starter (10k/month), Growth (50k/month), Pro (200k/month). Burst limits are generous — we don\'t throttle reasonable traffic patterns. Enterprise plans have custom limits.'
  },
  {
    question: 'What vehicles are covered?',
    answer: 'We cover 2000-2026 model years with trim-level precision. This includes all major makes: Ford, Chevrolet, Toyota, Honda, RAM, GMC, Jeep, BMW, Mercedes-Benz, Dodge, and 50+ more. 14,000+ fitment records and growing.'
  },
  {
    question: 'Do you support staggered setups?',
    answer: 'Yes. We automatically detect and flag staggered fitments (different front/rear sizes). For vehicles like the Mustang GT, Camaro SS, or BMW M3, you\'ll get separate front and rear wheel/tire specifications.'
  },
  {
    question: 'How do I get started?',
    answer: 'Fill out the access request form and we\'ll review your application within 24 hours. Once approved, you\'ll receive your API key and documentation via email. We offer sandbox keys for testing before going live.'
  }
];

export default function FitmentApiPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/30 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-blue-400 text-sm font-medium">Production Ready</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Stop Guessing Fitment.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                Get Production-Ready Vehicle Data Instantly.
              </span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-8 max-w-3xl mx-auto leading-relaxed">
              14,000+ verified vehicle fitments including bolt patterns, offsets, and tire sizes — 
              built for real ecommerce platforms.
            </p>

            {/* Key Benefits */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 mb-10 text-sm">
              <div className="flex items-center gap-2 text-zinc-300">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                2000–2026 coverage
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Trim-level precision
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No third-party dependencies
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Built for production use
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#request-access" 
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-lg transition-colors text-lg"
              >
                Request API Access
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a 
                href="#endpoints" 
                className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 px-8 rounded-lg border border-zinc-700 transition-colors text-lg"
              >
                View API Documentation
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Example API Request - Visual Code Block */}
      <section className="py-12 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <h2 className="text-lg font-medium text-zinc-400">Example API Request</h2>
          </div>
          <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-800/70 border-b border-zinc-800">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <span className="text-zinc-500 text-sm ml-2 font-mono">api-request.sh</span>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <code className="text-sm sm:text-base">
                  <span className="text-green-400">GET</span>{' '}
                  <span className="text-blue-400">/api/public/fitment/specs?year=2020&make=Ford&model=F-150</span>
                </code>
              </div>
              <div className="border-t border-zinc-800 pt-4">
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Response</div>
                <pre className="text-sm text-zinc-300 overflow-x-auto">
                  <code>{JSON.stringify(primaryApiExample.response, null, 2)}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built For Section */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built For</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Whether you&apos;re replacing an existing solution or building from scratch, this API fits your stack.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { 
                icon: '🛞', 
                title: 'Tire & Wheel Ecommerce',
                desc: 'Build fitment selectors that actually work'
              },
              { 
                icon: '🏪', 
                title: 'Automotive Marketplaces',
                desc: 'Power listings with accurate fitment data'
              },
              { 
                icon: '🚗', 
                title: 'Dealership Software',
                desc: 'Integrate fitment into DMS and service systems'
              },
              { 
                icon: '🔄', 
                title: 'Replacing Wheel-Size',
                desc: 'Drop-in alternative with no scraping required'
              },
              { 
                icon: '🧹', 
                title: 'Replacing Scraping Solutions',
                desc: 'Clean API instead of brittle scrapers'
              },
              { 
                icon: '📊', 
                title: 'Any Fitment-Dependent Platform',
                desc: 'If you need accurate vehicle data, this is it'
              },
            ].map((item, i) => (
              <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex items-start gap-4">
                <div className="text-3xl">{item.icon}</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                  <p className="text-zinc-400 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What You Get</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Every API response includes complete fitment data. No nulls. No missing fields.
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { field: 'Bolt Pattern', example: '5x114.3, 6x135, 8x170' },
              { field: 'Center Bore', example: '70.5mm, 87.1mm, 124.9mm' },
              { field: 'Thread Size', example: 'M14x1.5, M12x1.5' },
              { field: 'Offset Ranges', example: '[20, 44], [30, 45]' },
              { field: 'Wheel Sizes', example: '17x7.5, 18x8, 20x9' },
              { field: 'Tire Sizes', example: '265/70R17, 275/65R18' },
              { field: 'Staggered Detection', example: 'true/false flag' },
              { field: 'Trim-Level Data', example: 'GT, SS, XLT, etc.' },
            ].map((item, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="font-semibold text-white mb-1">{item.field}</div>
                <div className="text-zinc-500 text-sm font-mono">{item.example}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why This API - Positioning Section */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Why Warehouse Tire Direct Fitment API</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Built different. No external dependencies. Fully controlled.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No External API Dependency</h3>
              <p className="text-zinc-400 text-sm">
                We own the data. No third-party APIs that can change pricing, rate limits, or disappear overnight.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Consistent Performance</h3>
              <p className="text-zinc-400 text-sm">
                Fast, reliable responses. No unpredictable latency from chained external calls.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Real Ecommerce Data</h3>
              <p className="text-zinc-400 text-sm">
                Built from fitment data that powers a live store processing real orders daily.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-orange-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">No Scraping Required</h3>
              <p className="text-zinc-400 text-sm">
                Stop maintaining brittle scrapers. Get clean, structured JSON from a real API.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Fully Controlled Dataset</h3>
              <p className="text-zinc-400 text-sm">
                We validate, maintain, and update the data. You focus on building your product.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Staggered Detection</h3>
              <p className="text-zinc-400 text-sm">
                Automatically identifies vehicles with different front/rear sizes. No manual mapping.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust / Credibility Stats */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600 mb-2">
                14,000+
              </div>
              <div className="text-zinc-400">Validated Vehicle Fitments</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-green-600 mb-2">
                2000–2026
              </div>
              <div className="text-zinc-400">Model Year Coverage</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600 mb-2">
                Production
              </div>
              <div className="text-zinc-400">Tested in Live Ecommerce</div>
            </div>
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section id="endpoints" className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">API Endpoints</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Simple, RESTful endpoints. Build a year → make → model → trim selector and get full fitment specs.
            </p>
            <p className="text-zinc-500 text-sm mt-4">
              All endpoints are available under <code className="bg-zinc-800 px-2 py-1 rounded text-blue-400">/api/public/fitment/*</code>
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { method: 'GET', path: '/api/public/fitment/years', desc: 'List available years' },
              { method: 'GET', path: '/api/public/fitment/makes?year=2024', desc: 'Makes for a year' },
              { method: 'GET', path: '/api/public/fitment/models?year=2024&make=ford', desc: 'Models for year + make' },
              { method: 'GET', path: '/api/public/fitment/trims?year=2024&make=ford&model=mustang', desc: 'Trims for vehicle' },
              { method: 'GET', path: '/api/public/fitment/specs?...', desc: 'Full fitment specifications' },
              { method: 'GET', path: '/api/public/fitment/search?vin=...', desc: 'VIN decode (coming soon)' },
            ].map((endpoint, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    {endpoint.method}
                  </span>
                </div>
                <code className="text-sm text-zinc-300 block mb-2 break-all">{endpoint.path}</code>
                <p className="text-zinc-500 text-sm">{endpoint.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, Predictable Pricing</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Start small and scale as you grow. All plans include full API access and documentation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PricingCard 
              name="Starter"
              price="$99"
              description="Perfect for small shops and testing"
              features={[
                'Up to 10,000 API calls/month',
                'All endpoints included',
                'Standard support',
                'API documentation',
                'Sandbox environment'
              ]}
            />
            <PricingCard 
              name="Growth"
              price="$249"
              description="For growing ecommerce businesses"
              features={[
                'Up to 50,000 API calls/month',
                'All endpoints included',
                'Priority support',
                'API documentation',
                'Sandbox environment',
                'Usage analytics'
              ]}
              highlighted
            />
            <PricingCard 
              name="Pro"
              price="$499"
              description="For high-volume operations"
              features={[
                'Up to 200,000 API calls/month',
                'All endpoints included',
                'Dedicated support',
                'API documentation',
                'Sandbox environment',
                'Usage analytics',
                'Custom integrations'
              ]}
            />
          </div>
          
          <p className="text-center text-zinc-500 mt-8">
            Need more? <a href="#request-access" className="text-blue-400 hover:text-blue-300">Contact us</a> for enterprise pricing.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Start Building with Reliable Fitment Data
          </h2>
          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto">
            Stop guessing. Stop scraping. Get production-ready fitment data that works.
          </p>
          <a 
            href="#request-access" 
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-10 rounded-lg transition-colors text-lg"
          >
            Request API Access
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>

      {/* Access Request Form */}
      <section id="request-access" className="py-20 bg-zinc-950">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Request API Access</h2>
            <p className="text-zinc-400">
              Fill out the form below and we&apos;ll get you set up within 24 hours.
            </p>
          </div>
          
          <AccessRequestForm />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-zinc-500 text-sm">
              © {new Date().getFullYear()} Warehouse Tire Direct. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="#endpoints" className="text-zinc-500 hover:text-white text-sm transition-colors">Documentation</a>
              <a href="/fitment-api/terms" className="text-zinc-500 hover:text-white text-sm transition-colors">Terms of Service</a>
              <a href="/fitment-api/privacy" className="text-zinc-500 hover:text-white text-sm transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
