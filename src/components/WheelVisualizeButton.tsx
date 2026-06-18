"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// ═══════════════════════════════════════════════════════════════════════════════
// WHEEL VISUALIZE BUTTON
// ═══════════════════════════════════════════════════════════════════════════════
// "Visualize" pill for wheel SRP cards. When a customer arrived via a YMM search
// (so we know year/make/model), they can click this to see the actual wheel
// rendered on their vehicle using the same engine Jake uses (/api/jake/mockup).
//
// Color is intentionally NOT required from the customer — it only affects the
// paint of the rendered car, not the wheel look, so we default to a neutral
// color. This is visual inspiration only (not fitment verification).
//
// @created 2026-06-18
// ═══════════════════════════════════════════════════════════════════════════════

type Vehicle = {
  year?: string;
  make?: string;
  model?: string;
};

type WheelVisualizeButtonProps = {
  vehicle: Vehicle;
  wheelSku: string;
  wheelStyle: string;       // e.g. "Niche Misano Gloss Black" (brand + model + finish)
  wheelSize?: string;       // diameter, e.g. "20"
  wheelFinish?: string;     // discrete finish, e.g. "Satin Black" (cache + prompt)
  wheelImageUrl?: string;   // optional fallback if SKU resolution misses
  /** Default car color for the render (cosmetic only). */
  defaultColor?: string;
  className?: string;
  /** Compact pill (overlay on card image) vs full-width button. */
  variant?: "pill" | "block";
};

type MockupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; imageUrl: string; disclaimer: string; confidence?: string }
  | { status: "error"; message: string };

const LOADING_MESSAGES = [
  "Pulling up your vehicle…",
  "Mounting the wheels…",
  "Adjusting the stance…",
  "Rendering your build…",
  "Almost there…",
];

export function WheelVisualizeButton({
  vehicle,
  wheelSku,
  wheelStyle,
  wheelSize,
  wheelFinish,
  wheelImageUrl,
  defaultColor = "silver",
  className,
  variant = "pill",
}: WheelVisualizeButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<MockupState>({ status: "idle" });
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [mounted, setMounted] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => setMounted(true), []);

  const hasVehicle = Boolean(vehicle?.year && vehicle?.make && vehicle?.model);

  // Rotate the loading copy so a 10-30s wait feels alive.
  useEffect(() => {
    if (state.status !== "loading") return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 3500);
    return () => clearInterval(id);
  }, [state.status]);

  const generate = useCallback(async () => {
    if (!hasVehicle) return;
    const myReq = ++reqRef.current;
    setState({ status: "loading" });
    setLoadingMsg(LOADING_MESSAGES[0]);
    try {
      const res = await fetch("/api/jake/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle: {
            year: vehicle.year,
            make: vehicle.make,
            model: vehicle.model,
            color: defaultColor,
          },
          build: {
            wheelSku,
            wheelStyle,
            wheelSize: wheelSize || "20",
            wheelFinish: wheelFinish || undefined,
            wheelImageUrl: wheelImageUrl || undefined,
            // The SRP card already holds the exact, finish-accurate per-SKU
            // product image. Trust it instead of letting the API re-resolve a
            // (possibly wrong-finish) image via fuzzy search.
            trustImageUrl: true,
            style: "stock",
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (myReq !== reqRef.current) return; // superseded
      if (res.ok && data?.success && data?.imageUrl) {
        setState({
          status: "done",
          imageUrl: data.imageUrl,
          disclaimer: data.disclaimer || "AI visual mockup only — final appearance may vary.",
          confidence: data.confidence,
        });
      } else {
        setState({
          status: "error",
          message:
            data?.error ||
            "We couldn't generate a preview for this combo right now. Please try again.",
        });
      }
    } catch {
      if (myReq !== reqRef.current) return;
      setState({
        status: "error",
        message: "Network hiccup generating the preview. Please try again.",
      });
    }
  }, [hasVehicle, vehicle, defaultColor, wheelSku, wheelStyle, wheelSize, wheelFinish, wheelImageUrl]);

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(true);
      if (state.status === "idle" || state.status === "error") {
        void generate();
      }
    },
    [generate, state.status]
  );

  const handleClose = useCallback(() => setOpen(false), []);

  // Don't render the control at all if we have no vehicle context.
  if (!hasVehicle) return null;

  const vehicleLabel = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;

  const pill = (
    <button
      type="button"
      onClick={handleOpen}
      title={`See ${wheelStyle} on your ${vehicleLabel}`}
      aria-label={`Visualize ${wheelStyle} on your ${vehicleLabel}`}
      className={
        variant === "pill"
          ? `inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-neutral-200 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm hover:bg-white hover:text-neutral-900 hover:shadow-md transition-all duration-200 ${className || ""}`
          : `inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition-all ${className || ""}`
      }
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      Visualize
    </button>
  );

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={handleClose}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <div
              className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-neutral-100 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-neutral-900 truncate">{wheelStyle}</div>
                  <div className="text-xs text-neutral-500 truncate">
                    on your {vehicleLabel}
                    {wheelSize ? ` · ${wheelSize}"` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-neutral-100">
                  {state.status === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                      <svg className="h-8 w-8 animate-spin text-red-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <div className="text-sm font-medium text-neutral-600">{loadingMsg}</div>
                      <div className="text-[11px] text-neutral-400">This can take up to 30 seconds</div>
                    </div>
                  )}

                  {state.status === "done" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.imageUrl}
                      alt={`${wheelStyle} on ${vehicleLabel}`}
                      className="h-full w-full object-cover"
                    />
                  )}

                  {state.status === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                      <div className="text-3xl">😕</div>
                      <div className="text-sm text-neutral-600">{state.message}</div>
                      <button
                        type="button"
                        onClick={() => void generate()}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <p className="mt-3 text-[11px] leading-relaxed text-neutral-400">
                  {state.status === "done"
                    ? state.disclaimer
                    : "AI visual mockup for inspiration only. Final fitment and appearance may vary based on size, offset, tire, trim, suspension, and lighting."}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {pill}
      {modal}
    </>
  );
}

export default WheelVisualizeButton;
