CREATE TABLE `share_views` (
	`id` text PRIMARY KEY NOT NULL,
	`share_token` text NOT NULL,
	`viewer_key` text NOT NULL,
	`first_viewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`viewed_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`share_token`) REFERENCES `shares`(`token`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_views_share_viewer_unique` ON `share_views` (`share_token`,`viewer_key`);--> statement-breakpoint
CREATE INDEX `share_views_share_idx` ON `share_views` (`share_token`);