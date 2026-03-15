"use client";

import { useMemo, useState } from "react";

type Props = {
  productType: "tire" | "wheel" | string;
  sku?: string;
  productName?: string;
  vehicleLabel?: string;
};

export function QuoteRequest({ productType, sku, productName, vehicleLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const url = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.href;
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSending(true);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      message: String(fd.get("message") || "").trim(),

      // honeypot
      company: String(fd.get("company") || "").trim(),

      productType,
      sku,
      productName,
      url,
      vehicle: vehicleLabel || "",
    };

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || "Could not send quote request. Please call instead.");
        setSending(false);
        return;
      }
      setSent(true);
      setSending(false);
    } catch {
      setError("Could not send quote request. Please call instead.");
      setSending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setSent(false);
          setError(null);
        }}
        className="h-11 rounded-xl bg-[var(--brand-red)] px-4 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
      >
        Request a quote
      </button>

      {open ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-neutral-900">Request a quote</div>
              <div className="mt-0.5 text-xs text-neutral-600">
                Well confirm pricing and availability and get you scheduled.
              </div>
            </div>
            <button
              type="button"
              className="text-xs font-extrabold text-neutral-700 hover:underline"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          {sent ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Sent. Well get back to you shortly.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-3 grid gap-2">
              {/* honeypot */}
              <input
                name="company"
                tabIndex={-1}
                autoComplete="off"
                className="hidden"
                aria-hidden="true"
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Name
                  <input
                    name="name"
                    required
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                  Phone
                  <input
                    name="phone"
                    inputMode="tel"
                    className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                  />
                </label>
              </div>

              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Email
                <input
                  name="email"
                  type="email"
                  className="h-10 rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                />
              </label>

              <label className="grid gap-1 text-xs font-semibold text-neutral-700">
                Notes (optional)
                <textarea
                  name="message"
                  rows={3}
                  className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
                  placeholder="Any questions, preferred install date, etc."
                />
              </label>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={sending}
                className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {sending ? "Sending" : "Send quote request"}
              </button>

              <div className="text-[11px] text-neutral-600">
                By submitting, you agree we may contact you by phone/email about this quote.
              </div>
            </form>
          )}
        </div>
      ) : null}

      <div className="text-xs text-neutral-600">
        Prefer to talk? Call us and well get it handled.
      </div>
    </div>
  );
}
