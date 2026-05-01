"use client";

import { 
  CircleDot, 
  Wrench, 
  RotateCcw, 
  Target, 
  Gauge, 
  Shield,
  Truck,
  Car
} from "lucide-react";

/**
 * Local Services Section - What we actually do
 * 
 * Focus on practical services local customers need,
 * not enthusiast "builds" or "packages"
 */

const SERVICES = [
  {
    icon: CircleDot,
    title: "Tire Sales & Installation",
    description: "New tires installed same-day. We carry all major brands.",
  },
  {
    icon: Target,
    title: "Wheel Alignment",
    description: "Precision alignment to extend tire life and improve handling.",
  },
  {
    icon: RotateCcw,
    title: "Tire Rotation & Balance",
    description: "Even wear, smooth ride. Recommended every 5,000-7,500 miles.",
  },
  {
    icon: Wrench,
    title: "Flat Repair",
    description: "Quick, reliable flat repairs. Most done in under 30 minutes.",
  },
  {
    icon: Gauge,
    title: "TPMS Service",
    description: "Sensor programming, replacement, and diagnostics.",
  },
  {
    icon: Shield,
    title: "Road Hazard Protection",
    description: "Free replacement for covered damage. Ask about our plans.",
  },
];

const TIRE_TYPES = [
  {
    icon: Car,
    title: "Passenger & SUV",
    description: "Daily drivers, crossovers, minivans",
  },
  {
    icon: Truck,
    title: "Light Truck & HD",
    description: "Work trucks, towing, commercial",
  },
];

export function LocalServices() {
  return (
    <section className="relative py-12">
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        {/* Services Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            What We Do
          </h2>
          <p className="mt-2 text-white/60">
            Full-service tire shop — no appointment needed for most services
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          {SERVICES.map((service) => {
            const Icon = service.icon;
            return (
              <div
                key={service.title}
                className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10 hover:border-white/20 transition-all"
              >
                <Icon className="w-8 h-8 text-red-500 mb-3" />
                <h3 className="font-bold text-white">{service.title}</h3>
                <p className="mt-1 text-sm text-white/60">{service.description}</p>
              </div>
            );
          })}
        </div>

        {/* Tire Types - subtle section */}
        <div className="mt-10 pt-8 border-t border-white/10">
          <p className="text-center text-white/50 text-sm mb-6">
            We fit all vehicle types
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {TIRE_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <div key={type.title} className="flex items-center gap-3 text-white/70">
                  <Icon className="w-6 h-6" />
                  <div>
                    <p className="font-medium text-white">{type.title}</p>
                    <p className="text-xs text-white/50">{type.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
