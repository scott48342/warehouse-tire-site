import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function s(v: any) {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // Basic spam honeypot
    const company = s(body.company);
    if (company) {
      return NextResponse.json({ ok: true });
    }

    const name = s(body.name);
    const email = s(body.email);
    const phone = s(body.phone);
    const message = s(body.message);

    const productType = s(body.productType); // 'tire' | 'wheel' | ...
    const sku = s(body.sku);
    const productName = s(body.productName);
    const url = s(body.url);
    const vehicle = s(body.vehicle);

    if (!name || (!email && !phone)) {
      return NextResponse.json(
        { ok: false, error: "Please provide your name and either an email or phone number." },
        { status: 400 }
      );
    }

    const RESEND_API_KEY = required("RESEND_API_KEY");
    const QUOTE_TO = process.env.QUOTE_TO || "scott@warehousetire.net";
    const RESEND_FROM = required("RESEND_FROM");

    const resend = new Resend(RESEND_API_KEY);

    const subjectParts = ["Quote request"];
    if (productType) subjectParts.push(productType);
    if (sku) subjectParts.push(sku);

    const subject = subjectParts.join(" 3 ");

    const lines: string[] = [];
    lines.push(`Name: ${name}`);
    if (email) lines.push(`Email: ${email}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (vehicle) lines.push(`Vehicle: ${vehicle}`);
    if (productType) lines.push(`Type: ${productType}`);
    if (sku) lines.push(`SKU: ${sku}`);
    if (productName) lines.push(`Product: ${productName}`);
    if (url) lines.push(`URL: ${url}`);
    if (message) lines.push(`\nMessage:\n${message}`);

    const text = lines.join("\n");

    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: QUOTE_TO,
      replyTo: email || undefined,
      subject,
      text,
    });

    if ((result as any)?.error) {
      return NextResponse.json(
        { ok: false, error: (result as any).error?.message || "Email send failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
