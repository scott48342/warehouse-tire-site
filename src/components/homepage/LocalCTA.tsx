"use client";

import Link from "next/link";
import { Phone, ShoppingBag, MessageCircle } from "lucide-react";

/**
 * Local CTA Section - Simple, friendly conversion close
 * 
 * Three options: Shop online, call, or chat
 */

export function LocalCTA() {
  return (
    <section className="relative py-12 mb-8">
      <div className="relative z-10 mx-auto max-w-4xl px-4">
        <div className="bg-gradient-to-r from-red-900/80 to-red-800/80 backdrop-blur-md rounded-2xl p-8 md:p-12 border border-red-700/30 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Ready for New Tires?
          </h2>
          <p className="mt-3 text-white/70 max-w-lg mx-auto">
            Shop online for the best price, or give us a call. We're here to help — no pressure, no games.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/tires"
              className="inline-flex items-center gap-2 rounded-lg bg-white text-red-700 hover:bg-gray-100 px-6 py-3 font-bold transition-all hover:scale-105"
            >
              <ShoppingBag className="w-5 h-5" />
              <span>Shop Tires Online</span>
            </Link>
            
            <a
              href="tel:+12483352696"
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-500 text-white px-6 py-3 font-bold transition-all hover:scale-105"
            >
              <Phone className="w-5 h-5" />
              <span>Call (248) 335-2696</span>
            </a>
          </div>

          <p className="mt-6 text-sm text-white/50">
            💬 Or use the chat in the bottom right corner
          </p>
        </div>
      </div>
    </section>
  );
}
