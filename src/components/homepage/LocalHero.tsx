"use client";

import Link from "next/link";
import { Phone, MapPin, Clock } from "lucide-react";

/**
 * Local Hero Section - Friendly neighborhood tire store feel
 * 
 * Focus: Service, trust, accessibility
 * NOT focus: Builds, packages, enthusiast vibes
 */

const STORES = [
  {
    name: "Pontiac",
    address: "209 S Telegraph Rd",
    phone: "(248) 335-2696",
    hours: "Mon-Fri 8am-6pm, Sat 8am-3pm",
  },
  {
    name: "Waterford",
    address: "4494 Highland Rd",
    phone: "(248) 674-4102",
    hours: "Mon-Fri 8am-6pm, Sat 8am-3pm",
  },
];

export function LocalHero() {
  return (
    <section className="relative py-12 md:py-20">
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        <div className="text-center">
          {/* Headline - warm, local feel */}
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Your Local Tire Experts
            <span className="block text-2xl md:text-3xl font-normal text-white/70 mt-2">
              Serving Oakland County Since 1986
            </span>
          </h1>
          
          {/* Quick value props */}
          <p className="mt-6 text-lg text-white/80 max-w-2xl mx-auto">
            Fair prices. Expert installation. No pressure, no hassle — just honest tire service from people who know your name.
          </p>

          {/* Primary CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tires"
              className="inline-flex items-center gap-2 rounded-lg bg-red-700 hover:bg-red-600 px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105"
            >
              <span>Shop Tires</span>
            </Link>
            
            <a
              href="tel:+12483352696"
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 hover:bg-green-600 px-8 py-4 text-lg font-bold text-white transition-all hover:scale-105"
            >
              <Phone className="w-5 h-5" />
              <span>Call Us Now</span>
            </a>
          </div>
          
          <p className="mt-4 text-sm text-white/50">
            Or stop by — walk-ins welcome
          </p>
        </div>
        
        {/* Store Cards */}
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {STORES.map((store) => (
            <div
              key={store.name}
              className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10 hover:border-white/20 transition-all"
            >
              <h3 className="text-xl font-bold text-white">{store.name} Location</h3>
              
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/50" />
                  <span>{store.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-white/50" />
                  <a href={`tel:${store.phone.replace(/[^\d]/g, '')}`} className="hover:text-white">
                    {store.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/50" />
                  <span>{store.hours}</span>
                </div>
              </div>
              
              <a
                href={`https://maps.google.com/?q=Warehouse+Tire+${store.name}+MI`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm text-red-400 hover:text-red-300"
              >
                Get Directions →
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
