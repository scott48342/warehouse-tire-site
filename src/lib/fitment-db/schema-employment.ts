/**
 * Employment Application Schema
 * 
 * Stores job applications with full employment history, references,
 * and resume uploads. Supports the /careers application form.
 */

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";

// ════════════════════════════════════════════════════════════════════════════════
// EMPLOYMENT APPLICATIONS
// ════════════════════════════════════════════════════════════════════════════════

export const employmentApplications = pgTable(
  "employment_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    
    // Personal Information
    firstName: varchar("first_name", { length: 100 }).notNull(),
    lastName: varchar("last_name", { length: 100 }).notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    streetAddress: varchar("street_address", { length: 255 }).notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 50 }).notNull(),
    zip: varchar("zip", { length: 20 }).notNull(),
    
    // Position Details
    positionApplyingFor: varchar("position_applying_for", { length: 100 }).notNull(),
    preferredStore: varchar("preferred_store", { length: 50 }).notNull(),
    desiredPay: varchar("desired_pay", { length: 100 }),
    availableStartDate: varchar("available_start_date", { length: 50 }),
    employmentType: varchar("employment_type", { length: 50 }).notNull(),
    
    // Availability (JSON: { day: { available: boolean, startTime: string, endTime: string } })
    availability: json("availability").$type<{
      monday?: { available: boolean; startTime?: string; endTime?: string };
      tuesday?: { available: boolean; startTime?: string; endTime?: string };
      wednesday?: { available: boolean; startTime?: string; endTime?: string };
      thursday?: { available: boolean; startTime?: string; endTime?: string };
      friday?: { available: boolean; startTime?: string; endTime?: string };
      saturday?: { available: boolean; startTime?: string; endTime?: string };
    }>(),
    
    // Qualification Questions
    authorizedToWork: boolean("authorized_to_work").notNull(),
    hasReliableTransportation: boolean("has_reliable_transportation").notNull(),
    hasValidDriversLicense: boolean("has_valid_drivers_license").notNull(),
    workedHereBefore: boolean("worked_here_before").notNull(),
    workedHereBeforeExplanation: text("worked_here_before_explanation"),
    
    // Experience
    yearsAutomotiveExperience: varchar("years_automotive_experience", { length: 20 }),
    yearsTireExperience: varchar("years_tire_experience", { length: 20 }),
    customerServiceExperience: text("customer_service_experience"),
    salesExperience: text("sales_experience"),
    
    // Skills (booleans)
    isAseCertified: boolean("is_ase_certified").default(false),
    hasForkliftExperience: boolean("has_forklift_experience").default(false),
    hasAlignmentExperience: boolean("has_alignment_experience").default(false),
    hasTpmsExperience: boolean("has_tpms_experience").default(false),
    hasMountingBalancingExperience: boolean("has_mounting_balancing_experience").default(false),
    hasOilChangeExperience: boolean("has_oil_change_experience").default(false),
    hasBrakeExperience: boolean("has_brake_experience").default(false),
    hasSuspensionExperience: boolean("has_suspension_experience").default(false),
    
    // Employment History (JSON array of up to 3 employers)
    employmentHistory: json("employment_history").$type<Array<{
      company: string;
      position: string;
      supervisor?: string;
      phone?: string;
      startDate?: string;
      endDate?: string;
      reasonForLeaving?: string;
      responsibilities?: string;
    }>>(),
    
    // Education
    highestEducation: varchar("highest_education", { length: 50 }),
    
    // References (JSON array of up to 3 references)
    references: json("references").$type<Array<{
      name: string;
      relationship: string;
      phone: string;
    }>>(),
    
    // Resume
    resumeUrl: text("resume_url"),
    resumeFilename: varchar("resume_filename", { length: 255 }),
    
    // How did you hear about us
    heardAboutUs: varchar("heard_about_us", { length: 100 }),
    
    // Additional Comments
    additionalComments: text("additional_comments"),
    
    // Agreement
    certificationAgreed: boolean("certification_agreed").notNull(),
    electronicSignature: varchar("electronic_signature", { length: 200 }).notNull(),
    signatureDate: varchar("signature_date", { length: 50 }).notNull(),
    
    // Admin/Status Fields
    status: varchar("status", { length: 50 }).notNull().default("new"),
    reviewedBy: varchar("reviewed_by", { length: 100 }),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }),
    reviewNotes: text("review_notes"),
    archivedAt: timestamp("archived_at", { mode: "date" }),
    
    // Metadata
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    turnstileToken: varchar("turnstile_token", { length: 2000 }),
    
    // Timestamps
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("ea_status_idx").on(table.status),
    emailIdx: index("ea_email_idx").on(table.email),
    positionIdx: index("ea_position_idx").on(table.positionApplyingFor),
    createdAtIdx: index("ea_created_at_idx").on(table.createdAt),
    storeIdx: index("ea_store_idx").on(table.preferredStore),
  })
);

export type EmploymentApplication = typeof employmentApplications.$inferSelect;
export type NewEmploymentApplication = typeof employmentApplications.$inferInsert;
