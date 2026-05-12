CREATE TABLE "stream_configs" (
	"cell_id" text PRIMARY KEY NOT NULL,
	"source" text DEFAULT 'offline' NOT NULL,
	"url" text,
	"title" text,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
