CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"whatsapp" text NOT NULL,
	"email" text,
	"city" text NOT NULL,
	"cell_id" text NOT NULL,
	"language" text DEFAULT 'pt-BR' NOT NULL,
	"lgpd_consent" boolean DEFAULT false NOT NULL,
	"lgpd_consent_at" timestamp with time zone,
	"source" text DEFAULT 'pre-reg' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reg_cell_idx" ON "registrations" USING btree ("cell_id");--> statement-breakpoint
CREATE INDEX "reg_whatsapp_idx" ON "registrations" USING btree ("whatsapp");--> statement-breakpoint
CREATE INDEX "reg_created_at_idx" ON "registrations" USING btree ("created_at");