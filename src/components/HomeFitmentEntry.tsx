"use client";

import { useState } from "react";
import { VisualFitmentLauncher } from "@/components/VisualFitmentLauncher";

type EntryMode = "vehicles" | "tires" | "wheels";

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

export function HomeFitmentEntry() {
  const [open, setOpen] = useState(false);
  const [startMode, setStartMode] = useState<EntryMode>("vehicles");

  function launch(mode: EntryMode) {
    setStartMode(mode);
    setOpen(true);
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-6">
      <div className="text-xs font-semibold text-neutral-600">Start shopping</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">Shop by vehicle</div>
      <div className="mt-1 text-sm text-neutral-700">Select your year, make, model and trim.</div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <EntryTile title="Vehicles" subtitle="Find options that fit your vehicle." onClick={() => launch("vehicles")} />
        <EntryTile title="Tires" subtitle="Browse tires after selecting your vehicle." onClick={() => launch("tires")} />
        <EntryTile title="Wheels" subtitle="Browse wheels after selecting your vehicle." onClick={() => launch("wheels")} />
      </div>

      <VisualFitmentLauncher open={open} onOpenChange={setOpen} startMode={startMode} showTrigger={false} />
    </div>
  );
}
