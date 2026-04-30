import Link from "next/link";
import { BRAND } from "@/lib/brand";

/**
 * Site Footer
 * 
 * Clean, modern footer with navigation, legal links, and trust signals.
 * Responsive: 4 columns on desktop, stacked on mobile.
 */
export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-300">
      {/* Main Footer Content */}
      <div className="mx-auto max-w-screen-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          
          {/* Brand Section */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1">
            <Link href="/" className="inline-block">
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {BRAND.name}
              </h2>
            </Link>
            <p className="mt-2 text-sm text-neutral-400">
              Quality wheels & tires with verified fitment for your vehicle.
            </p>
            
            {/* Trust Badge */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-xs">
              <span className="text-green-400">✓</span>
              <span className="text-neutral-300">
                Verified fitment for 99% of vehicles (2000–{currentYear})
              </span>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Shop
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link 
                  href="/tires" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Shop Tires
                </Link>
              </li>
              <li>
                <Link 
                  href="/wheels" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Shop Wheels
                </Link>
              </li>
              <li>
                <Link 
                  href="/wheels?package=1" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Wheel & Tire Packages
                </Link>
              </li>
              <li>
                <Link 
                  href="/lifted" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Lifted Trucks
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link 
                  href="/financing" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Financing Options
                </Link>
              </li>
              <li>
                <Link 
                  href="/blog" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link 
                  href="/contact" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <Link 
                  href="/shipping" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Shipping Info
                </Link>
              </li>
              <li>
                <Link 
                  href="/returns" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Returns & Exchanges
                </Link>
              </li>
              <li>
                <Link 
                  href="/faq" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* API Section */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Developers
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link 
                  href="/fitment-api" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Fitment API
                </Link>
              </li>
              <li>
                <Link 
                  href="/fitment-api#request-access" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Request API Access
                </Link>
              </li>
              <li>
                <Link 
                  href="/fitment-api/terms" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  API Terms
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link 
                  href="/fitment-api/terms" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link 
                  href="/fitment-api/privacy" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>

            {/* Contact Info */}
            <h3 className="mt-6 text-sm font-bold text-white uppercase tracking-wider">
              Contact
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <a 
                  href="tel:+12483324120" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  (248) 332-4120
                </a>
              </li>
              <li>
                <a 
                  href="mailto:support@warehousetiredirect.com" 
                  className="text-sm text-neutral-400 hover:text-white transition-colors"
                >
                  support@warehousetiredirect.com
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-neutral-800">
        <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-neutral-500">
              © {currentYear} {BRAND.name}. All rights reserved.
            </p>
            
            {/* Payment/Trust Icons (optional placeholder) */}
            <div className="flex items-center gap-4">
              <span className="text-xs text-neutral-600">
                Secure checkout powered by Stripe
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
