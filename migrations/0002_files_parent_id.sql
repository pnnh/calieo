ALTER TABLE `files` ADD COLUMN `parent_id` text REFERENCES `files`(`id`) ON DELETE set null;
