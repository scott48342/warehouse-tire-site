/**
 * API Access Request Management
 * 
 * Handle access request submission, approval, and tracking.
 */

import { db } from "@/lib/fitment-db/db";
import { apiAccessRequests, apiKeys, type ApiAccessRequest } from "./schema";
import { eq, and, isNull, lt, desc } from "drizzle-orm";
import { createApiKey, getApiKeyById } from "./apiKeys";
import { sendConfirmationEmail, sendApprovalEmail, sendFollowUpEmail } from "./emails";

// ============================================================================
// Request Submission
// ============================================================================

export interface AccessRequestInput {
  name: string;
  email: string;
  company: string;
  website?: string;
  useCase: string;
  useCaseDetails?: string;
  expectedUsage?: string;
}

/**
 * Submit a new API access request
 */
export async function submitAccessRequest(input: AccessRequestInput): Promise<{
  success: boolean;
  requestId?: string;
  error?: string;
}> {
  try {
    // Check for existing pending request
    const [existing] = await db
      .select()
      .from(apiAccessRequests)
      .where(
        and(
          eq(apiAccessRequests.email, input.email.toLowerCase()),
          eq(apiAccessRequests.status, "pending")
        )
      )
      .limit(1);
    
    if (existing) {
      return { success: false, error: "pending_request_exists" };
    }
    
    // Check for existing approved request with active key
    const [existingKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.email, input.email.toLowerCase()),
          eq(apiKeys.active, true)
        )
      )
      .limit(1);
    
    if (existingKey) {
      return { success: false, error: "already_has_key" };
    }
    
    // Create new request
    const [request] = await db
      .insert(apiAccessRequests)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        company: input.company,
        website: input.website,
        useCase: input.useCase,
        useCaseDetails: input.useCaseDetails,
        expectedUsage: input.expectedUsage,
      })
      .returning();
    
    // Send confirmation email (don't fail if email fails)
    try {
      const emailResult = await sendConfirmationEmail({
        email: input.email,
        name: input.name,
        company: input.company,
      });
      
      if (emailResult.success) {
        await db
          .update(apiAccessRequests)
          .set({ confirmationEmailSentAt: new Date() })
          .where(eq(apiAccessRequests.id, request.id));
      }
    } catch (emailErr) {
      console.error("[requests] Failed to send confirmation email:", emailErr);
      // Continue - don't fail the request
    }
    
    return { success: true, requestId: request.id };
  } catch (err) {
    console.error("[requests] Failed to submit request:", err);
    return { success: false, error: "submission_failed" };
  }
}

// ============================================================================
// Request Approval
// ============================================================================

/**
 * Approve an access request and generate API key
 */
export async function approveAccessRequest(
  requestId: string,
  reviewedBy: string,
  plan: string = "starter",
  notes?: string
): Promise<{
  success: boolean;
  apiKey?: string;
  error?: string;
}> {
  try {
    // Get the request
    const [request] = await db
      .select()
      .from(apiAccessRequests)
      .where(eq(apiAccessRequests.id, requestId))
      .limit(1);
    
    if (!request) {
      return { success: false, error: "request_not_found" };
    }
    
    if (request.status !== "pending") {
      return { success: false, error: "request_not_pending" };
    }
    
    // Generate API key
    const { key, plainKey } = await createApiKey({
      name: request.name,
      email: request.email,
      company: request.company,
      plan,
    });
    
    // Update request
    await db
      .update(apiAccessRequests)
      .set({
        status: "approved",
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: notes,
        apiKeyId: key.id,
        updatedAt: new Date(),
      })
      .where(eq(apiAccessRequests.id, requestId));
    
    // Send approval email with API key
    try {
      const emailResult = await sendApprovalEmail({
        email: request.email,
        name: request.name,
        company: request.company,
        apiKey: plainKey,
        plan,
      });
      
      if (emailResult.success) {
        await db
          .update(apiAccessRequests)
          .set({ approvalEmailSentAt: new Date() })
          .where(eq(apiAccessRequests.id, requestId));
      }
    } catch (emailErr) {
      console.error("[requests] Failed to send approval email:", emailErr);
      // Log but don't fail - key is still created
    }
    
    return { success: true, apiKey: plainKey };
  } catch (err) {
    console.error("[requests] Failed to approve request:", err);
    return { success: false, error: "approval_failed" };
  }
}

/**
 * Reject an access request
 */
export async function rejectAccessRequest(
  requestId: string,
  reviewedBy: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [request] = await db
      .select()
      .from(apiAccessRequests)
      .where(eq(apiAccessRequests.id, requestId))
      .limit(1);
    
    if (!request) {
      return { success: false, error: "request_not_found" };
    }
    
    await db
      .update(apiAccessRequests)
      .set({
        status: "rejected",
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: reason,
        updatedAt: new Date(),
      })
      .where(eq(apiAccessRequests.id, requestId));
    
    return { success: true };
  } catch (err) {
    console.error("[requests] Failed to reject request:", err);
    return { success: false, error: "rejection_failed" };
  }
}

// ============================================================================
// Request Queries
// ============================================================================

/**
 * Get pending requests
 */
export async function getPendingRequests(): Promise<ApiAccessRequest[]> {
  return db
    .select()
    .from(apiAccessRequests)
    .where(eq(apiAccessRequests.status, "pending"))
    .orderBy(desc(apiAccessRequests.createdAt));
}

/**
 * Get request by ID
 */
export async function getRequestById(id: string): Promise<ApiAccessRequest | null> {
  const [request] = await db
    .select()
    .from(apiAccessRequests)
    .where(eq(apiAccessRequests.id, id))
    .limit(1);
  
  return request || null;
}

/**
 * Get request by email
 */
export async function getRequestByEmail(email: string): Promise<ApiAccessRequest | null> {
  const [request] = await db
    .select()
    .from(apiAccessRequests)
    .where(eq(apiAccessRequests.email, email.toLowerCase()))
    .orderBy(desc(apiAccessRequests.createdAt))
    .limit(1);
  
  return request || null;
}

// ============================================================================
// Follow-up Email Processing
// ============================================================================

/**
 * Find approved requests that need follow-up emails
 * (approved 24+ hours ago, no API calls made yet, no follow-up sent)
 */
export async function findRequestsForFollowUp(): Promise<ApiAccessRequest[]> {
  const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  
  const requests = await db
    .select()
    .from(apiAccessRequests)
    .where(
      and(
        eq(apiAccessRequests.status, "approved"),
        isNull(apiAccessRequests.followUpEmailSentAt),
        lt(apiAccessRequests.reviewedAt, cutoffTime)
      )
    )
    .limit(50);
  
  // Filter to only those whose API key has no firstCallAt
  const needsFollowUp: ApiAccessRequest[] = [];
  
  for (const request of requests) {
    if (!request.apiKeyId) continue;
    
    const key = await getApiKeyById(request.apiKeyId);
    if (key && !key.firstCallAt) {
      needsFollowUp.push(request);
    }
  }
  
  return needsFollowUp;
}

/**
 * Send follow-up emails to approved users who haven't made calls
 */
export async function processFollowUpEmails(): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const requests = await findRequestsForFollowUp();
  
  let sent = 0;
  let failed = 0;
  
  for (const request of requests) {
    if (!request.apiKeyId) continue;
    
    const key = await getApiKeyById(request.apiKeyId);
    if (!key) continue;
    
    try {
      const result = await sendFollowUpEmail({
        email: request.email,
        name: request.name,
        keyPrefix: key.keyPrefix,
      });
      
      if (result.success) {
        await db
          .update(apiAccessRequests)
          .set({ followUpEmailSentAt: new Date() })
          .where(eq(apiAccessRequests.id, request.id));
        sent++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error(`[requests] Follow-up email failed for ${request.email}:`, err);
      failed++;
    }
  }
  
  return { processed: requests.length, sent, failed };
}

// ============================================================================
// Exports
// ============================================================================

export const accessRequestService = {
  submitAccessRequest,
  approveAccessRequest,
  rejectAccessRequest,
  getPendingRequests,
  getRequestById,
  getRequestByEmail,
  findRequestsForFollowUp,
  processFollowUpEmails,
};

export default accessRequestService;
