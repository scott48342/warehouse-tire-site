/**
 * Jake lead/email/build capture — shared, fail-safe, non-blocking.
 *
 * Extracted from the non-stream /api/jake/chat route so BOTH the streaming and
 * non-streaming paths can capture emails, subscribe, and track/link builds
 * WITHOUT duplicating logic.
 *
 * HARD RULE: nothing in here may ever throw into the chat path. Every call is
 * wrapped; failures are logged and swallowed. Capture must never slow or break
 * the conversation/stream.
 *
 * @created 2026-06-17 (v2 spike)
 */

import { subscribe } from "@/lib/email/subscriberService";
import { trackJakeBuild, linkJakeBuildToLead, detectSourceSite } from "@/lib/leads";

// Email regex - captures emails from conversational text
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export interface CaptureVehicle {
  year?: string;
  make?: string;
  model?: string;
  trim?: string;
}

export interface CaptureProducts {
  wheels?: any[];
  tires?: any[];
  staggeredPairs?: any[];
}

export interface CaptureBuildInput {
  conversationId?: string;
  sessionId?: string;
  query: string;
  historyLength: number;
  isLocalHostname?: string | null;
  vehicle?: CaptureVehicle;
  resolvedVehicle?: { year?: number | string; make?: string; model?: string; trim?: string };
  products?: CaptureProducts;
  toolsUsed?: string[];
  cartUrl?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract and auto-subscribe any emails found in the user message.
 * Consent is implied when the customer provides an email in conversation.
 * Never throws.
 */
export async function captureEmailsFromMessage(
  query: string,
  vehicle?: CaptureVehicle,
  ipAddress?: string,
  userAgent?: string
): Promise<string[]> {
  try {
    const emails = query.match(EMAIL_REGEX);
    if (!emails || emails.length === 0) return [];

    const captured: string[] = [];
    for (const email of emails) {
      try {
        await subscribe({
          email,
          source: "jake",
          vehicle,
          marketingConsent: true, // Auto-consent when customer provides email
          ipAddress,
          userAgent,
        });
        captured.push(email);
        console.log(`[Jake Capture] Auto-subscribed email: ${email} (consent=true)`);
      } catch (err) {
        console.error(`[Jake Capture] Failed to capture email ${email}:`, err);
      }
    }
    return captured;
  } catch (err) {
    console.error("[Jake Capture] captureEmailsFromMessage error:", err);
    return [];
  }
}

/**
 * Track a Jake build (abandoned-build recovery) + link to a captured lead.
 * Fire-and-forget: returns immediately; all work is best-effort and swallowed.
 * Safe to call on every turn — it no-ops without a conversation id.
 */
export function trackBuildAndLink(
  input: CaptureBuildInput,
  capturedEmails: string[]
): void {
  try {
    const conversationId = input.conversationId || input.sessionId;
    if (!conversationId) return; // nothing to track against

    const sourceSite = (() => {
      try {
        return detectSourceSite(input.isLocalHostname || undefined);
      } catch {
        return undefined;
      }
    })();

    const products = input.products || {};
    const buildDetails: Record<string, unknown> = {};

    if (products.wheels?.length) {
      buildDetails.recommendedWheels = products.wheels.map((w: any) => ({
        sku: w.sku,
        brand: w.brand,
        model: w.model,
        diameter: w.diameter,
        width: w.width,
      }));
      buildDetails.wheelDiameter = products.wheels[0]?.diameter;
      buildDetails.wheelWidth = products.wheels[0]?.width;
    }

    if (products.tires?.length) {
      buildDetails.recommendedTires = products.tires.map((t: any) => ({
        sku: t.sku,
        brand: t.brand,
        model: t.model,
        size: t.size,
      }));
      buildDetails.tireSize = products.tires[0]?.size;
    }

    // Package value
    let packageValue = 0;
    if (products.wheels?.length) {
      packageValue += products.wheels.reduce((sum: number, w: any) => sum + (w.price || 0) * 4, 0);
    }
    if (products.tires?.length) {
      packageValue += products.tires.reduce((sum: number, t: any) => sum + (t.price || 0) * 4, 0);
    }

    // Build style from tools used
    // Normalize vehicle so year is a string (trackJakeBuild expects year?: string).
    const rawVehicle = input.resolvedVehicle || input.vehicle;
    const normalizedVehicle = rawVehicle
      ? {
          year: rawVehicle.year != null ? String(rawVehicle.year) : undefined,
          make: rawVehicle.make,
          model: rawVehicle.model,
          trim: rawVehicle.trim,
        }
      : undefined;

    const tools = input.toolsUsed || [];
    let buildStyle: string | undefined;
    if (tools.includes("search_lifted_truck_packages")) buildStyle = "lifted";
    else if (tools.includes("search_leveled_truck_packages")) buildStyle = "leveled";
    else if (tools.includes("search_performance_wheels")) buildStyle = "performance";
    else if (tools.length) buildStyle = "stock";

    trackJakeBuild({
      conversationId,
      sessionId: input.sessionId,
      vehicle: normalizedVehicle,
      buildStyle,
      ...buildDetails,
      recommendedPackageValue: packageValue > 0 ? packageValue : undefined,
      messageCount: input.historyLength + 1,
      lastUserMessage: input.query,
      toolsUsed: input.toolsUsed,
      sourceSite,
    }).catch((err: unknown) => {
      console.error("[Jake Capture] Failed to track build:", err);
    });

    if (capturedEmails.length > 0) {
      linkJakeBuildToLead(conversationId, capturedEmails[0]).catch((err: unknown) => {
        console.error("[Jake Capture] Failed to link build to lead:", err);
      });
    }
  } catch (err) {
    console.error("[Jake Capture] trackBuildAndLink error:", err);
  }
}
