CREATE TABLE "fitment_import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"year_start" integer,
	"year_end" integer,
	"makes" jsonb,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"imported_records" integer DEFAULT 0 NOT NULL,
	"skipped_records" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_error" text,
	"error_log" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitment_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(20) NOT NULL,
	"year" integer,
	"make" varchar(100),
	"model" varchar(100),
	"modification_id" varchar(255),
	"display_trim" varchar(255),
	"bolt_pattern" varchar(20),
	"center_bore_mm" numeric(5, 1),
	"thread_size" varchar(20),
	"seat_type" varchar(20),
	"offset_min_mm" numeric(5, 2),
	"offset_max_mm" numeric(5, 2),
	"oem_wheel_sizes" jsonb,
	"oem_tire_sizes" jsonb,
	"force_quality" varchar(20),
	"notes" text,
	"reason" text NOT NULL,
	"created_by" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fitment_source_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255) NOT NULL,
	"year" integer NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"checksum" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "km_image_mappings" (
	"part_number" varchar(50) PRIMARY KEY NOT NULL,
	"prodline" varchar(20),
	"folder_id" varchar(20),
	"image_url" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modification_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"requested_modification_id" varchar(255) NOT NULL,
	"canonical_modification_id" varchar(255) NOT NULL,
	"display_trim" varchar(255),
	"vehicle_fitment_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicle_fitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"make" varchar(100) NOT NULL,
	"model" varchar(100) NOT NULL,
	"modification_id" varchar(255) NOT NULL,
	"raw_trim" varchar(255),
	"display_trim" varchar(255) NOT NULL,
	"submodel" varchar(255),
	"bolt_pattern" varchar(20),
	"center_bore_mm" numeric(5, 1),
	"thread_size" varchar(20),
	"seat_type" varchar(20),
	"offset_min_mm" numeric(5, 2),
	"offset_max_mm" numeric(5, 2),
	"oem_wheel_sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"oem_tire_sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" varchar(50) NOT NULL,
	"source_record_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_verified_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "modification_aliases" ADD CONSTRAINT "modification_aliases_vehicle_fitment_id_vehicle_fitments_id_fk" FOREIGN KEY ("vehicle_fitment_id") REFERENCES "public"."vehicle_fitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_fitments" ADD CONSTRAINT "vehicle_fitments_source_record_id_fitment_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."fitment_source_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fitment_import_jobs_status_idx" ON "fitment_import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fitment_import_jobs_source_idx" ON "fitment_import_jobs" USING btree ("source");--> statement-breakpoint
CREATE INDEX "fitment_overrides_scope_idx" ON "fitment_overrides" USING btree ("scope","year","make","model");--> statement-breakpoint
CREATE INDEX "fitment_overrides_active_idx" ON "fitment_overrides" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "fitment_source_records_source_source_id_idx" ON "fitment_source_records" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "fitment_source_records_vehicle_idx" ON "fitment_source_records" USING btree ("year","make","model");--> statement-breakpoint
CREATE INDEX "km_image_mappings_prodline_idx" ON "km_image_mappings" USING btree ("prodline");--> statement-breakpoint
CREATE UNIQUE INDEX "modification_aliases_requested_idx" ON "modification_aliases" USING btree ("year","make","model","requested_modification_id");--> statement-breakpoint
CREATE INDEX "modification_aliases_canonical_idx" ON "modification_aliases" USING btree ("year","make","model","canonical_modification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vehicle_fitments_canonical_idx" ON "vehicle_fitments" USING btree ("year","make","model","modification_id");--> statement-breakpoint
CREATE INDEX "vehicle_fitments_ymm_idx" ON "vehicle_fitments" USING btree ("year","make","model");--> statement-breakpoint
CREATE INDEX "vehicle_fitments_make_model_idx" ON "vehicle_fitments" USING btree ("make","model");