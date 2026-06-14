/**
 * Lead Capture Module
 * 
 * Unified lead capture across all WTD properties.
 * 
 * @created 2026-07-18
 */

export {
  leadService,
  captureLead,
  trackJakeBuild,
  linkJakeBuildToLead,
  markLeadConverted,
  getLeadSourceStats,
  getLeadFunnelStats,
  getRecentLeads,
  detectSourceSite,
  type SourceSite,
  type SourceChannel,
  type LeadStatus,
  type CaptureLeadInput,
  type CaptureLeadResult,
  type TrackJakeBuildInput,
} from "./leadService";

export {
  funnelEvents,
  trackFunnelEvent,
  trackModalShown,
  trackModalSkipped,
  trackModalSubmitted,
  trackLeadCreated,
  trackBuildSaved,
  trackCartSaved,
  trackCheckoutStarted,
  trackCheckoutCompleted,
  type FunnelEventType,
  type FunnelEventData,
} from "./funnelEvents";
