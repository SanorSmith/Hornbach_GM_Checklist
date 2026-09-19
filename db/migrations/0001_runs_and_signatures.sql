CREATE TABLE "checklist_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"template_code" text NOT NULL,
	"template_version" integer NOT NULL,
	"business_date" date NOT NULL,
	"shift" "shift_code" NOT NULL,
	"status" "run_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "run_item_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_item_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"field_type" "field_type" NOT NULL,
	"value_text" text,
	"value_numeric" numeric,
	"value_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"assignee_slot" smallint DEFAULT 1 NOT NULL,
	"status" "item_status" DEFAULT 'PENDING' NOT NULL,
	"answer" "answer_value",
	"answer_code" text,
	"note" text,
	"due_at" timestamp with time zone,
	"is_late" boolean,
	"answered_by" uuid,
	"answered_at" timestamp with time zone,
	"client_answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"slot" smallint DEFAULT 1 NOT NULL,
	"purpose" text DEFAULT 'WORKER_SUBMIT' NOT NULL,
	"user_id" uuid NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_label" text,
	"content_hash" text NOT NULL,
	"signature_hash" text NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_item_field_values" ADD CONSTRAINT "run_item_field_values_run_item_id_run_items_id_fk" FOREIGN KEY ("run_item_id") REFERENCES "public"."run_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_item_field_values" ADD CONSTRAINT "run_item_field_values_value_user_id_users_id_fk" FOREIGN KEY ("value_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_run_id_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_run_id_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "runs_unique_per_day" ON "checklist_runs" USING btree ("store_id","template_code","business_date","shift");--> statement-breakpoint
CREATE INDEX "runs_by_date_idx" ON "checklist_runs" USING btree ("store_id","business_date");--> statement-breakpoint
CREATE UNIQUE INDEX "run_item_field_unique" ON "run_item_field_values" USING btree ("run_item_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "run_items_unique" ON "run_items" USING btree ("run_id","item_code");--> statement-breakpoint
CREATE INDEX "run_items_code_idx" ON "run_items" USING btree ("item_code");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_unique" ON "signatures" USING btree ("run_id","slot","purpose");