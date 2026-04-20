/**
 * Customer Build Submission API
 * 
 * POST /api/builds/submit
 * Accepts customer build submissions with images
 */

import { NextRequest, NextResponse } from "next/server";
import { getDbPool } from "@/lib/db/pool";
import { randomUUID } from "crypto";

interface SubmissionPayload {
  // Customer info
  customerEmail?: string;
  customerName?: string;
  orderId?: string;
  
  // Vehicle info
  vehicleYear?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleTrim?: string;
  vehicleType?: "truck" | "suv" | "jeep" | "car";
  
  // Build details
  liftType?: "stock" | "leveled" | "lifted";
  liftInches?: number;
  liftBrand?: string;
  stance?: "flush" | "poke" | "tucked" | "aggressive";
  
  // Wheel info
  wheelBrand?: string;
  wheelModel?: string;
  wheelSku?: string;
  wheelDiameter?: string;
  wheelWidth?: string;
  wheelOffset?: string;
  wheelFinish?: string;
  
  // Tire info
  tireBrand?: string;
  tireModel?: string;
  tireSize?: string;
  
  // Notes
  buildNotes?: string;
  instagramHandle?: string;
  
  // Images (URLs from upload)
  images: {
    url: string;
    angle?: "front" | "side" | "rear" | "interior" | "wheel_detail" | "other";
    isPrimary?: boolean;
  }[];
  
  // Consent
  consentGallery: boolean;
  consentMarketing?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: SubmissionPayload = await request.json();
    
    // Validation
    if (!body.images || body.images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }
    
    if (body.images.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 images allowed" },
        { status: 400 }
      );
    }
    
    if (!body.consentGallery) {
      return NextResponse.json(
        { error: "Gallery consent is required" },
        { status: 400 }
      );
    }
    
    if (!body.vehicleMake || !body.vehicleModel) {
      return NextResponse.json(
        { error: "Vehicle make and model are required" },
        { status: 400 }
      );
    }
    
    const pool = getDbPool();
    if (!pool) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }
    
    const submissionId = randomUUID();
    
    // Insert build submission
    const buildResult = await pool.query<{ id: number }>(
      `INSERT INTO customer_builds (
        submission_id,
        status,
        customer_email,
        customer_name,
        order_id,
        vehicle_year,
        vehicle_make,
        vehicle_model,
        vehicle_trim,
        vehicle_type,
        lift_type,
        lift_inches,
        lift_brand,
        stance,
        wheel_brand,
        wheel_model,
        wheel_sku,
        wheel_diameter,
        wheel_width,
        wheel_offset,
        wheel_finish,
        tire_brand,
        tire_model,
        tire_size,
        build_notes,
        instagram_handle,
        consent_gallery,
        consent_marketing
      ) VALUES (
        $1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26, $27
      ) RETURNING id`,
      [
        submissionId,
        body.customerEmail || null,
        body.customerName || null,
        body.orderId || null,
        body.vehicleYear || null,
        body.vehicleMake,
        body.vehicleModel,
        body.vehicleTrim || null,
        body.vehicleType || null,
        body.liftType || null,
        body.liftInches || null,
        body.liftBrand || null,
        body.stance || null,
        body.wheelBrand || null,
        body.wheelModel || null,
        body.wheelSku || null,
        body.wheelDiameter || null,
        body.wheelWidth || null,
        body.wheelOffset || null,
        body.wheelFinish || null,
        body.tireBrand || null,
        body.tireModel || null,
        body.tireSize || null,
        body.buildNotes || null,
        body.instagramHandle || null,
        body.consentGallery,
        body.consentMarketing || false,
      ]
    );
    
    const buildId = buildResult.rows[0]?.id;
    if (!buildId) {
      throw new Error("Failed to create build submission");
    }
    
    // Insert images
    for (let i = 0; i < body.images.length; i++) {
      const img = body.images[i];
      const isPrimary = img.isPrimary || (i === 0 && !body.images.some(x => x.isPrimary));
      
      await pool.query(
        `INSERT INTO customer_build_images (
          build_id,
          original_url,
          angle,
          is_primary,
          sort_order
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          buildId,
          img.url,
          img.angle || "other",
          isPrimary,
          i,
        ]
      );
    }
    
    return NextResponse.json({
      success: true,
      submissionId,
      message: "Your build has been submitted for review!",
    });
    
  } catch (error) {
    console.error("[builds/submit] Error:", error);
    return NextResponse.json(
      { error: "Failed to submit build" },
      { status: 500 }
    );
  }
}
