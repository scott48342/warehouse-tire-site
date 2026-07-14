-- Employment Applications Table
-- Created: 2026-07-14
-- Purpose: Store job applications from /careers page

CREATE TABLE IF NOT EXISTS "employment_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal Information
  "first_name" varchar(100) NOT NULL,
  "last_name" varchar(100) NOT NULL,
  "phone" varchar(20) NOT NULL,
  "email" varchar(255) NOT NULL,
  "street_address" varchar(255) NOT NULL,
  "city" varchar(100) NOT NULL,
  "state" varchar(50) NOT NULL,
  "zip" varchar(20) NOT NULL,
  
  -- Position Details
  "position_applying_for" varchar(100) NOT NULL,
  "preferred_store" varchar(50) NOT NULL,
  "desired_pay" varchar(100),
  "available_start_date" varchar(50),
  "employment_type" varchar(50) NOT NULL,
  
  -- Availability (JSON)
  "availability" jsonb,
  
  -- Qualification Questions
  "authorized_to_work" boolean NOT NULL,
  "has_reliable_transportation" boolean NOT NULL,
  "has_valid_drivers_license" boolean NOT NULL,
  "worked_here_before" boolean NOT NULL,
  "worked_here_before_explanation" text,
  
  -- Experience
  "years_automotive_experience" varchar(20),
  "years_tire_experience" varchar(20),
  "customer_service_experience" text,
  "sales_experience" text,
  
  -- Skills
  "is_ase_certified" boolean DEFAULT false,
  "has_forklift_experience" boolean DEFAULT false,
  "has_alignment_experience" boolean DEFAULT false,
  "has_tpms_experience" boolean DEFAULT false,
  "has_mounting_balancing_experience" boolean DEFAULT false,
  "has_oil_change_experience" boolean DEFAULT false,
  "has_brake_experience" boolean DEFAULT false,
  "has_suspension_experience" boolean DEFAULT false,
  
  -- Employment History (JSON array)
  "employment_history" jsonb,
  
  -- Education
  "highest_education" varchar(50),
  
  -- References (JSON array)
  "references" jsonb,
  
  -- Resume
  "resume_url" text,
  "resume_filename" varchar(255),
  
  -- Additional
  "heard_about_us" varchar(100),
  "additional_comments" text,
  
  -- Agreement
  "certification_agreed" boolean NOT NULL,
  "electronic_signature" varchar(200) NOT NULL,
  "signature_date" varchar(50) NOT NULL,
  
  -- Admin/Status
  "status" varchar(50) NOT NULL DEFAULT 'new',
  "reviewed_by" varchar(100),
  "reviewed_at" timestamp,
  "review_notes" text,
  "archived_at" timestamp,
  
  -- Metadata
  "ip_address" varchar(50),
  "user_agent" text,
  "turnstile_token" varchar(2000),
  
  -- Timestamps
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS "ea_status_idx" ON "employment_applications" ("status");
CREATE INDEX IF NOT EXISTS "ea_email_idx" ON "employment_applications" ("email");
CREATE INDEX IF NOT EXISTS "ea_position_idx" ON "employment_applications" ("position_applying_for");
CREATE INDEX IF NOT EXISTS "ea_created_at_idx" ON "employment_applications" ("created_at");
CREATE INDEX IF NOT EXISTS "ea_store_idx" ON "employment_applications" ("preferred_store");
