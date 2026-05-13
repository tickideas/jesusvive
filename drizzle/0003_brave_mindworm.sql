CREATE TABLE "whatsapp_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"whatsapp" text NOT NULL,
	"direction" text NOT NULL,
	"body" text,
	"twilio_sid" text,
	"status" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "msg_whatsapp_idx" ON "whatsapp_messages" USING btree ("whatsapp");--> statement-breakpoint
CREATE INDEX "msg_created_at_idx" ON "whatsapp_messages" USING btree ("created_at");