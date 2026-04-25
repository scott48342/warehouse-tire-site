"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CartSlideout } from "@/components/CartSlideout";
import { FirstOrderPopup } from "@/components/FirstOrderPopup";
import { CompareFloatingBadge } from "@/components/CompareFloatingBadge";
import { ComparePanel } from "@/components/ComparePanel";
import { Suspense } from "react";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname();
  const isPOS = pathname?.startsWith("/pos");

  if (isPOS) {
    // POS mode: minimal layout, no header/footer/popups
    return (
      <main className="flex-1 bg-gray-50">
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
      <main className="flex-1">
        {children}
      </main>
      <div className="relative z-20">
        <Footer />
      </div>
      <CartSlideout />
      <FirstOrderPopup />
      <CompareFloatingBadge />
      <ComparePanel />
    </>
  );
}
