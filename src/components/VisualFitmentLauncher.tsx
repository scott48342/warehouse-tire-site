"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fitmentLabel, type Fitment } from "@/lib/fitment";
import { extractDisplayTrim } from "@/lib/vehicleDisplay";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

type Step = "entry" | "year" | "make" | "model" | "trim";

type EntryMode = "vehicles" | "tires" | "wheels" | "packages";

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 70 }, (_, i) => String(THIS_YEAR - i));

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="absolute left-1/2 top-6 w-[min(980px,calc(100%-1.5rem))] -translate-x-1/2 rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        {children}
      </div>
    </div>
  );
}

function Crumb({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700">
      <span className="text-neutral-500">{label}: </span>
      <span className="font-extrabold text-neutral-900">{value || "—"}</span>
    </div>
  );
}

function makeInitials(make: string) {
  const cleaned = String(make || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(/\s+/g).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "");
  const out = letters.join("");
  return out.length ? out : cleaned.slice(0, 2).toUpperCase();
}

function makeHue(make: string) {
  // Deterministic hue so each make gets a stable badge color without needing official logos.
  let h = 0;
  for (let i = 0; i < make.length; i++) h = (h * 31 + make.charCodeAt(i)) >>> 0;
  return h % 360;
}

function MakeBadge({ make }: { make: string }) {
  const initials = makeInitials(make);
  const hue = makeHue(make);
  return (
    <div
      aria-hidden
      className="grid h-10 w-10 place-items-center rounded-2xl border border-neutral-200 text-xs font-extrabold text-neutral-900"
      style={{ background: `hsla(${hue}, 70%, 92%, 1)` }}
      title={make}
    >
      {initials}
    </div>
  );
}

function TileButton({ title, subtitle, onClick }: { title: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-50 p-6 text-left hover:border-neutral-300"
    >
      <div className="text-[11px] font-extrabold tracking-widest text-neutral-500">SHOP BY</div>
      <div className="mt-1 text-2xl font-extrabold text-neutral-900 group-hover:underline">{title}</div>
      {subtitle ? <div className="mt-1 text-sm text-neutral-600">{subtitle}</div> : null}
      <div className="pointer-events-none absolute right-6 top-6 h-10 w-10 rounded-2xl border border-neutral-200 bg-white" />
    </button>
  );
}

export function VisualFitmentLauncher({
  initialOpen = false,
  open,
  onOpenChange,
  startMode,
  showTrigger = true,
  onNavigateToWheels,
}: {
  initialOpen?: boolean;
  /** Controlled open (optional). */
  open?: boolean;
  /** Controlled open setter (optional). */
  onOpenChange?: (open: boolean) => void;
  /** When opening from outside, set the launcher to this initial mode. */
  startMode?: EntryMode;
  /** When false, renders only the modal (no trigger button). */
  showTrigger?: boolean;
  /** Optional override for navigation (useful for special pages) */
  onNavigateToWheels?: (fitment: Fitment) => void;
}) {
  const router = useRouter();

  const [openInternal, setOpenInternal] = useState(initialOpen);
  const isOpen = open ?? openInternal;
  const setIsOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (open === undefined) setOpenInternal(v);
  };

  const [mode, setMode] = useState<EntryMode>(startMode || "vehicles");
  const [step, setStep] = useState<Step>("entry");

  const wasOpen = useRef(false);

  useEffect(() => {
    // When opened externally (e.g. HomeFitmentEntry), start a fresh flow and skip the entry tiles.
    if (isOpen && !wasOpen.current) {
      resetAll();
      if (startMode) setMode(startMode);
      setStep("year");
    }
    wasOpen.current = isOpen;
  }, [isOpen, startMode]);

  const [draft, setDraft] = useState<Fitment>({});

  const crumbs = useMemo(
    () => [
      { label: "Year", value: draft.year },
      { label: "Make", value: draft.make },
      { label: "Model", value: draft.model },
      // Filter out engine text like "5.7i" from the trim breadcrumb
      { label: "Trim", value: extractDisplayTrim(draft.trim ?? "") || undefined },
    ],
    [draft]
  );

  function resetAll() {
    setDraft({});
    setStep("entry");
    setMode(startMode || "vehicles");
  }

  function close() {
    setIsOpen(false);
  }

  // Data for steps
  const [makes, setMakes] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [trims, setTrims] = useState<Array<{ value: string; label: string }>>([]);
  const [trimsLoading, setTrimsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year) {
        setMakes([]);
        setMakesLoading(false);
        return;
      }
      try {
        if (!cancelled) setMakesLoading(true);
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/makes?year=${encodeURIComponent(draft.year)}`);
        if (!cancelled) setMakes(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setMakes([]);
      } finally {
        if (!cancelled) setMakesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year || !draft.make) {
        setModels([]);
        setModelsLoading(false);
        return;
      }
      try {
        if (!cancelled) setModelsLoading(true);
        const qs = new URLSearchParams({ year: draft.year, make: draft.make });
        const data = await fetchJson<{ results: string[] }>(`/api/vehicles/models?${qs.toString()}`);
        if (!cancelled) setModels(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year, draft.make]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!draft.year || !draft.make || !draft.model) {
        setTrims([]);
        setTrimsLoading(false);
        return;
      }

      const qs = new URLSearchParams({ year: draft.year, make: draft.make, model: draft.model });

      // Prefer WheelPros submodels when available (best for wheel fitment + offset ranges).
      // If WheelPros doesn't have coverage for this Y/M/M, fall back to the generic trims endpoint.
      try {
        if (!cancelled) setTrimsLoading(true);

        const wp = await fetchJson<{ results: Array<{ value: string; label: string }> }>(
          `/api/wp/vehicles/submodels?${qs.toString()}`
        );
        const wpResults = Array.isArray(wp?.results) ? wp.results : [];
        if (wpResults.length) {
          // Normalize WheelPros submodels into our expected wp: token format.
          const normalized = wpResults.map((r) => ({
            value: `wp:${String(r.value)}`,
            label: String(r.label),
          }));
          if (!cancelled) setTrims(normalized);
          return;
        }
      } catch {
        // fall through
      }

      try {
        const data = await fetchJson<{ results: Array<{ value: string; label: string }> }>(
          `/api/vehicles/trims?${qs.toString()}`
        );
        if (!cancelled) setTrims(Array.isArray(data?.results) ? data.results : []);
      } catch {
        if (!cancelled) setTrims([]);
      } finally {
        if (!cancelled) setTrimsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft.year, draft.make, draft.model]);

  function complete(next: Fitment) {
    try {
      localStorage.setItem("wt_fitment", JSON.stringify(next));
      localStorage.setItem("wt_fitment_draft", JSON.stringify(next));
    } catch {}

    // Close the modal before navigating so the user doesn't see the entry tiles again.
    close();

    if (onNavigateToWheels) {
      onNavigateToWheels(next);
      return;
    }

    const qs = new URLSearchParams();
    if (next.year) qs.set("year", String(next.year));
    if (next.make) qs.set("make", String(next.make));
    if (next.model) qs.set("model", String(next.model));
    // Use 'modification' for canonical fitment identity (not 'trim')
    // The trim selector value is the modificationId
    if (next.modification) {
      qs.set("modification", String(next.modification));
    } else if (next.trim) {
      // next.trim contains the modificationId from the selector
      qs.set("modification", String(next.trim));
    }

    // Navigate based on entry mode
    if (mode === "tires") {
      router.push(`/tires?${qs.toString()}`);
      return;
    }
    if (mode === "wheels") {
      router.push(`/wheels?${qs.toString()}`);
      return;
    }
    if (mode === "packages") {
      qs.set("package", "1");
      router.push(`/wheels?${qs.toString()}`);
      return;
    }

    // Vehicles: default to packages flow (wheel + tire)
    qs.set("package", "1");
    router.push(`/wheels?${qs.toString()}`);
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => {
            // Scott preference: clicking Shop by vehicle should always start a fresh search
            // (no pre-filled saved vehicle; garage handles saved vehicles).
            resetAll();
            if (startMode) setMode(startMode);
            // Scott preference: go straight into the Year step (skip the entry tiles)
            setStep("year");
            setIsOpen(true);
          }}
          className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
        >
          Shop by vehicle
        </button>
      ) : null}

      <Modal
        open={isOpen}
        onClose={() => {
          close();
        }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 p-4">
          <div>
            <div className="text-xs font-semibold text-neutral-600">Vehicle selector</div>
            <div className="text-lg font-extrabold text-neutral-900">{fitmentLabel(draft)}</div>
          </div>
          <div className="flex items-center gap-2">
            {step !== "entry" ? (
              <button
                type="button"
                onClick={() => {
                  // simple back chain
                  setStep((s) => {
                    if (s === "trim") return "model";
                    if (s === "model") return "make";
                    if (s === "make") return "year";
                    if (s === "year") return "entry";
                    return "entry";
                  });
                }}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
              >
                Back
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                resetAll();
              }}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => {
                close();
              }}
              className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            {crumbs.map((c) => (
              <Crumb key={c.label} label={c.label} value={c.value} />
            ))}
          </div>

          {step === "entry" ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <TileButton
                title="Packages"
                subtitle="Wheel + tire packages"
                onClick={() => {
                  setMode("packages");
                  setStep("year");
                }}
              />
              <TileButton
                title="Tires"
                subtitle="Browse tires that fit"
                onClick={() => {
                  setMode("tires");
                  setStep("year");
                }}
              />
              <TileButton
                title="Wheels"
                subtitle="Browse wheels that fit"
                onClick={() => {
                  setMode("wheels");
                  setStep("year");
                }}
              />
              <TileButton
                title="All products"
                subtitle="Start with your vehicle"
                onClick={() => {
                  setMode("vehicles");
                  setStep("year");
                }}
              />
              <div className="md:col-span-2 lg:col-span-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                <div className="font-extrabold text-neutral-900">How it works</div>
                <div className="mt-1">
                  Pick a starting point, then choose <span className="font-semibold">Year</span>, <span className="font-semibold">Make</span>,
                  <span className="font-semibold"> Model</span> and <span className="font-semibold">Trim</span>.
                </div>
              </div>
            </div>
          ) : null}

          {step === "year" ? (
            <div className="mt-5">
              <div className="text-xs font-extrabold text-neutral-900">Select Year</div>
              <div className="mt-3 flex max-h-[420px] flex-wrap gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3">
                {YEARS.map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      setDraft({ year: y, make: undefined, model: undefined, trim: undefined, modification: undefined });
                      setStep("make");
                    }}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-extrabold " +
                      (draft.year === y
                        ? "border-[var(--brand-red)] bg-red-50 text-[var(--brand-red)]"
                        : "border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50")
                    }
                  >
                    {y}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "make" ? (
            <div className="mt-5">
              <div className="text-xs font-extrabold text-neutral-900">Select Make</div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {makesLoading ? "Loading makes…" : !draft.year ? "Pick a year first." : makes.length ? "" : "No makes found."}
              </div>
              <div className="mt-3 grid max-h-[460px] grid-cols-2 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-3 md:grid-cols-4">
                {makes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({ ...d, make: m, model: undefined, trim: undefined, modification: undefined }));
                      setStep("model");
                    }}
                    className={
                      "rounded-2xl border p-3 text-left " +
                      (draft.make === m
                        ? "border-[var(--brand-red)] bg-red-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <MakeBadge make={m} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-extrabold text-neutral-900">{m}</div>
                        <div className="mt-1 text-[11px] text-neutral-600">Tap to choose</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "model" ? (
            <div className="mt-5">
              <div className="text-xs font-extrabold text-neutral-900">Select Model</div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {modelsLoading ? "Loading models…" : !draft.make ? "Pick a make first." : models.length ? "" : "No models found."}
              </div>
              <div className="mt-3 grid max-h-[460px] grid-cols-2 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-3 md:grid-cols-4">
                {models.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({ ...d, model: m, trim: undefined, modification: undefined }));
                      setStep("trim");
                    }}
                    className={
                      "rounded-2xl border p-3 text-left " +
                      (draft.model === m
                        ? "border-[var(--brand-red)] bg-red-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50")
                    }
                  >
                    <div className="text-sm font-extrabold text-neutral-900">{m}</div>
                    <div className="mt-1 text-[11px] text-neutral-600">Tap to choose</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {step === "trim" ? (
            <div className="mt-5">
              <div className="text-xs font-extrabold text-neutral-900">Select Trim</div>
              <div className="mt-1 text-[11px] text-neutral-500">
                {trimsLoading ? "Loading trims…" : !draft.model ? "Pick a model first." : trims.length ? "" : "No trims found."}
              </div>
              <div className="mt-3 grid max-h-[460px] grid-cols-1 gap-2 overflow-auto rounded-2xl border border-neutral-200 bg-white p-3 sm:grid-cols-2">
                {trims.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      const next: Fitment = {
                        ...draft,
                        trim: t.label,
                        modification: t.value || undefined,
                      };
                      setDraft(next);
                      close();
                      complete(next);
                    }}
                    className={
                      "rounded-2xl border p-3 text-left " +
                      (draft.modification === `wp:${t.value}`
                        ? "border-[var(--brand-red)] bg-red-50"
                        : "border-neutral-200 bg-white hover:bg-neutral-50")
                    }
                  >
                    <div className="text-sm font-extrabold text-neutral-900">{t.label}</div>
                    <div className="mt-1 text-[11px] text-neutral-600">Tap to select</div>
                  </button>
                ))}
                {!trims.length ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
                    <div className="font-extrabold text-neutral-900">No trim list available for this vehicle.</div>
                    <div className="mt-1">You can continue without trim, or go back and pick a different model.</div>
                    <button
                      type="button"
                      onClick={() => {
                        const next: Fitment = {
                          ...draft,
                          trim: undefined,
                          modification: undefined,
                        };
                        close();
                        complete(next);
                      }}
                      className="mt-3 h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white"
                    >
                      Continue
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-5 text-[11px] text-neutral-500">
            Mode: <span className="font-semibold text-neutral-700">{mode}</span> (we’ll wire mode-specific landing actions after the core flow is done).
          </div>
        </div>
      </Modal>
    </>
  );
}
