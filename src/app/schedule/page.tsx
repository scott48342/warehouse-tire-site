import { BRAND } from "@/lib/brand";
import Link from "next/link";

export default function SchedulePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">
        Schedule an Install
      </h1>
      <p className="mt-2 text-neutral-700">
        Submit a request and we’ll call or text you to confirm. If you’d rather
        do it now, call <a className="font-semibold underline" href={BRAND.links.tel}>{BRAND.phone.callDisplay}</a> or text{" "}
        <a className="font-semibold underline" href={BRAND.links.sms}>{BRAND.phone.textDisplay}</a>.
      </p>

      <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm text-neutral-600">
          For now this form opens an email to {BRAND.email}. Next step is wiring
          it to a real scheduling + CRM pipeline.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input label="Name" placeholder="Your name" />
          <Input label="Phone" placeholder="(248) 555-1234" />
          <Input label="Email" placeholder="you@email.com" />
          <Input label="ZIP" placeholder="48342" />
          <Input label="Vehicle" placeholder="2019 Ford F-150" className="sm:col-span-2" />
          <Input label="Preferred time" placeholder="Tomorrow afternoon" className="sm:col-span-2" />
          <TextArea label="Notes" placeholder="Tire size / brand / budget / etc." className="sm:col-span-2" />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={`mailto:${BRAND.email}?subject=${encodeURIComponent(
              "Install request"
            )}&body=${encodeURIComponent(
              "Hi Warehouse Tire,\n\nI’d like to schedule an install.\n\nName: \nPhone: \nZIP: \nVehicle: \nPreferred time: \nNotes: \n"
            )}`}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--brand-red)] px-5 py-3 text-sm font-extrabold text-white hover:bg-[var(--brand-red-700)]"
          >
            Email Request
          </a>
          <a
            href={BRAND.links.sms}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Text Us
          </a>
          <a
            href={BRAND.links.whatsapp}
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            WhatsApp
          </a>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 hover:bg-neutral-50"
          >
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <input
        {...props}
        className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-[var(--brand-red)]"
      />
    </label>
  );
}

function TextArea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ""}`}>
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <textarea
        {...props}
        className="min-h-24 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-red)]"
      />
    </label>
  );
}
