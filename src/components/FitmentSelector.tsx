"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fitmentLabel, type Fitment } from "@/lib/fitment";

const YEARS = Array.from({ length: 26 }, (_, i) => String(new Date().getFullYear() - i));

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function FitmentSelector({
  onComplete,
  provider: _provider, // DEPRECATED: Provider param ignored - all data from internal DB only
  blank,
}: {
  onComplete?: (fitment: Fitment) => void;
  /** @deprecated No longer used - all data from internal database */
  provider?: string;
  /**
   * When true, the selector UI starts blank and ignores URL/localStorage prepopulation.
   * Intended for the mega menu SearchModal where we want an empty picker each time.
   */
  blank?: boolean;
} = {}) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const fitment = useMemo<Fitment>(() => {
    if (blank) return {};
    const year = sp.get("year") ?? undefined;
    const make = sp.get("make") ?? undefined;
    const model = sp.get("model") ?? undefined;
    const trim = sp.get("trim") ?? undefined;
    const modification = sp.get("modification") ?? undefined;
    return { year, make, model, trim, modification };
  }, [sp, blank]);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Fitment>(fitment);

  useEffect(() => {
    if (blank) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft((d) => {
      const same = d.year === fitment.year && d.make === fitment.make && d.model === fitment.model && d.trim === fitment.trim;
      return same ? d : fitment;
    });
  }, [fitment, blank]);

  // If the URL has no fitment params but we have a saved fitment, restore it into the URL.
  // This prevents /wheels from showing an essentially "unfiltered" WheelPros list.
  useEffect(() => {
    if (blank) return;
    try {
      const hasUrlFitment = Boolean(fitment.year || fitment.make || fitment.model || fitment.modification);
      if (hasUrlFitment) return;

      const raw = localStorage.getItem("wt_fitment");
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<Fitment>;
      if (!saved?.year || !saved?.make || !saved?.model) return;

      apply({
        year: String(saved.year),
        make: String(saved.make),
        model: String(saved.model),
        trim: saved.trim ? String(saved.trim) : undefined,
        modification: saved.modification ? String(saved.modification) : undefined,
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blank]);

  useEffect(() => {
    if (blank) return;
    // persist last fitment (URL-applied)
    try {
      localStorage.setItem("wt_fitment", JSON.stringify(fitment));
    } catch {}
  }, [fitment, blank]);

  useEffect(() => {
    if (blank) return;
    // also persist draft as the user is selecting (so SearchModal can navigate without needing "Apply")
    try {
      localStorage.setItem("wt_fitment_draft", JSON.stringify(draft));
    } catch {}
  }, [draft, blank]);

  function apply(next: Fitment) {
    const params = new URLSearchParams(sp.toString());
    for (const k of ["year", "make", "model", "trim", "modification"] as const) {
      params.delete(k);
      const v = next[k];
      if (v) params.set(k, v);
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const [makes, setMakes] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [trims, setTrims] = useState<Array<{ value: string; label: string; modificationId?: string }>>([]);

  // Load makes when year changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year) {
        setMakes([]);
        return;
      }
      try {
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/makes?year=${encodeURIComponent(draft.year)}`);
        if (!cancelled) setMakes(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setMakes([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year]);

  // Load models when make changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year || !draft.make) {
        setModels([]);
        return;
      }
      try {
        const qs = new URLSearchParams({ year: draft.year, make: draft.make });
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/models?${qs.toString()}`);
        if (!cancelled) setModels(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setModels([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year, draft.make]);

  // Load trims when model changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year || !draft.make || !draft.model) {
        setTrims([]);
        return;
      }
      try {
        const qs = new URLSearchParams({ year: draft.year, make: draft.make, model: draft.model });
        // NOTE: WheelPros fallback removed (2026-04-02). All trim data from internal DB only.
        const url = `/api/vehicles/trims?${qs.toString()}`;
        const data = await fetchJson<{ results: Array<{ value: string; label: string }> }>(url);
        if (!cancelled) setTrims(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setTrims([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year, draft.make, draft.model]);

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
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-w-[min(520px,calc(100vw-2rem))] rounded-2xl border border-neutral-200 bg-white p-4 shadow-xl"
        >
          <div className="grid gap-3 grid-cols-2">
            <Select
              label="Year"
              value={draft.year ?? ""}
              onChange={(v) =>
                setDraft(() => ({ year: v || undefined, make: undefined, model: undefined, trim: undefined, modification: undefined }))
              }
              options={["", ...YEARS]}
            />
            <Select
              label="Make"
              value={draft.make ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ ...d, make: v || undefined, model: undefined, trim: undefined, modification: undefined }))
              }
              options={["", ...makes]}
              disabled={!draft.year}
            />
            <Select
              label="Model"
              value={draft.model ?? ""}
              onChange={(v) =>
                setDraft((d) => ({ ...d, model: v || undefined, trim: undefined, modification: undefined }))
              }
              options={["", ...models]}
              disabled={!draft.make}
            />
            <Select
              label="Submodel"
              value={draft.modification ?? ""}
              onChange={(v) => {
                const sel = trims.find((t) => t.value === v);
                // Use modificationId if available, otherwise fall back to value
                const modificationId = sel?.modificationId || sel?.value || v;
                
                const next: Fitment = {
                  ...draft,
                  // Store modificationId as the canonical identifier
                  // (DB-first: no provider prefixes needed, all data from internal DB)
                  modification: v ? modificationId : undefined,
                  trim: sel?.label || undefined,
                };
                setDraft(next);

                // Log the selected modificationId
                if (next.modification) {
                  console.log(`[FitmentSelector] Selected: ${draft.year} ${draft.make} ${draft.model} → modificationId=${next.modification}, label=${sel?.label}`);
                }

                // UX: once trim/modification is selected, immediately complete.
                // If parent provided onComplete, let it handle navigation (e.g. SearchModal -> /wheels?...).
                // Otherwise, apply to the current URL.
                if (next.modification) {
                  try {
                    localStorage.setItem("wt_fitment", JSON.stringify(next));
                  } catch {}

                  // Always apply to the current URL (keeps state consistent even if parent navigation fails).
                  apply(next);

                  setOpen(false);
                  onComplete?.(next);
                }
              }}
              options={[{ value: "", label: "" }, ...trims]}
              disabled={!draft.model}
              hint={draft.model && trims.length === 0 ? "Options list coming soon" : undefined}
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
  options: Array<string | { value: string; label: string }>;
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
        {options.map((o) => {
          const opt = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label || `Select ${label}`}
            </option>
          );
        })}
      </select>
      {hint ? <span className="text-[11px] text-neutral-500">{hint}</span> : null}
    </label>
  );
}
