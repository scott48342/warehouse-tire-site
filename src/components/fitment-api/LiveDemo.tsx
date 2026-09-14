"use client";

/**
 * Live demo for the /fitment-api landing page.
 * Year → Make → Model → Trim cascade against the real dataset via the
 * rate-limited demo proxy (/api/fitment-api/demo/*). Shows the spec card a
 * merchant would render, plus the raw JSON a developer would get back.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Year = { year: number };
type Make = { make: string; displayName: string };
type Model = { model: string; displayName: string };
type Trim = { trimId: string; name: string };
type WheelSpec = {
  diameter: number;
  width: number;
  offset: number | null;
  tireSize: string | null;
  position: "front" | "rear" | "all";
};
type Specs = {
  year: number;
  make: string;
  model: string;
  trim: string;
  boltPattern: string | null;
  centerBore: number | null;
  threadSize: string | null;
  isStaggered: boolean;
  wheelSpecs: WheelSpec[];
  tireSizes: string[];
};

type ApiOk<T> = { success: true; data: T; meta?: Record<string, unknown> };
type ApiErr = { success: false; error: { code: string; message: string } };

const DEMO_BASE = "/api/fitment-api/demo";

async function demo<T>(endpoint: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await fetch(`${DEMO_BASE}/${endpoint}${qs.size ? `?${qs}` : ""}`, {
    headers: { accept: "application/json" },
  });
  const body = (await res.json()) as ApiOk<T> | ApiErr;
  if (!body.success) {
    const err = new Error(body.error.message) as Error & { code?: string };
    err.code = body.error.code;
    throw err;
  }
  return body.data;
}

const selectCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

export default function LiveDemo() {
  const [years, setYears] = useState<Year[]>([]);
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [trims, setTrims] = useState<Trim[]>([]);

  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [trim, setTrim] = useState<string>("");

  const [specs, setSpecs] = useState<Specs | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [ms, setMs] = useState<number | null>(null);

  const reqSeq = useRef(0);

  const run = useCallback(async <T,>(label: string, fn: () => Promise<T>, apply: (v: T) => void) => {
    const seq = ++reqSeq.current;
    setLoading(label);
    setError(null);
    const t0 = performance.now();
    try {
      const v = await fn();
      if (seq === reqSeq.current) {
        apply(v);
        setMs(Math.round(performance.now() - t0));
      }
    } catch (e) {
      if (seq === reqSeq.current) {
        const err = e as Error & { code?: string };
        setError(
          err.code === "DEMO_RATE_LIMITED"
            ? "You've hit the demo limit for this minute — an API key removes it."
            : err.message || "Something went wrong",
        );
      }
    } finally {
      if (seq === reqSeq.current) setLoading(null);
    }
  }, []);

  // Initial years
  useEffect(() => {
    run("years", () => demo<Year[]>("years", {}), setYears);
  }, [run]);

  const onYear = (v: string) => {
    setYear(v); setMake(""); setModel(""); setTrim("");
    setMakes([]); setModels([]); setTrims([]); setSpecs(null);
    if (v) run("makes", () => demo<Make[]>("makes", { year: v }), setMakes);
  };
  const onMake = (v: string) => {
    setMake(v); setModel(""); setTrim("");
    setModels([]); setTrims([]); setSpecs(null);
    if (v) run("models", () => demo<Model[]>("models", { make: v, year }), setModels);
  };
  const onModel = (v: string) => {
    setModel(v); setTrim("");
    setTrims([]); setSpecs(null);
    if (v) run("trims", () => demo<Trim[]>("trims", { year, make, model: v }), (t) => {
      setTrims(t);
      // Single trim? Don't make them click again.
      if (t.length === 1) onTrim(t[0].trimId, v);
    });
  };
  const onTrim = (v: string, modelOverride?: string) => {
    setTrim(v);
    setSpecs(null);
    if (v) run("specs", () => demo<Specs>("specs", { year, make, model: modelOverride ?? model, trim: v }), setSpecs);
  };

  const makeLabel = useMemo(() => makes.find((m) => m.make === make)?.displayName ?? make, [makes, make]);
  const modelLabel = useMemo(() => models.find((m) => m.model === model)?.displayName ?? model, [models, model]);

  const front = specs?.wheelSpecs.filter((w) => w.position === "front" || w.position === "all") ?? [];
  const rear = specs?.wheelSpecs.filter((w) => w.position === "rear") ?? [];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-7 shadow-2xl shadow-black/30">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            <h3 className="text-lg font-semibold text-white">Try it — live data, no signup</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Same dataset the API serves. Pick a vehicle and see exactly what your store would get back.
          </p>
        </div>
        {ms !== null && !loading && (
          <span className="rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1 font-mono text-xs text-zinc-300">
            {ms} ms
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Year</span>
          <select className={selectCls} value={year} onChange={(e) => onYear(e.target.value)} disabled={!years.length}>
            <option value="">{loading === "years" ? "Loading…" : "Select year"}</option>
            {years.map((y) => (
              <option key={y.year} value={y.year}>{y.year}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Make</span>
          <select className={selectCls} value={make} onChange={(e) => onMake(e.target.value)} disabled={!year || !makes.length}>
            <option value="">{loading === "makes" ? "Loading…" : "Select make"}</option>
            {makes.map((m) => (
              <option key={m.make} value={m.make}>{m.displayName}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Model</span>
          <select className={selectCls} value={model} onChange={(e) => onModel(e.target.value)} disabled={!make || !models.length}>
            <option value="">{loading === "models" ? "Loading…" : "Select model"}</option>
            {models.map((m) => (
              <option key={m.model} value={m.model}>{m.displayName}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">Trim</span>
          <select className={selectCls} value={trim} onChange={(e) => onTrim(e.target.value)} disabled={!model || !trims.length}>
            <option value="">{loading === "trims" ? "Loading…" : "Select trim"}</option>
            {trims.map((t) => (
              <option key={t.trimId} value={t.trimId}>{t.name}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-700/50 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          {error}{" "}
          {error.includes("API key") && (
            <a href="#pricing" className="underline decoration-amber-400/60 hover:text-white">See plans →</a>
          )}
        </div>
      )}

      {loading === "specs" && (
        <div className="mt-5 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="h-4 w-1/3 rounded bg-zinc-800" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded bg-zinc-800" />)}
          </div>
        </div>
      )}

      {specs && !loading && (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">Fitment</div>
              <div className="mt-0.5 text-lg font-semibold text-white">
                {specs.year} {makeLabel} {modelLabel} <span className="text-zinc-400">— {specs.trim}</span>
              </div>
            </div>
            {specs.isStaggered && (
              <span className="rounded-full border border-purple-700/60 bg-purple-950/50 px-2.5 py-1 text-xs font-medium text-purple-200">
                Staggered
              </span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Bolt pattern" value={specs.boltPattern ?? "—"} />
            <Stat label="Center bore" value={specs.centerBore ? `${specs.centerBore} mm` : "—"} />
            <Stat label="Thread" value={specs.threadSize ?? "—"} />
            <Stat label="OEM wheels" value={`${front.length + rear.length} size${front.length + rear.length === 1 ? "" : "s"}`} />
          </div>

          {(front.length > 0 || rear.length > 0) && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <WheelList title={rear.length ? "Front" : "Wheels"} items={front} />
              {rear.length > 0 && <WheelList title="Rear" items={rear} />}
            </div>
          )}

          {specs.tireSizes.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">OEM tire sizes</div>
              <div className="flex flex-wrap gap-2">
                {specs.tireSizes.map((t) => (
                  <span key={t} className="rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-sm text-zinc-200">{t}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => setShowJson((s) => !s)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showJson ? "Hide" : "Show"} raw JSON response
            </button>
            <a href="#pricing" className="text-sm font-medium text-white hover:text-blue-300">
              Put this on your store → from $99/mo
            </a>
          </div>

          {showJson && (
            <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-black p-4 font-mono text-xs leading-relaxed text-zinc-300">
              <span className="text-zinc-500">
                GET /api/public/fitment/specs?year={specs.year}&make={encodeURIComponent(make)}&model={encodeURIComponent(model)}&trim={encodeURIComponent(trim)}{"\n"}
                X-API-Key: wtd_••••••••{"\n\n"}
              </span>
              {JSON.stringify({ success: true, data: specs }, null, 2)}
            </pre>
          )}
        </div>
      )}

      {!specs && !loading && !error && (
        <p className="mt-4 text-center text-xs text-zinc-500">
          Not sure where to start? Try <button type="button" className="text-zinc-300 underline decoration-zinc-600 hover:text-white" onClick={() => onYear("2024")}>2024</button> → Ford → Bronco → Badlands.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate font-mono text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function WheelList({ title, items }: { title: string; items: WheelSpec[] }) {
  return (
    <div>
      <div className="mb-1.5 text-xs uppercase tracking-wide text-zinc-500">{title}</div>
      <ul className="space-y-1.5">
        {items.map((w, i) => (
          <li key={`${w.diameter}-${w.width}-${w.offset}-${i}`} className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-mono text-sm">
            <span className="text-white">{w.diameter}×{w.width}</span>
            <span className="text-zinc-400">{w.offset !== null ? `ET${w.offset > 0 ? "+" : ""}${w.offset}` : ""}</span>
            <span className="text-zinc-300">{w.tireSize ?? ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
