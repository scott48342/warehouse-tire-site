import { Metadata } from 'next'
import Link from 'next/link'
import { Phone, Clock, MapPin, Navigation } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Store Locations | Warehouse Tire Direct',
  description: 'Visit Warehouse Tire Direct in Pontiac or Waterford, Michigan. Professional tire and wheel installation, expert fitment advice, and great prices.',
}

const locations = [
  {
    name: 'Warehouse Tire Pontiac',
    address: '1100 Cesar E Chavez Ave',
    city: 'Pontiac, MI 48340',
    phone: '(248) 332-4120',
    phoneHref: 'tel:+12483324120',
    hours: [
      { days: 'Monday - Friday', time: '8:00 AM - 5:00 PM' },
      { days: 'Saturday', time: '8:00 AM - 3:00 PM' },
      { days: 'Sunday', time: 'Closed' },
    ],
    mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=1100+Cesar+E+Chavez+Ave+Pontiac+MI+48340',
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2934.8!2d-83.2911!3d42.6389!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8824c5a3c7b8a7a7%3A0x1234567890abcdef!2s1100%20Cesar%20E%20Chavez%20Ave%2C%20Pontiac%2C%20MI%2048340!5e0!3m2!1sen!2sus!4v1234567890',
  },
  {
    name: 'Warehouse Tire Waterford',
    address: '4459 Pontiac Lake Road',
    city: 'Waterford, MI 48328',
    phone: '(248) 683-0070',
    phoneHref: 'tel:+12486830070',
    hours: [
      { days: 'Monday - Friday', time: '8:00 AM - 5:00 PM' },
      { days: 'Saturday', time: '8:00 AM - 3:00 PM' },
      { days: 'Sunday', time: 'Closed' },
    ],
    mapUrl: 'https://www.google.com/maps/dir/?api=1&destination=4459+Pontiac+Lake+Road+Waterford+MI+48328',
    embedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2934.8!2d-83.3911!3d42.6689!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8824c5a3c7b8a7a7%3A0x1234567890abcdef!2s4459%20Pontiac%20Lake%20Rd%2C%20Waterford%2C%20MI%2048328!5e0!3m2!1sen!2sus!4v1234567890',
  },
]

const services = [
  'Tire Installation & Balancing',
  'Wheel Mounting',
  'TPMS Service & Programming',
  'Flat Repair',
  'Tire Rotation',
  'Alignment Check',
  'Lift Kit Installation',
  'Custom Wheel Fitment',
]

export default function LocationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Our Locations</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Visit us at one of our two convenient locations in Oakland County, Michigan. 
            Our expert team is ready to help you find the perfect tires and wheels for your vehicle.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-12">
          {locations.map((location) => (
            <div key={location.name} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Map */}
              <div className="h-64 bg-gray-200 relative">
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
              
              {/* Info */}
              <div className="p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{location.name}</h2>
                
                <div className="space-y-4">
                  {/* Address */}
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{location.address}</p>
                      <p className="text-gray-600">{location.city}</p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <a 
                      href={location.phoneHref}
                      className="text-gray-900 hover:text-blue-600 font-medium"
                    >
                      {location.phone}
                    </a>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      {location.hours.map((h, idx) => (
                        <div key={idx} className="flex justify-between gap-4">
                          <span className="text-gray-600">{h.days}</span>
                          <span className="text-gray-900 font-medium">{h.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <a
                    href={location.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
                  >
                    <Navigation className="w-4 h-4" />
                    Get Directions
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

        {/* Services */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Services Available at Both Locations</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
            {services.map((service, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-700">{service}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Why Visit */}
        <div className="bg-gray-900 rounded-xl p-8 text-white mb-12">
          <h2 className="text-2xl font-bold mb-6 text-center">Why Visit Us In-Store?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Expert Advice</h3>
              <p className="text-gray-400 text-sm">
                Our experienced team can help you choose the right tires and wheels for your vehicle and driving style.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">Same-Day Installation</h3>
              <p className="text-gray-400 text-sm">
                Many in-stock items can be installed the same day. Schedule ahead or walk in.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-600 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3 className="font-semibold mb-2">See Before You Buy</h3>
              <p className="text-gray-400 text-sm">
                Check out wheels in person and visualize how they'll look on your vehicle.
              </p>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to Visit?</h2>
          <p className="text-gray-600 mb-6">
            Schedule an appointment or just stop by — walk-ins are always welcome!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/schedule"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Schedule Appointment
            </Link>
            <Link 
              href="/contact"
              className="inline-block bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
