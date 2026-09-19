-- GENERATED FILE — do not edit by hand.
-- Rebuild with: npm run db:schema-sql
--
-- Full schema for the Hornbach GM Checklist database.
-- Paste into the Neon SQL editor, or prefer `npm run db:migrate`, which
-- keeps migration history.

-- ===== db/migrations/0000_identity_and_audit.sql =====
CREATE TYPE "public"."answer_mode" AS ENUM('JA_NEJ', 'JA_NEJ_INGET_BEHOV', 'CODED', 'NUMERIC_ONLY');
CREATE TYPE "public"."answer_value" AS ENUM('JA', 'NEJ', 'INGET_BEHOV');
CREATE TYPE "public"."control_status" AS ENUM('PENDING', 'OK', 'NOT_OK', 'FOLLOW_UP');
CREATE TYPE "public"."escalation_state" AS ENUM('OPEN', 'ACKED', 'RESOLVED', 'EXPIRED');
CREATE TYPE "public"."field_type" AS ENUM('INTEGER', 'DECIMAL', 'TEXT', 'PERSON_REF', 'TIME');
CREATE TYPE "public"."item_status" AS ENUM('PENDING', 'BLOCKED', 'ANSWERED', 'NOT_APPLICABLE', 'SKIPPED');
CREATE TYPE "public"."notif_channel" AS ENUM('PUSH', 'LOCAL_ALARM', 'IN_APP', 'EMAIL');
CREATE TYPE "public"."notif_state" AS ENUM('SCHEDULED', 'SENT', 'DELIVERED', 'ACKED', 'CANCELLED', 'FAILED');
CREATE TYPE "public"."run_status" AS ENUM('SCHEDULED', 'OPEN', 'SUBMITTED', 'AFTER_CONTROLLED', 'VOID');
CREATE TYPE "public"."shift_code" AS ENUM('MORNING', 'MIDDAY', 'EVENING', 'FULL_DAY');
CREATE TYPE "public"."template_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "public"."user_role" AS ENUM('WORKER', 'GROUP_LEADER', 'ADMIN');
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/Stockholm' NOT NULL,
	"locale" text DEFAULT 'sv-SE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);

CREATE TABLE "badge_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"badge_hash" text NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);

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

CREATE TABLE "user_role_grants" (
	"user_id" uuid NOT NULL,
	"role" "user_role" NOT NULL,
	"granted_by" uuid,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_grants_user_id_role_pk" PRIMARY KEY("user_id","role")
);

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

ALTER TABLE "badge_credentials" ADD CONSTRAINT "badge_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "devices" ADD CONSTRAINT "devices_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_role_grants" ADD CONSTRAINT "user_role_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "badge_hash_active_uq" ON "badge_credentials" USING btree ("badge_hash");
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
CREATE UNIQUE INDEX "users_store_username_uq" ON "users" USING btree ("store_id","username");
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","seq");
CREATE INDEX "audit_actor_idx" ON "audit_log" USING btree ("actor_user_id","occurred_at");

-- ===== db/migrations/0001_runs_and_signatures.sql =====
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

CREATE TABLE "run_item_field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_item_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"field_type" "field_type" NOT NULL,
	"value_text" text,
	"value_numeric" numeric,
	"value_user_id" uuid
);

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

ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "checklist_runs" ADD CONSTRAINT "checklist_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "run_item_field_values" ADD CONSTRAINT "run_item_field_values_run_item_id_run_items_id_fk" FOREIGN KEY ("run_item_id") REFERENCES "public"."run_items"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "run_item_field_values" ADD CONSTRAINT "run_item_field_values_value_user_id_users_id_fk" FOREIGN KEY ("value_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_run_id_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "run_items" ADD CONSTRAINT "run_items_answered_by_users_id_fk" FOREIGN KEY ("answered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_run_id_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "runs_unique_per_day" ON "checklist_runs" USING btree ("store_id","template_code","business_date","shift");
CREATE INDEX "runs_by_date_idx" ON "checklist_runs" USING btree ("store_id","business_date");
CREATE UNIQUE INDEX "run_item_field_unique" ON "run_item_field_values" USING btree ("run_item_id","field_key");
CREATE UNIQUE INDEX "run_items_unique" ON "run_items" USING btree ("run_id","item_code");
CREATE INDEX "run_items_code_idx" ON "run_items" USING btree ("item_code");
CREATE UNIQUE INDEX "signature_unique" ON "signatures" USING btree ("run_id","slot","purpose");

-- ===== db/migrations/0002_attachments.sql =====
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"item_code" text NOT NULL,
	"group_key" text,
	"content_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"sha256" text NOT NULL,
	"bytes" "bytea",
	"storage_key" text,
	"captured_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" uuid,
	"deleted_at" timestamp with time zone
);

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_run_id_checklist_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."checklist_runs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "attachments_dedupe" ON "attachments" USING btree ("item_code","sha256");
CREATE INDEX "attachments_run_idx" ON "attachments" USING btree ("run_id");

-- ===== db/migrations/0003_attachments_dedupe_per_run.sql =====
DROP INDEX "attachments_dedupe";
CREATE UNIQUE INDEX "attachments_dedupe" ON "attachments" USING btree ("run_id","item_code","sha256");

-- ===== db/migrations/0004_audit_chain.sql =====
-- ---------------------------------------------------------------------------
-- Append-only, hash-chained audit log.
--
-- Each row's row_hash covers the previous row's hash for the same store, so
-- editing or deleting any row in the middle breaks the chain and
-- scripts/verify-audit-chain.ts detects it.
--
-- Immutability is enforced with a TRIGGER rather than REVOKE on purpose: on
-- Neon the application connects as neondb_owner, and an owner can grant its
-- own privileges back. A trigger stops the owner too.
--
-- Hand-written: drizzle-kit generates migrations by diffing the Drizzle schema,
-- which does not model functions or triggers. It lived in db/sql/audit_chain.sql
-- until it turned out that `npm run db:migrate` therefore skipped it, leaving an
-- audit log that was neither chained nor immutable with nothing to say so.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION gm_audit_chain() RETURNS trigger AS $$
DECLARE
  v_prev bytea;
BEGIN
  -- Serialise per store, so two concurrent inserts cannot both claim the same
  -- predecessor and silently fork the chain.
  PERFORM pg_advisory_xact_lock(hashtext('gm_audit_' || NEW.store_id::text));

  SELECT row_hash INTO v_prev
    FROM audit_log
   WHERE store_id = NEW.store_id
   ORDER BY seq DESC
   LIMIT 1;

  NEW.prev_hash := v_prev;

  -- jsonb renders with normalised key order, so ::text is already canonical.
  NEW.row_hash := digest(
    coalesce(encode(v_prev, 'hex'), '')                                        || '|' ||
    NEW.store_id::text                                                          || '|' ||
    to_char(NEW.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || '|' ||
    coalesce(NEW.actor_user_id::text, '')                                       || '|' ||
    coalesce(NEW.actor_username, '')                                            || '|' ||
    NEW.action                                                                  || '|' ||
    NEW.entity_type                                                             || '|' ||
    coalesce(NEW.entity_id::text, '')                                           || '|' ||
    coalesce(NEW.before::text, '')                                              || '|' ||
    coalesce(NEW.after::text, ''),
    'sha256'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_chain ON audit_log;

CREATE TRIGGER audit_log_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION gm_audit_chain();

CREATE OR REPLACE FUNCTION gm_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION gm_audit_immutable();

