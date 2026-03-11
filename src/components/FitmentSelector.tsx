"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fitmentLabel, type Fitment } from "@/lib/fitment";

const YEARS = Array.from({ length: 26 }, (_, i) => String(new Date().getFullYear() - i));
const MAKES = ["Ford", "Chevrolet", "GMC", "Ram", "Jeep", "Toyota", "Honda"]; // placeholder
const MODELS_BY_MAKE: Record<string, string[]> = {
  Ford: ["F-150", "Explorer", "Escape", "Mustang"],
  Chevrolet: ["Silverado 1500", "Equinox", "Tahoe"],
  GMC: ["Sierra 1500", "Yukon"],
  Ram: ["1500"],
  Jeep: ["Wrangler", "Grand Cherokee"],
  Toyota: ["Camry", "RAV4", "Tacoma"],
  Honda: ["Civic", "CR-V", "Accord"],
};
const TRIMS_BY_MODEL: Record<string, string[]> = {
  "F-150": ["XL", "XLT", "Lariat", "Platinum"],
  "Silverado 1500": ["WT", "LT", "RST", "High Country"],
  Wrangler: ["Sport", "Sahara", "Rubicon"],
  Camry: ["LE", "SE", "XSE"],
  Civic: ["LX", "Sport", "Touring"],
};

export function FitmentSelector() {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const fitment = useMemo<Fitment>(() => {
    const year = sp.get("year") ?? undefined;
    const make = sp.get("make") ?? undefined;
    const model = sp.get("model") ?? undefined;
    const trim = sp.get("trim") ?? undefined;
    return { year, make, model, trim };
  }, [sp]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Fitment>(fitment);

  useEffect(() => setDraft(fitment), [fitment]);

  useEffect(() => {
    // persist last fitment
    try {
      localStorage.setItem("wt_fitment", JSON.stringify(fitment));
    } catch {}
  }, [fitment]);

  function apply(next: Fitment) {
    const params = new URLSearchParams(sp.toString());
    for (const k of ["year", "make", "model", "trim"] as const) {
      params.delete(k);
      const v = next[k];
      if (v) params.set(k, v);
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  const models = draft.make ? MODELS_BY_MAKE[draft.make] ?? [] : [];
  const trims = draft.model ? TRIMS_BY_MODEL[draft.model] ?? [] : [];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <div>
          <div className="text-[11px] font-semibold text-neutral-600">Vehicle</div>
          <div className="text-sm font-extrabold text-neutral-900">
            {fitmentLabel(fitment)}
          </div>
        </div>
        <div className="text-xs font-semibold text-neutral-600">Change</div>
      </button>

      {open ? (
        <div
          role="dialog"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Year"
              value={draft.year ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ year: v || undefined, make: undefined, model: undefined, trim: undefined }))
              }
              options={["", ...YEARS]}
            />
            <Select
              label="Make"
              value={draft.make ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ ...d, make: v || undefined, model: undefined, trim: undefined }))
              }
              options={["", ...MAKES]}
              disabled={!draft.year}
            />
            <Select
              label="Model"
              value={draft.model ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ ...d, model: v || undefined, trim: undefined }))
              }
              options={["", ...models]}
              disabled={!draft.make}
            />
            <Select
              label="Trim"
              value={draft.trim ?? ""}
              onChange={(v) => setDraft((d) => ({ ...d, trim: v || undefined }))}
              options={["", ...trims]}
              disabled={!draft.model}
              hint={draft.model && trims.length === 0 ? "Trim list coming soon" : undefined}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setDraft(fitment);
              }}
              className="text-sm font-semibold text-neutral-600 hover:underline"
            >
              Cancel
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  apply({});
                  setOpen(false);
                }}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  apply(draft);
                  setOpen(false);
                }}
                className="rounded-xl bg-[var(--brand-red)] px-4 py-2 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <select
        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold disabled:bg-neutral-50 disabled:text-neutral-400"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || `Select ${label}`}
          </option>
        ))}
      </select>
      {hint ? <span className="text-[11px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}
