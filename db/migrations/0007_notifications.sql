CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"business_date" date NOT NULL,
	"template_code" text NOT NULL,
	"slot" smallint DEFAULT 1 NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" "notif_channel" DEFAULT 'IN_APP' NOT NULL,
	"state" "notif_state" DEFAULT 'SCHEDULED' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_dedupe" ON "notifications" USING btree ("store_id","business_date","template_code","slot","recipient_id","kind");--> statement-breakpoint
CREATE INDEX "notifications_for_recipient" ON "notifications" USING btree ("recipient_id","state");