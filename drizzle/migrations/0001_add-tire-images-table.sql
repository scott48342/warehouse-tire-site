CREATE TABLE "abandoned_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" varchar(64) NOT NULL,
	"session_id" varchar(255),
	"customer_first_name" varchar(100),
	"customer_last_name" varchar(100),
	"customer_email" varchar(255),
	"customer_phone" varchar(50),
	"vehicle_year" varchar(10),
	"vehicle_make" varchar(100),
	"vehicle_model" varchar(100),
	"vehicle_trim" varchar(255),
	"items" jsonb NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estimated_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"recovered_order_id" varchar(255),
	"recovered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"abandoned_at" timestamp,
	"source" varchar(50),
	"user_agent" text,
	"ip_address" varchar(45),
	"first_email_sent_at" timestamp,
	"second_email_sent_at" timestamp,
	"email_sent_count" integer DEFAULT 0 NOT NULL,
	"recovered_after_email" boolean DEFAULT false,
	"unsubscribed" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "catalog_makes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_makes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "catalog_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"make_slug" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"name" varchar(100) NOT NULL,
	"years" integer[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_key" varchar(255),
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tire_images" (
	"pattern_id" integer PRIMARY KEY NOT NULL,
	"brand" varchar(100),
	"pattern" varchar(200),
	"source_url" text NOT NULL,
	"blob_url" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"content_type" varchar(50),
	"file_size" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_at" timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX "abandoned_carts_cart_id_idx" ON "abandoned_carts" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "abandoned_carts_status_idx" ON "abandoned_carts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "abandoned_carts_email_idx" ON "abandoned_carts" USING btree ("customer_email");--> statement-breakpoint
CREATE INDEX "abandoned_carts_last_activity_idx" ON "abandoned_carts" USING btree ("last_activity_at");--> statement-breakpoint
CREATE INDEX "abandoned_carts_created_at_idx" ON "abandoned_carts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "catalog_makes_slug_idx" ON "catalog_makes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "catalog_models_make_slug_idx" ON "catalog_models" USING btree ("make_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_models_make_model_idx" ON "catalog_models" USING btree ("make_slug","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_sync_log_entity_idx" ON "catalog_sync_log" USING btree ("entity_type","entity_key");--> statement-breakpoint
CREATE INDEX "tire_images_status_idx" ON "tire_images" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tire_images_brand_idx" ON "tire_images" USING btree ("brand");