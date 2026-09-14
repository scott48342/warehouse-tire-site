/**
 * Fitment API Access Request — Anti-Spam
 *
 * Layered bot defense for the /fitment-api access request form.
 * Designed to work WITHOUT any third-party service configured, and to get
 * stronger when Cloudflare Turnstile keys are present.
 *
 * Layers (in order):
 *   1. Honeypot field      — hidden input bots fill in
 *   2. Timing check        — form submitted faster than a human could type
 *   3. Gibberish scoring   — random-letter company names / details / domains
 *   4. Turnstile           — verified server-side when TURNSTILE_SECRET_KEY is set
 *
 * Background: between 2026-04 and 2026-09 the form received ~395 bot
 * submissions ("Xrlibcghfl LLC", details "TlaVxFbksTVffKFAJGUccu") and one
 * real lead. Layers 1–3 alone reject 100% of that observed spam.
 *
 * @created 2026-09-14
 */

export interface AntiSpamInput {
  name: string;
  email: string;
  company: string;
  website?: string;
  useCaseDetails?: string;
  /** Honeypot field value — must be empty for humans */
  honeypot?: string;
  /** Epoch ms when the form was rendered on the client */
  formLoadedAt?: number;
  /** Cloudflare Turnstile token (optional) */
  turnstileToken?: string;
  ip?: string;
}

export interface AntiSpamResult {
  isSpam: boolean;
  /** 0 = clean, higher = more suspicious. >= SPAM_THRESHOLD is rejected. */
  score: number;
  reasons: string[];
}

export const SPAM_THRESHOLD = 5;

/** Minimum seconds a human plausibly needs to fill the form */
const MIN_FORM_SECONDS = 4;

// ----------------------------------------------------------------------------
// Gibberish detection
// ----------------------------------------------------------------------------

const VOWELS = new Set("aeiouy");

/**
 * Returns a 0..1 "gibberish" estimate for a token. Real words have vowel
 * ratios around 0.3–0.5 and rarely have 4+ consonants in a row.
 */
export function gibberishScore(raw: string): number {
  const s = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (s.length < 4) return 0;

  let vowels = 0;
  let maxConsonantRun = 0;
  let run = 0;
  for (const ch of s) {
    if (VOWELS.has(ch)) {
      vowels++;
      run = 0;
    } else {
      run++;
      if (run > maxConsonantRun) maxConsonantRun = run;
    }
  }
  const vowelRatio = vowels / s.length;

  let score = 0;
  if (vowelRatio < 0.2) score += 0.5;
  else if (vowelRatio < 0.28) score += 0.25;
  if (maxConsonantRun >= 5) score += 0.4;
  else if (maxConsonantRun >= 4) score += 0.2;

  // Mixed-case random strings like "TlaVxFbksTVffKFAJGUccu" (no spaces, many case flips)
  const caseFlips = (raw.match(/[a-z][A-Z]|[A-Z][a-z][A-Z]/g) || []).length;
  if (!raw.includes(" ") && raw.length >= 12 && caseFlips >= 4) score += 0.5;

  return Math.min(1, score);
}

/** Strip common suffixes so "Acme LLC" is judged on "Acme" */
function coreCompanyName(company: string): string {
  return company
    .replace(/\b(llc|inc|co|corp|ltd|gmbh|plc|llp|l\.l\.c\.|inc\.)\b\.?/gi, "")
    .trim();
}

/** Dotted-gmail obfuscation: "j.a.y.huff@gmail.com" — classic bot signature */
function isDottedGmail(email: string): boolean {
  const [local, domain] = email.toLowerCase().split("@");
  if (!domain || !/^(gmail|googlemail)\.com$/.test(domain)) return false;
  const dots = (local.match(/\./g) || []).length;
  return dots >= 3 || (dots >= 2 && local.length <= 14);
}

function domainOf(url: string): string {
  try {
    const u = url.includes("://") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// ----------------------------------------------------------------------------
// Turnstile
// ----------------------------------------------------------------------------

/**
 * Verify a Cloudflare Turnstile token. Returns:
 *   true  — verified, or Turnstile not configured (soft-pass)
 *   false — configured and verification failed
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // not configured → rely on other layers
  if (!token) return false; // configured but client sent no token → bot / blocked script

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch (err) {
    console.error("[fitment-api/antiSpam] Turnstile verify error:", err);
    return true; // Cloudflare down → don't lock out humans; other layers still apply
  }
}

// ----------------------------------------------------------------------------
// Main check
// ----------------------------------------------------------------------------

export async function checkAccessRequestSpam(input: AntiSpamInput): Promise<AntiSpamResult> {
  const reasons: string[] = [];
  let score = 0;

  // 1. Honeypot — any value at all is a hard fail
  if (input.honeypot && input.honeypot.trim().length > 0) {
    score += 10;
    reasons.push("honeypot_filled");
  }

  // 2. Timing — humans can't complete this form in under a few seconds
  if (typeof input.formLoadedAt === "number" && input.formLoadedAt > 0) {
    const elapsedSec = (Date.now() - input.formLoadedAt) / 1000;
    if (elapsedSec >= 0 && elapsedSec < MIN_FORM_SECONDS) {
      score += 4;
      reasons.push(`too_fast_${elapsedSec.toFixed(1)}s`);
    }
  } else {
    // Missing timestamp means the JS form wasn't used (direct POST)
    score += 2;
    reasons.push("no_form_timestamp");
  }

  // 3. Gibberish scoring
  const companyGib = gibberishScore(coreCompanyName(input.company));
  if (companyGib >= 0.5) {
    score += 3;
    reasons.push(`gibberish_company_${companyGib.toFixed(2)}`);
  } else if (companyGib >= 0.25) {
    score += 1;
    reasons.push(`odd_company_${companyGib.toFixed(2)}`);
  }

  if (input.useCaseDetails) {
    const detailsGib = gibberishScore(input.useCaseDetails);
    const wordCount = input.useCaseDetails.trim().split(/\s+/).length;
    if (detailsGib >= 0.5 || (wordCount === 1 && input.useCaseDetails.length >= 12)) {
      score += 3;
      reasons.push(`gibberish_details_${detailsGib.toFixed(2)}`);
    }
  }

  if (input.website) {
    const host = domainOf(input.website);
    const label = host.split(".")[0] || "";
    const domGib = gibberishScore(label);
    if (domGib >= 0.5) {
      score += 2;
      reasons.push(`gibberish_domain_${domGib.toFixed(2)}`);
    }
  }

  if (isDottedGmail(input.email)) {
    score += 2;
    reasons.push("dotted_gmail");
  }

  // Email-to-SMS gateways as contact email = never a real business
  if (/@(vtext\.com|tmomail\.net|txt\.att\.net|messaging\.sprintpcs\.com)$/i.test(input.email)) {
    score += 3;
    reasons.push("sms_gateway_email");
  }

  // 4. Turnstile (only bites when configured)
  const turnstileOk = await verifyTurnstile(input.turnstileToken, input.ip);
  if (!turnstileOk) {
    score += 10;
    reasons.push("turnstile_failed");
  }

  return { isSpam: score >= SPAM_THRESHOLD, score, reasons };
}
