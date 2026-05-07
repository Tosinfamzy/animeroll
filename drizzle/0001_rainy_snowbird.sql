DROP INDEX "entries_user_mal_unique";--> statement-breakpoint
DROP INDEX "entries_status_idx";--> statement-breakpoint
DROP INDEX "entries_archived_idx";--> statement-breakpoint
DROP INDEX "entries_mal_idx";--> statement-breakpoint
DROP INDEX "entries_user_idx";--> statement-breakpoint
DROP INDEX "list_entries_entry_idx";--> statement-breakpoint
DROP INDEX "lists_user_idx";--> statement-breakpoint
DROP INDEX "reactions_share_reactor_unique";--> statement-breakpoint
DROP INDEX "reactions_share_idx";--> statement-breakpoint
DROP INDEX "shares_entry_idx";--> statement-breakpoint
DROP INDEX "shares_list_idx";--> statement-breakpoint
ALTER TABLE `entries` ALTER COLUMN "user_id" TO "user_id" text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `entries_user_mal_unique` ON `entries` (`user_id`,`mal_id`);--> statement-breakpoint
CREATE INDEX `entries_status_idx` ON `entries` (`status`);--> statement-breakpoint
CREATE INDEX `entries_archived_idx` ON `entries` (`archived`);--> statement-breakpoint
CREATE INDEX `entries_mal_idx` ON `entries` (`mal_id`);--> statement-breakpoint
CREATE INDEX `entries_user_idx` ON `entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `list_entries_entry_idx` ON `list_entries` (`entry_id`);--> statement-breakpoint
CREATE INDEX `lists_user_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_share_reactor_unique` ON `reactions` (`share_token`,`reactor_id`);--> statement-breakpoint
CREATE INDEX `reactions_share_idx` ON `reactions` (`share_token`);--> statement-breakpoint
CREATE INDEX `shares_entry_idx` ON `shares` (`entry_id`);--> statement-breakpoint
CREATE INDEX `shares_list_idx` ON `shares` (`list_id`);--> statement-breakpoint
ALTER TABLE `lists` ALTER COLUMN "user_id" TO "user_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE `shares` ALTER COLUMN "created_by" TO "created_by" text NOT NULL;