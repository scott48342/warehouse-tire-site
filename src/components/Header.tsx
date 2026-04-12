"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

import { BRAND } from "@/lib/brand";

type LauncherMode = "vehicles" | "tires" | "wheels" | "packages";
import { VisualFitmentLauncher } from "@/components/VisualFitmentLauncher";
import { SearchModal } from "@/components/SearchModal";
import { CartIcon } from "@/components/CartIcon";

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
      <Link
        href="/lifted"
        className={`${base} ${pill}`}
      >
        Lifted Builds
      </Link>
    </div>
  );
}

export function Header() {
  const sp = useSearchParams();
  const tiresMenuRef = useRef<HTMLDetailsElement | null>(null);
  const wheelsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherMode, setLauncherMode] = useState<LauncherMode>("vehicles");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchType, setSearchType] = useState<"tires" | "wheels">("tires");
  const [searchMode, setSearchMode] = useState<"vehicle" | "size">("vehicle");

  function openLauncher(mode: LauncherMode) {
    // 🔍 DEBUG: RENDER FLOW AUDIT (2026-04-03)
    console.log('[HEADER_AUDIT] 🚀 openLauncher called with mode:', mode);
    closeMenus();
    setLauncherMode(mode);
    setLauncherOpen(true);
  }

  function openSearch(type: "tires" | "wheels", mode: "vehicle" | "size") {
    closeMenus();
    setSearchType(type);
    setSearchMode(mode);
    setSearchOpen(true);
  }

  function closeMenus() {
    if (tiresMenuRef.current) tiresMenuRef.current.open = false;
    if (wheelsMenuRef.current) wheelsMenuRef.current.open = false;
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeMenus();
    }

    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      // If click is inside either details element, ignore.
      if (tiresMenuRef.current && tiresMenuRef.current.contains(el)) return;
      if (wheelsMenuRef.current && wheelsMenuRef.current.contains(el)) return;
      closeMenus();
    }

    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, []);

  // Allow any page to open the VisualFitmentLauncher via query params.
  // Example: /?open=tires or /?open=packages
  useEffect(() => {
    const open = (sp.get("open") || "").trim();
    const mode = (sp.get("mode") || "").trim();
    if (open !== "tires" && open !== "wheels" && open !== "vehicles" && open !== "packages") return;

    // Support opening the DiscountTire-style search modal directly.
    // Example: /?open=tires&mode=size or /?open=tires&mode=vehicle
    if ((open === "tires" || open === "wheels") && (mode === "size" || mode === "vehicle")) {
      openSearch(open, mode as "size" | "vehicle");
    } else {
      openLauncher(open as LauncherMode);
    }

    // Clean the URL so refresh/back doesn't keep popping it.
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("open");
      url.searchParams.delete("mode");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

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
              onClick={() => openLauncher("tires")}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900"
            >
              Tires
            </button>
            <button
              type="button"
              onClick={() => openLauncher("wheels")}
              className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900"
            >
              Wheels
            </button>
          </div>
        </div>

        <nav className="hidden items-center gap-4 md:flex">
          {/* Simple menus (replace the old mega menu) */}
          <div className="flex items-center gap-4">
            <details ref={tiresMenuRef} className="group relative">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200">
                TIRES <span className="text-xs">▾</span>
              </summary>
              <div className="absolute left-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    openLauncher("tires");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop by vehicle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    openSearch("tires", "size");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop by size
                </button>
                <Link
                  href={withFitmentParams("/tires", sp)}
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop tires
                </Link>
                <div className="my-2 h-px bg-neutral-200" />
                <Link
                  href="/wheels?package=1"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Wheel & tire packages
                </Link>
              </div>
            </details>

            <details ref={wheelsMenuRef} className="group relative">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200">
                WHEELS <span className="text-xs">▾</span>
              </summary>
              <div className="absolute left-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    openLauncher("wheels");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop by vehicle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeMenus();
                    openSearch("wheels", "size");
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop by size
                </button>
                <Link
                  href={withFitmentParams("/wheels", sp)}
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Shop wheels
                </Link>
                <div className="my-2 h-px bg-neutral-200" />
                <Link
                  href="/wheels?package=1"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Wheel & tire packages
                </Link>
              </div>
            </details>

            <Link
              href="/rebates"
              className="inline-flex items-center gap-1.5 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-emerald-700 hover:border-emerald-200 hover:text-emerald-800"
            >
              <span>💰</span>
              REBATES
            </Link>

            <details className="group relative">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200">
                ACCESSORIES <span className="text-xs">▾</span>
              </summary>
              <div className="absolute left-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                <Link
                  href="/accessories/tpms"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  TPMS sensors
                </Link>
              </div>
            </details>

            <details className="group relative">
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200">
                LEARN <span className="text-xs">▾</span>
              </summary>
              <div className="absolute left-0 top-full z-[80] mt-2 w-64 rounded-2xl border border-neutral-200 bg-white p-2 shadow-xl">
                <Link
                  href="/tire-tech"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Tire Tech & Tips
                </Link>
                <Link
                  href="/blog"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  Blog
                </Link>
                <div className="my-2 h-px bg-neutral-200" />
                <Link
                  href="/blog/how-to-read-tire-sizes"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  How to Read Tire Sizes
                </Link>
                <Link
                  href="/blog/wheel-tire-packages-save-money"
                  onClick={() => closeMenus()}
                  className="block rounded-xl px-3 py-2 text-left text-sm text-neutral-600 hover:bg-neutral-50"
                >
                  Wheel & Tire Packages Guide
                </Link>
              </div>
            </details>

          </div>

          <button
            type="button"
            onClick={() => {
              // Detect current page to open launcher in correct mode
              const path = typeof window !== "undefined" ? window.location.pathname : "";
              const mode = path.startsWith("/tires") ? "tires" : "wheels";
              openLauncher(mode);
            }}
            className="inline-flex items-center justify-center rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            My Garage
          </button>

          <CartIcon />

          <PillLink href={BRAND.links.tel}>Call</PillLink>
          <button
            type="button"
            onClick={() => openLauncher("tires")}
            className="inline-flex items-center justify-center rounded-full bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
          >
            Shop Tires
          </button>
        </nav>
      </div>

      <SearchModal
        open={searchOpen}
        type={searchType}
        defaultMode={searchMode}
        onClose={() => setSearchOpen(false)}
      />

      <VisualFitmentLauncher
        open={launcherOpen}
        onOpenChange={setLauncherOpen}
        startMode={launcherMode}
        showTrigger={false}
      />
    </header>
  );
}
