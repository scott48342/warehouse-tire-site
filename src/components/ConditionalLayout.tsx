"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartSlideout } from "@/components/CartSlideout";
// FirstOrderPopup re-enabled 2026-08-03 (was disabled 2026-06-11 by Package
// Merchandising MVP commit 4aec6db; national site lost its email capture)
import { FirstOrderPopup } from "@/components/FirstOrderPopup";
import { CompareFloatingBadge } from "@/components/CompareFloatingBadge";
import { ComparePanel } from "@/components/ComparePanel";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useShopContext } from "@/contexts/ShopContextProvider";
import { NATIONAL_CHECKOUT_PAUSED } from "@/lib/nationalCatalog";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const { isNational } = useShopContext();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isPOS = pathname?.startsWith("/pos");
  const isJake = pathname === "/jake";
  const isGarage = pathname?.startsWith("/garage");

  if (isPOS) {
    // POS mode: minimal layout, no header/footer/popups
    return (
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
    );
  }

  if (isJake || isGarage) {
    // Jake AI / Garage: fullscreen immersive, no header/footer
    return (
      <main className="flex-1 flex flex-col">
        {children}
      </main>
    );
  }

  // Normal site layout
  return (
    <>
      <Suspense fallback={<div className="h-16" />}>
        <Header />
      </Suspense>
      {mounted && NATIONAL_CHECKOUT_PAUSED && isNational && (
        <div className="bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white">
          Browse our catalog and contact our team to place an order. Online checkout is paused for the season.{" "}
          <Link href="/national-catalog" className="font-bold underline underline-offset-2">How to order</Link>
        </div>
      )}
      <main className="flex-1">
        {children}
      </main>
      <div className="relative z-20">
        <Footer />
      </div>
      <CartSlideout />
      {mounted && (!NATIONAL_CHECKOUT_PAUSED || !isNational) && <FirstOrderPopup />}
      <CompareFloatingBadge />
      <ComparePanel />
    </>
  );
}
