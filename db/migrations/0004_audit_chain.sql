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

CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_log_chain ON audit_log;--> statement-breakpoint

CREATE TRIGGER audit_log_chain
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION gm_audit_chain();--> statement-breakpoint

CREATE OR REPLACE FUNCTION gm_audit_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS audit_log_immutable ON audit_log;--> statement-breakpoint

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION gm_audit_immutable();
