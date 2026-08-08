-- Create channel_files join table (replaces files.channel_id)
CREATE TABLE `channel_files` (
	`channel_id` text NOT NULL,
	`file_id` text NOT NULL UNIQUE,
	FOREIGN KEY (`channel_id`) REFERENCES `channels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
-- Migrate existing data from files.channel_id
INSERT INTO `channel_files` (`channel_id`, `file_id`)
SELECT `channel_id`, `id` FROM `files` WHERE `channel_id` IS NOT NULL;
--> statement-breakpoint
-- SQLite does not support DROP COLUMN directly on tables with foreign-key constraints
-- in older versions. Use the recommended rename+recreate approach.
CREATE TABLE `files_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`is_published` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `files_new` SELECT `id`, `user_id`, `title`, `description`, `filename`, `mime_type`, `size`, `is_published`, `created_at`, `updated_at` FROM `files`;
--> statement-breakpoint
DROP TABLE `files`;
--> statement-breakpoint
ALTER TABLE `files_new` RENAME TO `files`;
