"use client";

import { useMemo, useState } from "react";

type TpmsItem = {
  partNumber?: string;
  mfgPartNumber?: string;
  size?: string;
  description?: string;
  vendorName?: string;
  brand?: string;
  cost?: number;
  fet?: number;
  quantity?: {
    primary?: number;
    alternate?: number;
    national?: number;
  };
  code?: string | number;
};

type ApiOk = {
  partNumber: string;
  vendor?: string;
  upstream: string;
  count: number;
  items: TpmsItem[];
};

type ApiErr = {
  error: string;
  hint?: string;
  attempts?: Array<{ upstream: string; status?: number; ok?: boolean; sample?: string }>;
};

export default function TpmsAccessoriesPage() {
  const [partNumber, setPartNumber] = useState("HTS-A78ED");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiOk | null>(null);

  const canSearch = useMemo(() => partNumber.trim().length > 0, [partNumber]);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canSearch) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(
        `/api/km/partlookup?partNumber=${encodeURIComponent(partNumber.trim())}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ApiOk | ApiErr;
      if (!res.ok) {
        setError(
          (json as ApiErr).error ||
            `Lookup failed (${res.status}). Try again, or contact support.`
        );
        return;
      }
      setData(json as ApiOk);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">TPMS Sensors</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">
        Lookup KM TPMS sensors by part number.
      </p>

      <form onSubmit={onSearch} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="w-full sm:max-w-sm">
          <div className="text-sm font-semibold text-neutral-900">Part number</div>
          <input
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="e.g. HTS-A78ED"
            className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-semibold text-neutral-900 outline-none ring-0 placeholder:text-neutral-400 focus:border-neutral-300"
          />
        </label>

        <button
          type="submit"
          disabled={!canSearch || loading}
          className="h-11 rounded-xl bg-[var(--brand-red)] px-5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {data ? (
        <section className="mt-8">
          <div className="text-sm text-neutral-600">
            Source: <span className="font-mono text-xs">{data.upstream}</span>
            {data.vendor ? (
              <>
                {" "}• Vendor used: <span className="font-semibold">{data.vendor}</span>
              </>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4">
            {data.items.map((it, idx) => (
              <div key={idx} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-extrabold text-neutral-900">
                      {it.partNumber || "(no part number)"}
                      {it.size ? <span className="ml-2 text-sm font-bold text-neutral-500">{it.size}</span> : null}
                    </div>
                    {it.description ? (
                      <div className="mt-1 text-sm font-semibold text-neutral-700">{it.description}</div>
                    ) : null}
                    <div className="mt-2 text-sm text-neutral-600">
                      {it.vendorName ? <>Vendor: <span className="font-semibold">{it.vendorName}</span></> : null}
                    </div>
                  </div>

                  <div className="text-sm">
                    {typeof it.cost === "number" ? (
                      <div className="text-right">
                        <div className="text-xs font-semibold text-neutral-500">Cost</div>
                        <div className="text-lg font-extrabold text-neutral-900">${it.cost.toFixed(2)}</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700 sm:grid-cols-3">
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Primary</div>
                    <div className="font-extrabold">{it.quantity?.primary ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">Alternate</div>
                    <div className="font-extrabold">{it.quantity?.alternate ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-500">National</div>
                    <div className="font-extrabold">{it.quantity?.national ?? "—"}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
