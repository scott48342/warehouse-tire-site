"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function MegaMenu({
  onOpenSearch,
}: {
  onOpenSearch: (type: "tires" | "wheels", mode: "vehicle" | "size") => void;
}) {
  const [open, setOpen] = useState<null | "tires" | "wheels">(null);
  const closeTimer = useRef<number | null>(null);

  function scheduleClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(null), 120);
  }

  function cancelClose() {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function Trigger({ type, label }: { type: "tires" | "wheels"; label: string }) {
    const active = open === type;
    return (
      <button
        onMouseEnter={() => {
          cancelClose();
          setOpen(type);
        }}
        onMouseLeave={() => scheduleClose()}
        onFocus={() => setOpen(type)}
        className={
          active
            ? "inline-flex items-center gap-1 border-b-2 border-[var(--brand-red)] px-2 py-2 text-sm font-extrabold text-neutral-900"
            : "inline-flex items-center gap-1 border-b-2 border-transparent px-2 py-2 text-sm font-extrabold text-neutral-900 hover:border-neutral-200"
        }
        type="button"
        aria-haspopup="menu"
        aria-expanded={active}
      >
        {label}
        <span className="text-xs">▾</span>
      </button>
    );
  }

  function Panel({ type }: { type: "tires" | "wheels" }) {
    const isTires = type === "tires";
    return (
      <div
        onMouseEnter={() => cancelClose()}
        onMouseLeave={() => scheduleClose()}
        className="absolute left-0 right-0 top-full z-[70] border-b border-neutral-200 bg-white shadow-xl"
        role="menu"
      >
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[200px_1fr]">
          {/* Left action rail (DiscountTire-style) */}
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => onOpenSearch(type, "vehicle")}
              className="h-12 rounded-xl bg-neutral-100 px-3 text-left text-xs font-extrabold text-neutral-900 hover:bg-neutral-200"
            >
              SHOP BY VEHICLE
            </button>
            <button
              type="button"
              onClick={() => onOpenSearch(type, "size")}
              className="h-12 rounded-xl bg-neutral-100 px-3 text-left text-xs font-extrabold text-neutral-900 hover:bg-neutral-200"
            >
              SHOP BY SIZE
            </button>
            <Link
              href={isTires ? "/tires" : "/wheels"}
              className="h-12 rounded-xl bg-neutral-100 px-3 text-left text-xs font-extrabold text-neutral-900 hover:bg-neutral-200 flex items-center"
            >
              SHOP {isTires ? "TIRES" : "WHEELS"}
            </Link>
          </div>

          {/* Right columns (placeholder quick links like the screenshots) */}
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <div className="text-xs font-extrabold text-neutral-900">
                {isTires ? "TIRE BRAND" : "WHEEL BRAND"}
              </div>
              <div className="mt-3 grid gap-2 text-sm text-neutral-700">
                <span className="opacity-70">(Coming soon)</span>
              </div>
              <div className="mt-3">
                <Link href={isTires ? "/tires" : "/wheels"} className="text-sm font-extrabold text-blue-700 hover:underline">
                  View All
                </Link>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-neutral-900">
                {isTires ? "TIRE TYPE" : "WHEEL STYLE"}
              </div>
              <div className="mt-3 grid gap-2 text-sm text-neutral-700">
                <span className="opacity-70">(Coming soon)</span>
              </div>
              <div className="mt-3">
                <Link href={isTires ? "/tires" : "/wheels"} className="text-sm font-extrabold text-blue-700 hover:underline">
                  View All
                </Link>
              </div>
            </div>

            <div>
              <div className="text-xs font-extrabold text-neutral-900">VEHICLE TYPE</div>
              <div className="mt-3 grid gap-2 text-sm text-neutral-700">
                <span className="opacity-70">(Coming soon)</span>
              </div>
              <div className="mt-3">
                <Link href={isTires ? "/tires" : "/wheels"} className="text-sm font-extrabold text-blue-700 hover:underline">
                  View All
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-4">
        <Trigger type="tires" label="TIRES" />
        <Trigger type="wheels" label="WHEELS" />
        <Link href="/schedule" className="px-2 py-2 text-sm font-extrabold text-neutral-900 hover:underline">
          SCHEDULE
        </Link>
      </div>

      {open ? <Panel type={open} /> : null}
    </div>
  );
}
