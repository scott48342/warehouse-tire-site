import { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Phone, Clock, MapPin, Navigation, CheckCircle, Truck, Shield, Star } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Tires Near Me in Pontiac & Waterford | Same-Day Installation | Warehouse Tire',
  description: 'Looking for tires near you in Pontiac or Waterford, MI? Warehouse Tire offers same-day installation, competitive prices, and expert service. Visit us today!',
  keywords: 'tires near me, tires pontiac mi, tires waterford mi, same day tire installation, tire shop near me, tire store pontiac, tire store waterford, new tires oakland county',
  openGraph: {
    title: 'Tires Near Me in Pontiac & Waterford | Same-Day Installation',
    description: 'Looking for tires near you? Warehouse Tire offers same-day installation at our Pontiac and Waterford locations. Expert service, great prices.',
    type: 'website',
  },
}

const locations = [
  {
    name: 'Pontiac Location',
    address: '1100 Cesar E Chavez Ave',
    city: 'Pontiac, MI 48340',
    phone: '(248) 332-4120',
    phoneHref: 'tel:+12483324120',
    hours: 'Mon-Fri 8AM-5PM, Sat 8AM-3PM',
    mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=1100+Cesar+E+Chavez+Ave+Pontiac+MI+48340',
  },
  {
    name: 'Waterford Location',
    address: '4459 Pontiac Lake Road',
    city: 'Waterford, MI 48328',
    phone: '(248) 683-0070',
    phoneHref: 'tel:+12486830070',
    hours: 'Mon-Fri 8AM-5PM, Sat 8AM-3PM',
    mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=4459+Pontiac+Lake+Road+Waterford+MI+48328',
  },
]

const benefits = [
  {
    icon: Clock,
    title: 'Same-Day Installation',
    description: 'Most in-stock tires installed the same day. No waiting, no hassle.',
  },
  {
    icon: Shield,
    title: 'Expert Fitment',
    description: 'Our experienced team ensures the right tires for your vehicle and driving needs.',
  },
  {
    icon: Truck,
    title: 'Huge Selection',
    description: 'Thousands of tires in stock from top brands like Michelin, Goodyear, BFGoodrich, and more.',
  },
  {
    icon: Star,
    title: 'Best Prices',
    description: 'Competitive pricing with frequent rebates and deals. We beat big box stores.',
  },
]

const services = [
  'New Tire Installation',
  'Tire Balancing',
  'TPMS Service',
  'Flat Repair',
  'Tire Rotation',
  'Alignment Check',
  'Wheel Mounting',
  'Valve Stem Replacement',
]

const popularBrands = [
  'Michelin', 'Goodyear', 'BFGoodrich', 'Continental', 'Pirelli', 
  'Bridgestone', 'Firestone', 'Cooper', 'Toyo', 'Nitto'
]

export default function TiresNearMePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[url('/images/tire-pattern.svg')] bg-repeat opacity-10" />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-red-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              <MapPin className="w-4 h-4" />
              Serving Pontiac, Waterford & Oakland County
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Tires Near You in<br />
              <span className="text-red-500">Pontiac & Waterford</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Looking for quality tires with <strong>same-day installation</strong>? 
              Warehouse Tire has served Oakland County for over 30 years. 
              Stop by today — no appointment needed!
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/tires"
                className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
              >
                Shop Tires Now
              </Link>
              <a
                href="tel:+12483324120"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors border border-white/20"
              >
                <Phone className="w-5 h-5" />
                Call (248) 332-4120
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-gray-100 py-6 border-b">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>30+ Years in Business</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Same-Day Installation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Free Quotes</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span>Price Match Guarantee</span>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Why Choose Warehouse Tire?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, idx) => (
              <div key={idx} className="text-center">
                <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 text-sm">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Locations */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Visit Us Today
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Two convenient locations in Oakland County. Walk-ins welcome — 
            most tires can be installed the same day!
          </p>
          
          <div className="grid md:grid-cols-2 gap-8">
            {locations.map((location) => (
              <div key={location.name} className="bg-white rounded-xl shadow-lg overflow-hidden">
                {/* Map embed */}
                <div className="h-48 bg-gray-200">
                  <iframe
                    src={`https://www.google.com/maps?q=${encodeURIComponent(location.address + ' ' + location.city)}&output=embed`}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Map of ${location.name}`}
                  />
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">{location.name}</h3>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-900">{location.address}</p>
                        <p className="text-gray-600">{location.city}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <a href={location.phoneHref} className="text-gray-900 hover:text-red-600 font-semibold">
                        {location.phone}
                      </a>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-red-600 flex-shrink-0" />
                      <span className="text-gray-600 text-sm">{location.hours}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <a
                      href={location.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Directions
                    </a>
                    <a
                      href={location.phoneHref}
                      className="flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-4 rounded-lg transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-4">
            Tire Services We Offer
          </h2>
          <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            From installation to maintenance, our expert technicians handle it all.
          </p>
          
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {services.map((service, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-4">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-800">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Brands */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">
            Top Tire Brands in Stock
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
            We carry all major tire brands. If we don&apos;t have it, we can get it — usually next day.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6">
            {popularBrands.map((brand, idx) => (
              <div key={idx} className="bg-white/10 px-6 py-3 rounded-lg text-white font-medium">
                {brand}
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Link
              href="/tires"
              className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors"
            >
              Browse All Tires
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ / SEO Content */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-8">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Do you offer same-day tire installation?
              </h3>
              <p className="text-gray-600">
                Yes! Most tires in our inventory can be installed the same day you purchase them. 
                Just stop by our Pontiac or Waterford location — no appointment necessary for most services. 
                For specialty or custom orders, we can often have tires ready within 24-48 hours.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                What areas do you serve?
              </h3>
              <p className="text-gray-600">
                Our two locations serve all of Oakland County including Pontiac, Waterford, 
                Bloomfield Hills, Troy, Rochester, Auburn Hills, Clarkston, White Lake, 
                West Bloomfield, and surrounding areas. We also ship tires nationwide through 
                our online store.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                How much does tire installation cost?
              </h3>
              <p className="text-gray-600">
                Our tire installation packages include mounting, balancing, new valve stems, 
                and TPMS reset. Pricing varies by tire size and vehicle type. Contact us or 
                stop by for a free quote — we guarantee competitive pricing.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Do you price match?
              </h3>
              <p className="text-gray-600">
                Yes! If you find a lower advertised price on the same tire from a local competitor, 
                let us know and we&apos;ll do our best to match or beat it. We want to earn your business.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-red-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready for New Tires?
          </h2>
          <p className="text-xl text-red-100 mb-8">
            Shop online or visit us in Pontiac or Waterford. Same-day installation available!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tires"
              className="inline-flex items-center justify-center gap-2 bg-white text-red-600 hover:bg-gray-100 font-bold py-4 px-8 rounded-lg text-lg transition-colors"
            >
              Shop Tires Online
            </Link>
            <Link
              href="/locations"
              className="inline-flex items-center justify-center gap-2 bg-red-700 hover:bg-red-800 text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors border border-red-500"
            >
              View Store Hours
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
