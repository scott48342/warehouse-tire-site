"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

function EntryTile({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-left hover:border-neutral-300"
      onClick={onClick}
    >
      <div className="text-[11px] font-extrabold tracking-widest text-neutral-500">SHOP BY</div>
      <div className="mt-1 text-2xl font-extrabold text-neutral-900 group-hover:underline">{title}</div>
      <div className="mt-1 text-sm text-neutral-600">{subtitle}</div>
      <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 rounded-2xl border border-neutral-200 bg-white" />
    </button>
  );
}

function EntryTileLink({
  title,
  subtitle,
  href,
  accent,
}: {
  title: string;
  subtitle: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-3xl border p-6 text-left ${
        accent
          ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:border-amber-400"
          : "border-neutral-200 bg-neutral-50 hover:border-neutral-300"
      }`}
    >
      <div className="text-[11px] font-extrabold tracking-widest text-neutral-500">SHOP BY</div>
      <div className="mt-1 text-2xl font-extrabold text-neutral-900 group-hover:underline">{title}</div>
      <div className="mt-1 text-sm text-neutral-600">{subtitle}</div>
      <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 rounded-2xl border border-neutral-200 bg-white" />
    </Link>
  );
}

export function HomeFitmentEntry() {
  const router = useRouter();

  function launch(open: "tires" | "wheels" | "packages", mode?: "vehicle" | "size") {
    const modeParam = mode ? `&mode=${mode}` : "";
    router.push(`/?open=${open}${modeParam}`);
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6">
      <div className="text-xs font-semibold text-neutral-600">Start shopping</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">Shop by vehicle</div>
      <div className="mt-1 text-sm text-neutral-700">Select your year, make, model and trim.</div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <EntryTileLink
          title="Lifted & Off-Road Builds"
          subtitle="Build your lifted truck or SUV setup."
          href="/lifted"
          accent
        />
        <EntryTile
          title="Shop tires"
          subtitle="Search tires by size."
          onClick={() => launch("tires", "size")}
        />
        <EntryTile
          title="Shop wheels"
          subtitle="Search wheels (vehicle-based fitment)."
          onClick={() => launch("wheels", "vehicle")}
        />
      </div>
    </div>
  );
}
