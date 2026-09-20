ALTER TABLE "checklist_runs" ADD COLUMN "control_status" "control_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD COLUMN "controlled_by" uuid;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD COLUMN "controlled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD COLUMN "control_note" text;--> statement-breakpoint
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_controlled_by_users_id_fk" FOREIGN KEY ("controlled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;