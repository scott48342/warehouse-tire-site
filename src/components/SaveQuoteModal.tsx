"use client";

import { useRef } from "react";

export function SaveQuoteModal({
  linesJson,
  vehicle,
}: {
  linesJson: string;
  vehicle?: {
    year?: string;
    make?: string;
    model?: string;
    trim?: string;
    modification?: string;
  };
}) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);

  function open() {
    dlgRef.current?.showModal();
  }
  function close() {
    dlgRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
      >
        Save quote
      </button>

      <dialog ref={dlgRef} className="rounded-2xl p-0 backdrop:bg-black/40">
        <div className="w-[min(720px,92vw)] rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">Save this quote</div>
              <div className="mt-1 text-xs text-neutral-600">Enter your info to save this quote.</div>
            </div>
            <button
              type="button"
              onClick={close}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900"
            >
              Close
            </button>
          </div>

          <form action="/api/quotes/create" method="post" className="p-4">
            <input type="hidden" name="lines" value={linesJson} />
            <input type="hidden" name="year" value={vehicle?.year || ""} />
            <input type="hidden" name="make" value={vehicle?.make || ""} />
            <input type="hidden" name="model" value={vehicle?.model || ""} />
            <input type="hidden" name="trim" value={vehicle?.trim || ""} />
            <input type="hidden" name="modification" value={vehicle?.modification || ""} />

            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                First name
                <input name="firstName" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Last name
                <input name="lastName" required className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Email
                <input name="email" type="email" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Phone
                <input name="phone" inputMode="tel" className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm" />
              </label>
            </div>

            <div className="mt-2 text-[11px] text-neutral-600">Email or phone required.</div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="h-10 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-extrabold text-neutral-900"
              >
                Cancel
              </button>
              <button className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white">
                Save & view
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}
