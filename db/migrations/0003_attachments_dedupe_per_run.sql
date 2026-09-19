DROP INDEX "attachments_dedupe";--> statement-breakpoint
CREATE UNIQUE INDEX "attachments_dedupe" ON "attachments" USING btree ("run_id","item_code","sha256");