"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";

export function AddTiresModal({
  sizes,
  baseParams,
  disabledReason,
}: {
  sizes: string[];
  baseParams: Record<string, string | undefined>;
  disabledReason?: string;
}) {
  const dlgRef = useRef<HTMLDialogElement | null>(null);

  const baseQs = useMemo(() => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams)) {
      if (v) sp.set(k, v);
    }
    return sp;
  }, [baseParams]);

  function open() {
    dlgRef.current?.showModal();
  }
  function close() {
    dlgRef.current?.close();
  }

  const disabled = !!disabledReason;

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        className={
          "inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-extrabold " +
          (disabled
            ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400"
            : "border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300")
        }
        title={disabledReason || ""}
      >
        Add tires
      </button>

      <dialog ref={dlgRef} className="rounded-2xl p-0 backdrop:bg-black/40">
        <div className="w-[min(720px,92vw)] rounded-2xl border border-neutral-200 bg-white">
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-4">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">Add tires</div>
              <div className="mt-1 text-xs text-neutral-600">Pick an OEM size (we’ll confirm fitment before install).</div>
            </div>
            <button
              type="button"
              onClick={close}
              className="h-9 rounded-xl border border-neutral-200 bg-white px-3 text-xs font-extrabold text-neutral-900"
            >
              Close
            </button>
          </div>

          <div className="p-4">
            {sizes?.length ? (
              <div className="flex flex-wrap gap-2">
                {sizes.slice(0, 12).map((s) => {
                  const sp = new URLSearchParams(baseQs);
                  sp.set("size", s);
                  return (
                    <Link
                      key={s}
                      href={`/tires?${sp.toString()}`}
                      className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-extrabold text-neutral-900 hover:border-neutral-300"
                    >
                      {s}
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
                No OEM tire sizes found for this vehicle yet.
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] text-neutral-600">
                Tip: choose a size first, then pick your tire model.
              </div>
              <Link
                href={`/tires?${baseQs.toString()}`}
                className="h-10 rounded-xl bg-neutral-900 px-4 py-2 text-sm font-extrabold text-white"
              >
                Browse all tires
              </Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
