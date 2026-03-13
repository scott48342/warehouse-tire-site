"use client";

import { useState } from "react";

export default function TireAssetsAdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [kmDescription, setKmDescription] = useState("");
  const [tireSizeRaw, setTireSizeRaw] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [result, setResult] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setResult("");
    try {
      const res = await fetch("/api/admin/tire-asset", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          kmDescription,
          tireSizeRaw: tireSizeRaw || undefined,
          imageUrl: imageUrl || undefined,
          displayName: displayName || undefined,
          source: "tireconnect",
        }),
      });

      const text = await res.text();
      setResult(`HTTP ${res.status}: ${text}`);
    } catch (e: any) {
      setResult(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-neutral-900">Admin: Tire Assets</h1>
      <p className="mt-2 text-sm text-neutral-700">
        Saves K&amp;M description → display name/image URL into the package engine cache.
      </p>

      <div className="mt-6 grid gap-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-neutral-700">Admin key</span>
          <input
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            placeholder="ADMIN_KEY"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-neutral-700">K&amp;M description (exact)</span>
          <input
            value={kmDescription}
            onChange={(e) => setKmDescription(e.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            placeholder="TH 275/55R20/XL RNGR 007 HT 117V"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-neutral-700">Tire raw size (optional)</span>
            <input
              value={tireSizeRaw}
              onChange={(e) => setTireSizeRaw(e.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="2755520"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold text-neutral-700">Display name (optional)</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
              placeholder="Thunderer Ranger 007 HT 275/55R20 XL 117V"
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-neutral-700">Image URL (optional)</span>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
            placeholder="https://wl.tireconnect.ca/uploads/...jpg"
          />
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save mapping"}
        </button>

        {result ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            {result}
          </pre>
        ) : null}
      </div>

      <p className="mt-4 text-xs text-neutral-600">
        URL: <code>/admin/tire-assets</code>
      </p>
    </main>
  );
}
