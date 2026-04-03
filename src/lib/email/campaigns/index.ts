/**
 * Email Campaign System
 * 
 * Marketing campaign infrastructure built on top of existing subscriber system.
 * Completely separate from abandoned cart email flows.
 * 
 * @created 2026-04-03
 */

export * from "./types";
export { audienceResolver } from "./audienceResolver";
export { campaignRenderer, generateUnsubscribeUrl, addUtmParams } from "./campaignRenderer";
export { campaignService, CAMPAIGN_SAFE_MODE } from "./campaignService";
