/**
 * Jake Streaming Chat — v2 engine (flagged spike).
 *
 * A leaner streaming loop modeled on the @jake/core LLMJakeEngine.chatStream:
 *   - single tool-calling loop (no separate probe/echo phase that can double text)
 *   - emits a `tool` status per tool call
 *   - reuses WTD's EXISTING tools (same endpoints), fitment cache, and mockup
 *
 * CONTRACT: emits the SAME StreamEvent union the live UI (JakeChat.tsx) consumes:
 *   status | text | products | vehicle | cartUrl | mockup | done | error
 * It imports StreamEvent / JakeMessage / SavedVehicleContext / GalleryBuildContext
 * from ./stream so the v1 and v2 contracts can never drift.
 *
 * Default remains v1 (./stream). v2 runs only when explicitly requested via
 * ?engine=v2 or JAKE_ENGINE=v2 (see the route).
 *
 * @created 2026-06-17 (v2 spike)
 */

import Anthropic from "@anthropic-ai/sdk";
import { JAKE_SYSTEM_PROMPT } from "./systemPrompt";
import { JAKE_TOOLS, executeTool } from "./tools";
import { fitmentCache } from "./fitmentCache";
import type {
  JakeMessage,
  SavedVehicleContext,
  StreamEvent,
  GalleryBuildContext,
} from "./stream";

// Lazy client so an absent ANTHROPIC_API_KEY can't throw at module load time
// (which would 404 the whole route). Constructed on first use instead.
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}
const MODEL = "claude-sonnet-4-6";
const MAX_TURNS = 6;

// Status copy — preserved from v1 so the UI shows identical messaging.
const STATUS_MESSAGES: Record<string, string> = {
  thinking: "Thinking...",
  lookup_tire_sizes: "Checking your vehicle specs...",
  lookup_wheel_fitment: "Verifying fitment...",
  search_tires: "Searching tire options...",
  search_wheels: "Searching wheel options...",
  list_trims: "Looking up trim levels...",
  get_platform_context: "Checking platform specs...",
  generate_wheel_mockup: "🎨 Generating visual mockup... This takes 20-40 seconds",
  build_cart: "Building your cart...",
  processing: "Processing results...",
  generating: "Jake is typing...",
};

/** Strip stray markdown image syntax (handled by JakeMockupCard instead). */
function sanitizeText(text: string): string {
  return text.replace(/!\[[^\]]*\]\([^)]+\)/g, "");
}

interface DetectedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
}

function buildSystemPrompt(
  isLocal: boolean,
  savedVehicle?: SavedVehicleContext,
  gallery?: GalleryBuildContext
): { system: string; detectedVehicle: DetectedVehicle } {
  let system = JAKE_SYSTEM_PROMPT;

  // v2-only guidance: close the loop on a build — offer cart/checkout + TPMS.
  system += `

═════════════════════════════════════════════════════════════════════════════
CLOSING A BUILD (wheels + tires) — ALWAYS DO THIS
═════════════════════════════════════════════════════════════════════════════

Whenever you present a complete build with a total price, you MUST:

1. RECOMMEND TPMS SENSORS. Aftermarket wheels usually need new TPMS (tire pressure
   monitoring) sensors — the factory ones often don't transfer. Say something like:
   "Since these are new wheels, you'll likely want a set of 4 TPMS sensors so your
   dash light stays off — want me to include those?" Do NOT invent a sensor price;
   if asked, say the team confirms exact TPMS pricing at checkout.

2. ALWAYS DRIVE TO THE CART. Every completed build ends with an invitation to check
   out — e.g. "Want me to add this full setup to your cart so you can check out?"
   When the customer agrees (or says buy / check out / add to cart / let's do it),
   CALL THE build_cart TOOL with every product (each wheel + tire position, with the
   sku, quantity, and price from your earlier search results). That generates a green
   "Your Cart is Ready" checkout button. Do not just describe the build — actually
   call build_cart so they can check out. Completing the purchase online is ALWAYS the
   primary next step. Cart generation is the goal of every conversation.

STORE PHONE NUMBERS ARE A LAST RESORT — NOT A DEFAULT EXIT.
Do NOT tell the customer to "call the store" or hand out phone numbers just to close
a normal build. Only surface a phone number when:
  - You genuinely CANNOT find a product/fitment after multiple real search attempts, OR
  - The customer explicitly asks to call / speak to someone / visit in person, OR
  - It's a question only a store can answer (e.g. used-tire stock, in-person install timing).
In every other case, keep working the sale toward the cart. If the customer hesitates,
offer to adjust the build, swap a part, or answer concerns — do NOT bail to "give us a
call." Earn the online checkout.

Never just give a total and stop. Total → TPMS offer → add-to-cart invitation (cart first, every time).`;

  const detectedVehicle: DetectedVehicle = {};

  if (savedVehicle?.year && savedVehicle?.make && savedVehicle?.model) {
    const v = `${savedVehicle.year} ${savedVehicle.make} ${savedVehicle.model}${savedVehicle.trim ? ` ${savedVehicle.trim}` : ""}`;
    system += `

═══════════════════════════════════════════════════════════════════════════════
CUSTOMER'S SAVED VEHICLE (IMPORTANT!)
═══════════════════════════════════════════════════════════════════════════════

This customer has already told us their vehicle: **${v}**

YOU ALREADY KNOW THEIR VEHICLE. Do NOT ask them what vehicle they drive unless they explicitly say they want to change it or shop for a different vehicle.

When they ask about tires, wheels, or fitment - use this vehicle automatically:
- Year: ${savedVehicle.year}
- Make: ${savedVehicle.make}
- Model: ${savedVehicle.model}${savedVehicle.trim ? `\n- Trim: ${savedVehicle.trim}` : ""}

If they say "I want to change my vehicle" or "different car" - then ask for the new vehicle info.
Otherwise, assume all fitment questions are for the ${v}.`;
    detectedVehicle.year = parseInt(String(savedVehicle.year));
    detectedVehicle.make = savedVehicle.make;
    detectedVehicle.model = savedVehicle.model;
    detectedVehicle.trim = savedVehicle.trim;
  }

  if (isLocal) {
    system += `\n\nNOTE: This customer is on the LOCAL site (warehousetire.net). They can get installation at our Pontiac or Waterford locations. Mention installation is available when relevant.`;
  }

  if (gallery?.galleryBuild) {
    const gb = gallery.galleryBuild;
    system += `

═══════════════════════════════════════════════════════════════════════════════
GALLERY BUILD INSPIRATION (from "Build Something Similar")
═══════════════════════════════════════════════════════════════════════════════

The customer clicked "Build Something Similar" on a build from our gallery. Here's what they liked:

INSPIRATION BUILD:
- Vehicle: ${gb.vehicle}
- Wheels: ${gb.wheel} (${gb.wheelSize})
- Tires: ${gb.tire} (${gb.tireSize})
- Style: ${gb.style}${gb.liftLevel ? `\n- Lift/Suspension: ${gb.liftLevel}` : ""}

IMPORTANT INSTRUCTIONS:
1. Open with something like: "I see you're looking at a ${gb.vehicle} build running ${gb.wheel} wheels and ${gb.tire} tires. Love that setup!"
2. Ask if they want something VERY close to this, or if they want to make some changes
3. If their vehicle is different from the inspiration, ask what THEY drive so you can adapt the build
4. The goal is to help them achieve a similar LOOK and VIBE, not necessarily the exact same parts
5. If the exact wheel/tire doesn't fit their vehicle, recommend alternatives with a similar aesthetic
6. Be excited about helping them recreate this style!

The customer is inspired and ready to build. Help them turn this inspiration into reality!`;
  }

  return { system, detectedVehicle };
}

/**
 * v2 streaming generator. Same signature + same yielded events as v1 streamChat.
 */
export async function* streamChatV2(
  query: string,
  history: JakeMessage[] = [],
  isLocal: boolean = false,
  savedVehicle?: SavedVehicleContext,
  galleryBuildContext?: GalleryBuildContext
): AsyncGenerator<StreamEvent> {
  const startTime = Date.now();
  console.log(`\n[Jake v2] Query: "${query}" | history=${history.length} isLocal=${isLocal}`);

  yield { type: "status", status: STATUS_MESSAGES.thinking };

  const toolsUsed: string[] = [];
  const collectedProducts: { tires?: any[]; wheels?: any[]; staggeredPairs?: any[] } = {};
  const detectedVehicle: { year?: number; make?: string; model?: string; trim?: string } = {};
  let cartUrl: string | undefined;

  try {
    const { system, detectedVehicle: seedVehicle } = buildSystemPrompt(isLocal, savedVehicle, galleryBuildContext);
    Object.assign(detectedVehicle, seedVehicle);

    const messages: Anthropic.MessageParam[] = [
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: query },
    ];

    for (let turn = 1; turn <= MAX_TURNS; turn++) {
      // Stream this turn. Anthropic streaming emits text deltas AND tool_use blocks.
      yield { type: "status", status: STATUS_MESSAGES.generating };

      const streamResp = await getClient().messages.create({
        model: MODEL,
        max_tokens: 1500,
        system,
        tools: JAKE_TOOLS,
        messages,
        stream: true,
      });

      const assistantBlocks: Anthropic.ContentBlockParam[] = [];
      const toolUses: { id: string; name: string; input: any }[] = [];
      const toolInputJson: Record<number, string> = {};
      let stopReason: string | null = null;
      let curIndex = -1;

      for await (const ev of streamResp) {
        if (ev.type === "content_block_start") {
          curIndex = ev.index;
          const block = ev.content_block as any;
          if (block.type === "text") {
            assistantBlocks[curIndex] = { type: "text", text: "" } as any;
          } else if (block.type === "tool_use") {
            assistantBlocks[curIndex] = { type: "tool_use", id: block.id, name: block.name, input: {} } as any;
            toolUses[curIndex] = { id: block.id, name: block.name, input: {} };
            toolInputJson[curIndex] = "";
          }
        } else if (ev.type === "content_block_delta") {
          const delta = ev.delta as any;
          if (delta.type === "text_delta" && delta.text) {
            const clean = sanitizeText(delta.text);
            const b = assistantBlocks[ev.index] as any;
            if (b && b.type === "text") b.text += delta.text;
            if (clean) yield { type: "text", text: clean };
          } else if (delta.type === "input_json_delta") {
            toolInputJson[ev.index] = (toolInputJson[ev.index] || "") + (delta.partial_json || "");
          }
        } else if (ev.type === "message_delta") {
          stopReason = (ev.delta as any).stop_reason || stopReason;
        }
      }

      // Finalize tool inputs
      const calls: { id: string; name: string; input: any }[] = [];
      for (const idx of Object.keys(toolInputJson).map(Number)) {
        const tu = toolUses[idx];
        if (!tu) continue;
        let parsed: any = {};
        try {
          parsed = toolInputJson[idx] ? JSON.parse(toolInputJson[idx]) : {};
        } catch {
          parsed = {};
        }
        tu.input = parsed;
        (assistantBlocks[idx] as any).input = parsed;
        calls.push(tu);
      }

      if (stopReason !== "tool_use" || calls.length === 0) {
        break; // final answer streamed; done
      }

      // Push assistant turn (text + tool_use blocks), then execute tools.
      messages.push({ role: "assistant", content: assistantBlocks.filter(Boolean) as any });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        yield { type: "status", status: STATUS_MESSAGES[call.name] || `Running ${call.name}...` };

        const input = call.input as Record<string, unknown>;
        // v2 UI shows a fuller side rail — pull more options so it doesn't look thin.
        // Force a high limit even if the model requested fewer (e.g. tires often
        // default to 6). Honor a model-requested limit only if it's already larger.
        if (call.name === "search_wheels" || call.name === "search_tires") {
          const requested = Number(input.limit);
          if (!Number.isFinite(requested) || requested < 24) input.limit = 24;
        }
        if (input.year) detectedVehicle.year = Number(input.year);
        if (input.make) detectedVehicle.make = String(input.make);
        if (input.model) detectedVehicle.model = String(input.model);
        if (input.trim) detectedVehicle.trim = String(input.trim);

        try {
          let result: any;
          const isFitmentLookup = call.name === "lookup_tire_sizes" || call.name === "lookup_wheel_fitment";
          if (isFitmentLookup && input.year && input.make && input.model) {
            const cacheKey = fitmentCache.key(
              Number(input.year),
              String(input.make),
              String(input.model),
              input.trim ? String(input.trim) : undefined
            );
            result = await fitmentCache.get(cacheKey);
            if (!result) {
              result = await executeTool(call.name, input);
              if (result && !result.error && !result.trimRequired) {
                await fitmentCache.set(cacheKey, result);
              }
            }
          } else {
            result = await executeTool(call.name, input);
          }

          const r = result as any;
          // Accumulate + dedupe across multiple searches in one turn. Staggered
          // setups search front AND rear sizes; overwriting would drop one size
          // and make the rail look thin. Dedupe by sku (fallback partNumber/url).
          const mergeById = (existing: any[] = [], incoming: any[] = []) => {
            const seen = new Set(existing.map((x) => x?.sku || x?.partNumber || x?.productUrl));
            const merged = [...existing];
            for (const item of incoming) {
              const id = item?.sku || item?.partNumber || item?.productUrl;
              if (id && seen.has(id)) continue;
              if (id) seen.add(id);
              merged.push(item);
            }
            return merged;
          };
          if (r?.tires?.length > 0) collectedProducts.tires = mergeById(collectedProducts.tires, r.tires);
          if (r?.wheels?.length > 0) collectedProducts.wheels = mergeById(collectedProducts.wheels, r.wheels);
          if (r?.staggeredPairs?.length > 0) collectedProducts.staggeredPairs = mergeById(collectedProducts.staggeredPairs, r.staggeredPairs);
          if (r?.cartUrl) cartUrl = r.cartUrl;

          // Mockup: emit the rich mockup event the UI expects (parity with v1).
          if (call.name === "generate_wheel_mockup" && r?.imageUrl) {
            yield {
              type: "mockup",
              mockup: {
                imageUrl: r.imageUrl,
                disclaimer: r.disclaimer || "AI visual mockup only; final appearance may vary.",
                vehicle: String(input.vehicle || `${detectedVehicle.year || ""} ${detectedVehicle.make || ""} ${detectedVehicle.model || ""}`).trim(),
                wheelStyle: String(input.wheelStyle || input.wheelModel || ""),
                generationTime: r.generationTime,
                cached: r.cached,
                generationMethod: r.cached ? "cached" : (r.method || "gpt-image"),
                confidence: r.confidence || "medium",
                editDiag: r.editDiag,
                tireBrand: input.tireBrand ? String(input.tireBrand) : undefined,
                tireModel: input.tireModel ? String(input.tireModel) : undefined,
                wheelImageFound: true,
                tireImageFound: false,
                vehicleColor: input.color ? String(input.color) : undefined,
              },
            } as any;
          } else if (call.name === "generate_wheel_mockup" && r?.error) {
            console.error(`[Jake v2] Mockup failed: ${r.errorCode} - ${r.error}`);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result),
          });
        } catch (err: any) {
          console.error(`[Jake v2] Tool error (${call.name}):`, err);
          toolResults.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify({ error: String(err) }),
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
      // loop continues for the model's next turn
    }

    if (Object.keys(collectedProducts).length > 0) {
      yield { type: "products", products: collectedProducts };
    }
    if (Object.keys(detectedVehicle).length > 0) {
      yield { type: "vehicle", vehicle: detectedVehicle };
    }
    if (cartUrl) {
      yield { type: "cartUrl", cartUrl };
    }

    const duration = Date.now() - startTime;
    console.log(`[Jake v2] Complete in ${duration}ms. Tools: ${toolsUsed.join(", ") || "none"}`);
    yield { type: "done", meta: { duration_ms: duration, toolsUsed } };
  } catch (error: any) {
    console.error("[Jake v2] Error:", error);
    yield {
      type: "error",
      error: "I'm having a bit of trouble right now. Try again in a sec, or give us a call at (248) 332-4120.",
    };
  }
}

/** Expose collected products/vehicle/cartUrl after a stream for capture. */
export type V2Outcome = {
  products: { tires?: any[]; wheels?: any[]; staggeredPairs?: any[] };
  vehicle: { year?: number; make?: string; model?: string; trim?: string };
  cartUrl?: string;
  toolsUsed: string[];
};
