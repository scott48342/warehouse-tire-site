/**
 * API Access Request Endpoint
 * 
 * POST /api/fitment-api/request
 * 
 * Handles new API access requests from the landing page form.
 */

import { NextRequest, NextResponse } from "next/server";
import { submitAccessRequest } from "@/lib/fitment-api/requests";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { name, email, company, useCase } = body;
    
    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Name is required (min 2 characters)" },
        { status: 400 }
      );
    }
    
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid email is required" },
        { status: 400 }
      );
    }
    
    if (!company || typeof company !== "string" || company.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Company name is required" },
        { status: 400 }
      );
    }
    
    if (!useCase || typeof useCase !== "string") {
      return NextResponse.json(
        { success: false, error: "Use case is required" },
        { status: 400 }
      );
    }
    
    // Submit the request
    const result = await submitAccessRequest({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company.trim(),
      website: body.website?.trim() || undefined,
      useCase: useCase.trim(),
      useCaseDetails: body.useCaseDetails?.trim() || undefined,
      expectedUsage: body.expectedUsage?.trim() || undefined,
    });
    
    if (!result.success) {
      // Handle specific errors
      if (result.error === "pending_request_exists") {
        return NextResponse.json(
          { success: false, error: "You already have a pending request. We'll get back to you soon!" },
          { status: 409 }
        );
      }
      
      if (result.error === "already_has_key") {
        return NextResponse.json(
          { success: false, error: "You already have an active API key. Check your email for details." },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: "Failed to submit request. Please try again." },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Request submitted successfully. We'll review it within 24 hours.",
      requestId: result.requestId,
    });
    
  } catch (err) {
    console.error("[api/fitment-api/request] Error:", err);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
