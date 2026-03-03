-- gcphone-next incremental migration
-- Adds Dark Rooms enhancements (attachments, optional password, anonymous mode)

CREATE TABLE IF NOT EXISTS `phone_darkrooms_rooms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `slug` VARCHAR(40) NOT NULL UNIQUE,
    `name` VARCHAR(60) NOT NULL,
    `description` VARCHAR(220) DEFAULT NULL,
    `icon` VARCHAR(4) DEFAULT '🌙',
    `password_hash` CHAR(64) DEFAULT NULL,
    `created_by` VARCHAR(50) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_slug` (`slug`),
    KEY `idx_password_hash` (`password_hash`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_darkrooms_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_id` INT NOT NULL,
    `identifier` VARCHAR(50) NOT NULL,
    `role` ENUM('member', 'moderator') DEFAULT 'member',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`room_id`) REFERENCES `phone_darkrooms_rooms`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_room_member` (`room_id`, `identifier`),
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_darkrooms_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `room_id` INT NOT NULL,
    `author_identifier` VARCHAR(50) NOT NULL,
    `author_name` VARCHAR(64) NOT NULL,
    `title` VARCHAR(140) NOT NULL,
    `content` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `is_anonymous` TINYINT(1) DEFAULT 0,
    `score` INT DEFAULT 0,
    `comments_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`room_id`) REFERENCES `phone_darkrooms_rooms`(`id`) ON DELETE CASCADE,
    KEY `idx_room_created` (`room_id`, `created_at`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_darkrooms_votes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL,
    `identifier` VARCHAR(50) NOT NULL,
    `value` TINYINT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`post_id`) REFERENCES `phone_darkrooms_posts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_post_voter` (`post_id`, `identifier`),
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_darkrooms_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL,
    `author_identifier` VARCHAR(50) NOT NULL,
    `author_name` VARCHAR(64) NOT NULL,
    `content` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `is_anonymous` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`post_id`) REFERENCES `phone_darkrooms_posts`(`id`) ON DELETE CASCADE,
    KEY `idx_post_created` (`post_id`, `created_at`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `phone_darkrooms_rooms`
    ADD COLUMN IF NOT EXISTS `password_hash` CHAR(64) DEFAULT NULL AFTER `icon`;

ALTER TABLE `phone_darkrooms_posts`
    ADD COLUMN IF NOT EXISTS `media_url` VARCHAR(500) DEFAULT NULL AFTER `content`,
    ADD COLUMN IF NOT EXISTS `is_anonymous` TINYINT(1) DEFAULT 0 AFTER `media_url`;

ALTER TABLE `phone_darkrooms_comments`
    ADD COLUMN IF NOT EXISTS `media_url` VARCHAR(500) DEFAULT NULL AFTER `content`,
    ADD COLUMN IF NOT EXISTS `is_anonymous` TINYINT(1) DEFAULT 0 AFTER `media_url`;

ALTER TABLE `phone_messages`
    ADD INDEX IF NOT EXISTS `idx_phone_messages_time` (`time`);
ALTER TABLE `phone_chat_group_messages`
    ADD INDEX IF NOT EXISTS `idx_group_messages_created` (`created_at`);
ALTER TABLE `phone_calls`
    ADD INDEX IF NOT EXISTS `idx_phone_calls_time` (`time`);
ALTER TABLE `phone_chirp_tweets`
    ADD INDEX IF NOT EXISTS `idx_chirp_tweets_created` (`created_at`);
ALTER TABLE `phone_snap_posts`
    ADD INDEX IF NOT EXISTS `idx_snap_posts_created` (`created_at`);
ALTER TABLE `phone_clips_posts`
    ADD INDEX IF NOT EXISTS `idx_clips_posts_created` (`created_at`);
ALTER TABLE `phone_news`
    ADD INDEX IF NOT EXISTS `idx_phone_news_created` (`created_at`);
ALTER TABLE `phone_market`
    ADD INDEX IF NOT EXISTS `idx_market_created` (`created_at`);
ALTER TABLE `phone_darkrooms_posts`
    ADD INDEX IF NOT EXISTS `idx_darkrooms_posts_created` (`created_at`);
ALTER TABLE `phone_darkrooms_comments`
    ADD INDEX IF NOT EXISTS `idx_darkrooms_comments_created` (`created_at`);
