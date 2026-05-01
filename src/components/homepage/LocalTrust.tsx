"use client";

import { Star, Award, Users, ThumbsUp } from "lucide-react";

/**
 * Local Trust Section - Social proof for local customers
 * 
 * Focus: Longevity, reviews, community trust
 */

const STATS = [
  {
    icon: Award,
    value: "38+",
    label: "Years in Business",
  },
  {
    icon: Users,
    value: "50,000+",
    label: "Customers Served",
  },
  {
    icon: Star,
    value: "4.8★",
    label: "Google Rating",
  },
  {
    icon: ThumbsUp,
    value: "500+",
    label: "5-Star Reviews",
  },
];

const TESTIMONIALS = [
  {
    quote: "Honest guys who won't try to sell you stuff you don't need. Been coming here for 10 years.",
    author: "Mike D.",
    location: "Pontiac",
  },
  {
    quote: "Fair prices and quick service. Had a flat on my lunch break, was back on the road in 20 minutes.",
    author: "Sarah K.",
    location: "Waterford",
  },
  {
    quote: "Family-owned, treats you like family. They remember my car and what I need.",
    author: "Tom R.",
    location: "Bloomfield",
  },
];

export function LocalTrust() {
  return (
    <section className="relative py-12">
      <div className="relative z-10 mx-auto max-w-5xl px-4">
        {/* Stats Strip */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <Icon className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-2xl md:text-3xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-white/60">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mt-10">
          <h3 className="text-center text-lg font-semibold text-white mb-6">
            What Our Neighbors Say
          </h3>
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, i) => (
              <div
                key={i}
                className="bg-white/5 rounded-xl p-5 border border-white/10"
              >
                <div className="flex gap-1 text-yellow-500 mb-3">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-white/80 text-sm italic">"{testimonial.quote}"</p>
                <p className="mt-3 text-xs text-white/50">
                  — {testimonial.author}, {testimonial.location}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Google Reviews CTA */}
        <div className="mt-8 text-center">
          <a
            href="https://www.google.com/search?q=Warehouse+Tire+Pontiac+MI+reviews"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            Read more reviews on Google →
          </a>
        </div>
      </div>
    </section>
  );
}
