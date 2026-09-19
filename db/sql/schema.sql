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

-- ===== db/sql/audit_chain.sql =====
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

