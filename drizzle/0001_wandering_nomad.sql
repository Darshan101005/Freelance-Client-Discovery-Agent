CREATE TABLE `user_settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`updated` integer NOT NULL
);
