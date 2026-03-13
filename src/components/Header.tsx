"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BRAND } from "@/lib/brand";
// FitmentSelector now lives inside the search modal / mega menu flow
import { SearchModal, type Mode } from "@/components/SearchModal";
import { MegaMenu } from "@/components/MegaMenu";

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

function withFitmentParams(href: string, sp: URLSearchParams) {
  const next = new URLSearchParams(sp.toString());
  const qs = next.toString();
  return qs ? `${href}?${qs}` : href;
}

function FitmentLink({
  href,
  className,
  children,
  disabled,
}: {
  href: string;
  className: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const sp = useSearchParams();
  const target = withFitmentParams(href, sp);
  if (disabled) {
    return (
      <span className={`${className} pointer-events-none opacity-50`}>
        {children}
      </span>
    );
  }
  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  );
}

function hasVehicle(sp: URLSearchParams) {
  return !!(sp.get("year") && sp.get("make") && sp.get("model"));
}

function FitmentTabs() {
  const sp = useSearchParams();
  const enabled = hasVehicle(sp);

  const base = "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-extrabold";
  const pill = "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50";
  const active = "bg-[var(--brand-red)] text-white hover:bg-[var(--brand-red-700)]";

  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isTires = path.startsWith("/tires");
  const isWheels = path.startsWith("/wheels");

  return (
    <div className="grid grid-cols-3 gap-2">
      <FitmentLink
        href="/tires"
        disabled={!enabled}
        className={`${base} ${isTires ? active : pill}`}
      >
        Tires
      </FitmentLink>
      <FitmentLink
        href="/wheels"
        disabled={!enabled}
        className={`${base} ${isWheels ? active : pill}`}
      >
        Wheels
      </FitmentLink>
      <span className={`${base} ${pill} pointer-events-none opacity-50`}>
        Packages
      </span>
    </div>
  );
}

export function Header() {
  const [modal, setModal] = useState<null | { type: "tires" | "wheels"; mode?: Mode }>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/warehouse-tire-logo.jpg"
            alt={BRAND.name}
            width={220}
            height={58}
            priority
            className="h-12 w-auto"
          />
        </Link>

        {/* Desktop selector removed in favor of DiscountTire-style mega menu */}

        {/* Mobile: use tap-based modals via the action bar / simple buttons below */}
        <div className="w-full md:hidden">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setModal({ type: "tires", mode: "vehicle" })}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900"
            >
              Tires
            </button>
            <button
              type="button"
              onClick={() => setModal({ type: "wheels", mode: "vehicle" })}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900"
            >
              Wheels
            </button>
          </div>
        </div>

        <nav className="hidden items-center gap-4 md:flex">
          <MegaMenu
            onOpenSearch={(type, mode) => {
              setModal({ type, mode });
            }}
          />

          <PillLink href={BRAND.links.tel}>Call</PillLink>
          <Link
            href="/schedule"
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
          >
            Schedule Install
          </Link>
        </nav>
      </div>

      <SearchModal
        open={modal?.type === "tires"}
        type="tires"
        defaultMode={modal?.type === "tires" ? modal.mode : undefined}
        onClose={() => setModal(null)}
      />
      <SearchModal
        open={modal?.type === "wheels"}
        type="wheels"
        defaultMode={modal?.type === "wheels" ? modal.mode : undefined}
        onClose={() => setModal(null)}
      />
    </header>
  );
}
