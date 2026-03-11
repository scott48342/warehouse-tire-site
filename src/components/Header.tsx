"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { BRAND } from "@/lib/brand";
import { FitmentSelector } from "@/components/FitmentSelector";

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
    >
      {children}
    </a>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/warehouse-tire-logo.jpg"
            alt={BRAND.name}
            width={180}
            height={48}
            priority
            className="h-10 w-auto"
          />
        </Link>

        <div className="hidden flex-1 items-center justify-center md:flex">
          <div className="w-full max-w-xl rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-xs font-semibold text-neutral-700">Find wheels & tires that fit</div>
            <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto] lg:items-end">
              <Suspense
                fallback={
                  <div className="h-11 rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <div className="text-[11px] font-semibold text-neutral-600">Vehicle</div>
                    <div className="text-sm font-extrabold text-neutral-900">Select vehicle</div>
                  </div>
                }
              >
                <FitmentSelector />
              </Suspense>
              <Link
                href="/wheels"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
              >
                Browse Wheels
              </Link>
            </div>
          </div>
        </div>

        <nav className="ml-auto hidden items-center gap-2 md:flex">
          <Link
            href="/tires"
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Tires
          </Link>
          <Link
            href="/wheels"
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Wheels
          </Link>
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Schedule
          </Link>
          <PillLink href={BRAND.links.tel}>Call</PillLink>
          <PillLink href={BRAND.links.sms}>Text</PillLink>
          <PillLink href={BRAND.links.whatsapp}>WhatsApp</PillLink>
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
          >
            Schedule Install
          </Link>
        </nav>
      </div>
    </header>
  );
}
