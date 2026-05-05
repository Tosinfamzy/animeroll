CREATE TABLE `anime_cache` (
	`mal_id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`title_english` text,
	`image_url` text NOT NULL,
	`episodes` integer,
	`duration_minutes` integer,
	`genres` text DEFAULT '[]' NOT NULL,
	`year` integer,
	`mean_score` real,
	`synopsis` text,
	`cached_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'me' NOT NULL,
	`mal_id` integer NOT NULL,
	`status` text DEFAULT 'plan' NOT NULL,
	`user_score` integer,
	`private_notes` text,
	`episodes_watched` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`mal_id`) REFERENCES `anime_cache`(`mal_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_user_mal_unique` ON `entries` (`user_id`,`mal_id`);--> statement-breakpoint
CREATE INDEX `entries_status_idx` ON `entries` (`status`);--> statement-breakpoint
CREATE INDEX `entries_archived_idx` ON `entries` (`archived`);--> statement-breakpoint
CREATE INDEX `entries_mal_idx` ON `entries` (`mal_id`);--> statement-breakpoint
CREATE INDEX `entries_user_idx` ON `entries` (`user_id`);--> statement-breakpoint
CREATE TABLE `list_entries` (
	`list_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`list_id`, `entry_id`),
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `list_entries_entry_idx` ON `list_entries` (`entry_id`);--> statement-breakpoint
CREATE TABLE `lists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text DEFAULT 'me' NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lists_user_idx` ON `lists` (`user_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`share_token` text NOT NULL,
	`reactor_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`share_token`) REFERENCES `shares`(`token`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_share_reactor_unique` ON `reactions` (`share_token`,`reactor_id`);--> statement-breakpoint
CREATE INDEX `reactions_share_idx` ON `reactions` (`share_token`);--> statement-breakpoint
CREATE TABLE `shares` (
	`token` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`entry_id` text,
	`list_id` text,
	`take` text,
	`snapshot` text NOT NULL,
	`created_by` text DEFAULT 'me' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`list_id`) REFERENCES `lists`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "shares_exactly_one_fk" CHECK(("shares"."entry_id" IS NOT NULL AND "shares"."list_id" IS NULL) OR ("shares"."entry_id" IS NULL AND "shares"."list_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `shares_entry_idx` ON `shares` (`entry_id`);--> statement-breakpoint
CREATE INDEX `shares_list_idx` ON `shares` (`list_id`);