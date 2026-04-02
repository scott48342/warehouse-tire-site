import { Metadata } from 'next';
import { 
  StatCard, 
  PricingCard, 
  ApiExample, 
  FaqAccordion, 
  AccessRequestForm 
} from '@/components/fitment-api';

export const metadata: Metadata = {
  title: 'Vehicle Fitment API | 99% Coverage for 2000-2026',
  description: 'Production-ready vehicle fitment API with bolt patterns, center bore, wheel sizes, tire sizes, and staggered fitment detection. Built for tire shops, wheel retailers, and ecommerce platforms.',
};

// API Examples
const apiExamples = [
  {
    title: '2020 Ford Mustang GT',
    endpoint: '/api/fitment/specs?year=2020&make=ford&model=mustang&trim=GT',
    response: {
      year: 2020,
      make: 'ford',
      model: 'mustang',
      trim: 'GT',
      bolt_pattern: '5x114.3',
      center_bore_mm: 70.5,
      offset_min_mm: 30,
      offset_max_mm: 45,
      thread_size: 'M14x1.5',
      seat_type: 'conical',
      oem_wheel_sizes: ['18x8', '19x9 front', '19x9.5 rear'],
      oem_tire_sizes: ['235/50R18', '255/40R19 front', '275/40R19 rear'],
      is_staggered: true
    }
  },
  {
    title: '2020 Chevrolet Camaro SS',
    endpoint: '/api/fitment/specs?year=2020&make=chevrolet&model=camaro&trim=SS',
    response: {
      year: 2020,
      make: 'chevrolet',
      model: 'camaro',
      trim: 'SS',
      bolt_pattern: '5x120',
      center_bore_mm: 67.1,
      offset_min_mm: 27,
      offset_max_mm: 35,
      thread_size: 'M14x1.5',
      seat_type: 'conical',
      oem_wheel_sizes: ['20x8.5 front', '20x9.5 rear'],
      oem_tire_sizes: ['245/40R20 front', '275/35R20 rear'],
      is_staggered: true
    }
  },
  {
    title: '2015 Ford F-250 XLT',
    endpoint: '/api/fitment/specs?year=2015&make=ford&model=f-250&trim=XLT',
    response: {
      year: 2015,
      make: 'ford',
      model: 'f-250',
      trim: 'XLT',
      bolt_pattern: '8x170',
      center_bore_mm: 124.9,
      offset_min_mm: 40,
      offset_max_mm: 60,
      thread_size: 'M14x1.5',
      seat_type: 'conical',
      oem_wheel_sizes: ['17x7.5', '18x8', '20x8'],
      oem_tire_sizes: ['245/75R17', '275/65R18', '275/55R20'],
      is_staggered: false
    }
  }
];

// FAQ Items
const faqItems = [
  {
    question: 'What vehicles are covered?',
    answer: 'We cover 2000-2026 model years with 99%+ coverage for vehicles actually in production. This includes all major makes: Ford, Chevrolet, Toyota, Honda, RAM, GMC, Jeep, BMW, Mercedes-Benz, Audi, and 50+ more. We have 15,000+ fitment records with trim-level accuracy.'
  },
  {
    question: 'What data is included in the fitment response?',
    answer: 'Every fitment record includes: bolt pattern, center bore (hub bore), offset range, lug nut thread size, seat type, OEM wheel sizes, OEM tire sizes, and staggered fitment detection. All fields are guaranteed to be populated — no missing data.'
  },
  {
    question: 'Do you support staggered setups?',
    answer: 'Yes! We automatically detect and flag staggered fitments (different front/rear sizes). For vehicles like the Mustang GT, Camaro SS, or BMW M3, you\'ll get separate front and rear wheel/tire specifications.'
  },
  {
    question: 'How do I get an API key?',
    answer: 'Fill out the access request form and we\'ll review your application within 24 hours. Once approved, you\'ll receive your API key and documentation via email. We offer sandbox keys for testing before going live.'
  },
  {
    question: 'Can I use this on Shopify or custom sites?',
    answer: 'Absolutely. The API returns standard JSON and works with any platform: Shopify, WooCommerce, Magento, BigCommerce, or custom-built applications. We also provide JavaScript snippets for quick integration.'
  },
  {
    question: 'How accurate is the data?',
    answer: 'Our data is sourced from OEM specifications and verified against multiple references. We actively maintain and update the database. This same API powers a live tire and wheel ecommerce platform processing real orders.'
  },
  {
    question: 'Do you offer volume discounts?',
    answer: 'Yes. If you need more than 100,000 API calls per month or have enterprise requirements, contact us for custom pricing. We also offer dedicated support and SLA agreements for high-volume customers.'
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
        
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-blue-400 text-sm font-medium">Production Ready</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Vehicle Fitment API with{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-600">
                99% Coverage
              </span>
            </h1>
            
            <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Bolt patterns, center bore, trims, wheel sizes, tire sizes, and staggered fitment — 
              all in one API. Built for tire shops, wheel retailers, and ecommerce platforms.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="#request-access" 
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 px-8 rounded-lg transition-colors"
              >
                Request API Access
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a 
                href="#examples" 
                className="inline-flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 px-8 rounded-lg border border-zinc-700 transition-colors"
              >
                View Examples
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <StatCard value="2000–2026" label="Year Coverage" sublabel="27 model years" />
            <StatCard value="99%" label="Modern Coverage" sublabel="Vehicles in production" />
            <StatCard value="15,000+" label="Fitment Records" sublabel="Trim-level accuracy" />
            <StatCard value="100%" label="Data Completeness" sublabel="All fields populated" />
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built for Real Commerce</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              This isn&apos;t theoretical data. This API powers a live tire and wheel ecommerce platform 
              processing real customer orders every day.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Trim-Aware Fitment</h3>
              <p className="text-zinc-400 text-sm">
                GT vs EcoBoost. SS vs LT. Different trims have different specs. We handle that.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Staggered Detection</h3>
              <p className="text-zinc-400 text-sm">
                Automatically identifies vehicles with different front/rear wheel and tire sizes.
              </p>
            </div>
            
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Complete Data</h3>
              <p className="text-zinc-400 text-sm">
                100% field completeness. No nulls, no missing values. Every record is fully populated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Capabilities */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Simple, RESTful Endpoints</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Everything you need to build a year → make → model → trim selector and retrieve fitment specs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { method: 'GET', path: '/api/fitment/years', desc: 'List available years' },
              { method: 'GET', path: '/api/fitment/makes?year=2024', desc: 'Makes for a year' },
              { method: 'GET', path: '/api/fitment/models?year=2024&make=ford', desc: 'Models for year + make' },
              { method: 'GET', path: '/api/fitment/trims?year=2024&make=ford&model=mustang', desc: 'Trims for vehicle' },
              { method: 'GET', path: '/api/fitment/specs?...', desc: 'Full fitment specs' },
              { method: 'GET', path: '/api/fitment/search?vin=...', desc: 'VIN decode (coming soon)' },
            ].map((endpoint, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono bg-green-500/20 text-green-400 px-2 py-1 rounded">
                    {endpoint.method}
                  </span>
                  <code className="text-sm text-zinc-300 truncate">{endpoint.path}</code>
                </div>
                <p className="text-zinc-500 text-sm">{endpoint.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Examples */}
      <section id="examples" className="py-20 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">See It In Action</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Real responses from our API. Notice the staggered fitment detection and complete data fields.
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-6">
            {apiExamples.map((example, i) => (
              <ApiExample 
                key={i}
                title={example.title}
                endpoint={example.endpoint}
                response={example.response}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Built For Your Business</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Whether you&apos;re a local tire shop or a national marketplace, accurate fitment data drives sales and reduces returns.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🛞', title: 'Tire Shops', desc: 'Help customers find the right tires the first time' },
              { icon: '🏎️', title: 'Wheel Retailers', desc: 'Sell wheels with confidence in fitment' },
              { icon: '🛒', title: 'Ecommerce Stores', desc: 'Build fitment selectors into your storefront' },
              { icon: '💻', title: 'Developers', desc: 'Integrate fitment into any application' },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-zinc-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-zinc-950">
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
      <section className="py-20 border-t border-zinc-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          
          <FaqAccordion items={faqItems} />
        </div>
      </section>

      {/* CTA / Access Form */}
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
              <a href="#" className="text-zinc-500 hover:text-white text-sm transition-colors">Documentation</a>
              <a href="/fitment-api/terms" className="text-zinc-500 hover:text-white text-sm transition-colors">Terms of Service</a>
              <a href="/fitment-api/privacy" className="text-zinc-500 hover:text-white text-sm transition-colors">Privacy Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
