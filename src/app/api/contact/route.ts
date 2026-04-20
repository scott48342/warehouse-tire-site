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

const SUBJECT_LABELS: Record<string, string> = {
  order: "Order Question",
  fitment: "Fitment Help",
  returns: "Returns & Refunds",
  shipping: "Shipping Inquiry",
  quote: "Quote Request",
  other: "General Inquiry",
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    // Honeypot field - bots fill this, humans don't see it
    const website = s(body.website);
    if (website) {
      // Pretend success but don't send
      return NextResponse.json({ ok: true });
    }

    const name = s(body.name);
    const email = s(body.email);
    const phone = s(body.phone);
    const subject = s(body.subject);
    const message = s(body.message);

    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { ok: false, error: "Please fill in all required fields." },
        { status: 400 }
      );
    }

    // Basic email validation
    if (!email.includes("@") || !email.includes(".")) {
      return NextResponse.json(
        { ok: false, error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const RESEND_API_KEY = required("RESEND_API_KEY");
    const CONTACT_TO = process.env.CONTACT_TO || process.env.QUOTE_TO || "scott@warehousetire.net";
    const RESEND_FROM = required("RESEND_FROM");

    const resend = new Resend(RESEND_API_KEY);

    const subjectLabel = SUBJECT_LABELS[subject] || subject;
    const emailSubject = `[Contact] ${subjectLabel} - ${name}`;

    const lines: string[] = [
      `New contact form submission from warehousetiredirect.com`,
      ``,
      `Name: ${name}`,
      `Email: ${email}`,
    ];
    
    if (phone) lines.push(`Phone: ${phone}`);
    lines.push(`Subject: ${subjectLabel}`);
    lines.push(``);
    lines.push(`Message:`);
    lines.push(message);

    const text = lines.join("\n");

    const result = await resend.emails.send({
      from: RESEND_FROM,
      to: CONTACT_TO,
      replyTo: email,
      subject: emailSubject,
      text,
    });

    if ((result as any)?.error) {
      console.error("[contact] Resend error:", (result as any).error);
      return NextResponse.json(
        { ok: false, error: "Failed to send message. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[contact] Error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
