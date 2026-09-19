CREATE TYPE "public"."answer_mode" AS ENUM('JA_NEJ', 'JA_NEJ_INGET_BEHOV', 'CODED', 'NUMERIC_ONLY');--> statement-breakpoint
CREATE TYPE "public"."answer_value" AS ENUM('JA', 'NEJ', 'INGET_BEHOV');--> statement-breakpoint
CREATE TYPE "public"."control_status" AS ENUM('PENDING', 'OK', 'NOT_OK', 'FOLLOW_UP');--> statement-breakpoint
CREATE TYPE "public"."escalation_state" AS ENUM('OPEN', 'ACKED', 'RESOLVED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."field_type" AS ENUM('INTEGER', 'DECIMAL', 'TEXT', 'PERSON_REF', 'TIME');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('PENDING', 'BLOCKED', 'ANSWERED', 'NOT_APPLICABLE', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."notif_channel" AS ENUM('PUSH', 'LOCAL_ALARM', 'IN_APP', 'EMAIL');--> statement-breakpoint
CREATE TYPE "public"."notif_state" AS ENUM('SCHEDULED', 'SENT', 'DELIVERED', 'ACKED', 'CANCELLED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('SCHEDULED', 'OPEN', 'SUBMITTED', 'AFTER_CONTROLLED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."shift_code" AS ENUM('MORNING', 'MIDDAY', 'EVENING', 'FULL_DAY');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('WORKER', 'GROUP_LEADER', 'ADMIN');--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Stockholm' NOT NULL,
	"locale" text DEFAULT 'sv-SE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "badge_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_hash" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"device_key" text NOT NULL,
	"label" text,
	"kind" text DEFAULT 'ZEBRA' NOT NULL,
	"is_shared" boolean DEFAULT true NOT NULL,
	"app_version" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_device_key_unique" UNIQUE("device_key")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"device_id" uuid,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" "inet",
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "user_role_grants" (
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_grants_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"employee_no" text,
	"email" text,
	"password_hash" text,
	"pin_hash" text,
	"pin_failed_count" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"default_shift" "shift_code",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"seq" bigserial PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_username" text,
	"device_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before" jsonb,
	"after" jsonb,
	"op_id" uuid,
	"prev_hash" "bytea",
	"row_hash" "bytea"
);
--> statement-breakpoint
ALTER TABLE "badge_credentials" ADD CONSTRAINT "badge_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_grants" ADD CONSTRAINT "user_role_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "badge_hash_active_uq" ON "badge_credentials" USING btree ("badge_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_store_username_uq" ON "users" USING btree ("store_id","username");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","seq");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_user_id","occurred_at");