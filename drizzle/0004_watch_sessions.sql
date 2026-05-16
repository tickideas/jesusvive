CREATE TABLE "watch_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"cell_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"referrer" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"ip_hash" text,
	"user_agent" text,
	"is_mobile" boolean,
	CONSTRAINT "watch_sessions_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE INDEX "watch_cell_idx" ON "watch_sessions" USING btree ("cell_id");--> statement-breakpoint
CREATE INDEX "watch_started_at_idx" ON "watch_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "watch_heartbeat_idx" ON "watch_sessions" USING btree ("last_heartbeat_at");