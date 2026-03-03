-- gcphone-next Database Schema
-- Compatible with MariaDB/MySQL
-- Run this first before starting the resource

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Phone numbers and metadata
CREATE TABLE IF NOT EXISTS `phone_numbers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL UNIQUE,
    `imei` VARCHAR(20) NOT NULL UNIQUE,
    `wallpaper` VARCHAR(255) DEFAULT './img/background/back001.jpg',
    `ringtone` VARCHAR(50) DEFAULT 'ring.ogg',
    `volume` FLOAT DEFAULT 0.5,
    `lock_code` VARCHAR(10) DEFAULT '0000',
    `coque` VARCHAR(50) DEFAULT 'sin_funda.png',
    `theme` VARCHAR(10) DEFAULT 'light',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_identifier` (`identifier`),
    UNIQUE KEY `idx_phone_number` (`phone_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Contacts
CREATE TABLE IF NOT EXISTS `phone_contacts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `number` VARCHAR(15) NOT NULL,
    `display` VARCHAR(100) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `favorite` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Messages (SMS)
CREATE TABLE IF NOT EXISTS `phone_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transmitter` VARCHAR(15) NOT NULL,
    `receiver` VARCHAR(15) NOT NULL,
    `message` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `owner` TINYINT(1) DEFAULT 0 COMMENT '0 = received, 1 = sent',
    `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_transmitter` (`transmitter`),
    KEY `idx_receiver` (`receiver`),
    KEY `idx_time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WaveChat groups
CREATE TABLE IF NOT EXISTS `phone_chat_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `owner_identifier` VARCHAR(50) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_owner_identifier` (`owner_identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_chat_group_members` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `group_id` INT NOT NULL,
    `identifier` VARCHAR(50) NOT NULL,
    `role` ENUM('owner', 'member') DEFAULT 'member',
    `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`group_id`) REFERENCES `phone_chat_groups`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_group_member` (`group_id`, `identifier`),
    KEY `idx_member_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_chat_group_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `group_id` INT NOT NULL,
    `sender_identifier` VARCHAR(50) NOT NULL,
    `sender_number` VARCHAR(15) DEFAULT NULL,
    `message` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`group_id`) REFERENCES `phone_chat_groups`(`id`) ON DELETE CASCADE,
    KEY `idx_group_created` (`group_id`, `created_at`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Call history
CREATE TABLE IF NOT EXISTS `phone_calls` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `owner` VARCHAR(15) NOT NULL COMMENT 'Phone number of owner',
    `num` VARCHAR(15) NOT NULL COMMENT 'Other party number',
    `incoming` TINYINT(1) NOT NULL COMMENT '0 = outgoing, 1 = incoming',
    `accepts` TINYINT(1) NOT NULL COMMENT '0 = rejected/missed, 1 = accepted',
    `duration` INT DEFAULT 0 COMMENT 'Call duration in seconds',
    `hidden` TINYINT(1) DEFAULT 0 COMMENT 'Hidden caller ID',
    `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_owner` (`owner`),
    KEY `idx_num` (`num`),
    KEY `idx_time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- APP TABLES
-- ============================================================

-- Gallery
CREATE TABLE IF NOT EXISTS `phone_gallery` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `type` ENUM('image', 'video') DEFAULT 'image',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- App layout per player (home/menu ordering)
CREATE TABLE IF NOT EXISTS `phone_layouts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `layout_json` LONGTEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp (Twitter clone) - Accounts
CREATE TABLE IF NOT EXISTS `phone_chirp_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL UNIQUE,
    `username` VARCHAR(30) NOT NULL UNIQUE,
    `display_name` VARCHAR(50) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `bio` VARCHAR(160) DEFAULT NULL,
    `verified` TINYINT(1) DEFAULT 0,
    `followers` INT DEFAULT 0,
    `following` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp - Tweets
CREATE TABLE IF NOT EXISTS `phone_chirp_tweets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `content` VARCHAR(280) NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `likes` INT DEFAULT 0,
    `rechirps` INT DEFAULT 0,
    `replies` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_account` (`account_id`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp - Likes
CREATE TABLE IF NOT EXISTS `phone_chirp_likes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tweet_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_tweet_account` (`tweet_id`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp - Following
CREATE TABLE IF NOT EXISTS `phone_chirp_following` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `follower_id` INT NOT NULL,
    `following_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`follower_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`following_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_follow` (`follower_id`, `following_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snap (Instagram clone) - Accounts
CREATE TABLE IF NOT EXISTS `phone_snap_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL UNIQUE,
    `username` VARCHAR(30) NOT NULL UNIQUE,
    `display_name` VARCHAR(50) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `bio` VARCHAR(160) DEFAULT NULL,
    `is_private` TINYINT(1) DEFAULT 0,
    `followers` INT DEFAULT 0,
    `following` INT DEFAULT 0,
    `posts` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snap - Posts
CREATE TABLE IF NOT EXISTS `phone_snap_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `media_url` VARCHAR(500) NOT NULL,
    `media_type` ENUM('image', 'video') DEFAULT 'image',
    `caption` VARCHAR(2200) DEFAULT NULL,
    `likes` INT DEFAULT 0,
    `comments` INT DEFAULT 0,
    `is_live` TINYINT(1) DEFAULT 0,
    `live_viewers` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_account` (`account_id`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snap - Stories
CREATE TABLE IF NOT EXISTS `phone_snap_stories` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `media_url` VARCHAR(500) NOT NULL,
    `media_type` ENUM('image', 'video') DEFAULT 'image',
    `expires_at` TIMESTAMP NOT NULL,
    `views` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_account` (`account_id`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garage
CREATE TABLE IF NOT EXISTS `phone_garage` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `plate` VARCHAR(10) NOT NULL,
    `model` VARCHAR(50) NOT NULL,
    `model_name` VARCHAR(100) DEFAULT NULL,
    `garage_name` VARCHAR(50) DEFAULT NULL,
    `impounded` TINYINT(1) DEFAULT 0,
    `properties` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_plate` (`plate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Market (Classifieds)
CREATE TABLE IF NOT EXISTS `phone_market` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `description` TEXT DEFAULT NULL,
    `price` INT DEFAULT 0,
    `category` VARCHAR(30) NOT NULL,
    `photos` JSON DEFAULT NULL,
    `views` INT DEFAULT 0,
    `status` ENUM('active', 'sold', 'expired') DEFAULT 'active',
    `expires_at` TIMESTAMP DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_category` (`category`),
    KEY `idx_status` (`status`),
    KEY `idx_created` (`created_at`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- News
CREATE TABLE IF NOT EXISTS `phone_news` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `author_name` VARCHAR(100) NOT NULL,
    `author_avatar` VARCHAR(255) DEFAULT NULL,
    `author_verified` TINYINT(1) DEFAULT 0,
    `title` VARCHAR(200) NOT NULL,
    `content` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `media_type` ENUM('image', 'video') DEFAULT 'image',
    `category` VARCHAR(30) NOT NULL,
    `is_live` TINYINT(1) DEFAULT 0,
    `live_viewers` INT DEFAULT 0,
    `views` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`),
    KEY `idx_category` (`category`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clips (short-video app)
CREATE TABLE IF NOT EXISTS `phone_clips_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `media_url` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(500) DEFAULT NULL,
    `likes` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_account` (`account_id`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dark Rooms (forum-style rooms)
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

-- Notes
CREATE TABLE IF NOT EXISTS `phone_notes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `title` VARCHAR(100) DEFAULT NULL,
    `content` TEXT NOT NULL,
    `color` VARCHAR(10) DEFAULT '#FFFFFF',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Utils - Alarms
CREATE TABLE IF NOT EXISTS `phone_alarms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `time` TIME NOT NULL,
    `label` VARCHAR(100) DEFAULT NULL,
    `enabled` TINYINT(1) DEFAULT 1,
    `days` JSON DEFAULT NULL COMMENT 'Array of days 0-6',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PROXIMITY / SHARING
-- ============================================================

-- Friend requests (for Chirp/Snap)
CREATE TABLE IF NOT EXISTS `phone_friend_requests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `from_identifier` VARCHAR(50) NOT NULL,
    `to_identifier` VARCHAR(50) NOT NULL,
    `type` ENUM('chirp', 'snap') NOT NULL,
    `status` ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_from` (`from_identifier`),
    KEY `idx_to` (`to_identifier`),
    UNIQUE KEY `idx_request` (`from_identifier`, `to_identifier`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared locations
CREATE TABLE IF NOT EXISTS `phone_shared_locations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `from_identifier` VARCHAR(50) NOT NULL,
    `to_identifier` VARCHAR(50) NOT NULL,
    `x` FLOAT NOT NULL,
    `y` FLOAT NOT NULL,
    `z` FLOAT NOT NULL,
    `message` VARCHAR(100) DEFAULT NULL,
    `expires_at` TIMESTAMP DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_to` (`to_identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- DROPPED PHONES (for metadata access)
-- ============================================================

CREATE TABLE IF NOT EXISTS `phone_dropped` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `phone_id` VARCHAR(36) NOT NULL,
    `owner_identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL,
    `imei` VARCHAR(20) NOT NULL,
    `coords_x` FLOAT NOT NULL,
    `coords_y` FLOAT NOT NULL,
    `coords_z` FLOAT NOT NULL,
    `picked_up` TINYINT(1) DEFAULT 0,
    `dropped_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_phone_id` (`phone_id`),
    KEY `idx_coords` (`coords_x`, `coords_y`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LIVE LOCATION SHARING
-- ============================================================

CREATE TABLE IF NOT EXISTS `phone_live_locations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sender_phone` VARCHAR(15) NOT NULL,
    `sender_name` VARCHAR(100) NOT NULL,
    `recipient_phone` VARCHAR(15) NOT NULL,
    `x` FLOAT NOT NULL,
    `y` FLOAT NOT NULL,
    `expires_at` TIMESTAMP NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_sender` (`sender_phone`),
    KEY `idx_recipient` (`recipient_phone`),
    KEY `idx_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TRIGGERS (AUTO COUNTERS)
-- ============================================================

DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_insert`;
DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_delete`;
DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_insert`;
DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_delete`;
DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_insert`;
DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_delete`;

DELIMITER $$

CREATE TRIGGER `trg_phone_chirp_likes_after_insert`
AFTER INSERT ON `phone_chirp_likes`
FOR EACH ROW
BEGIN
    UPDATE `phone_chirp_tweets`
    SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = NEW.`tweet_id`)
    WHERE `id` = NEW.`tweet_id`;
END$$

CREATE TRIGGER `trg_phone_chirp_likes_after_delete`
AFTER DELETE ON `phone_chirp_likes`
FOR EACH ROW
BEGIN
    UPDATE `phone_chirp_tweets`
    SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = OLD.`tweet_id`)
    WHERE `id` = OLD.`tweet_id`;
END$$

CREATE TRIGGER `trg_phone_chirp_following_after_insert`
AFTER INSERT ON `phone_chirp_following`
FOR EACH ROW
BEGIN
    UPDATE `phone_chirp_accounts`
    SET `following` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `follower_id` = NEW.`follower_id`)
    WHERE `id` = NEW.`follower_id`;

    UPDATE `phone_chirp_accounts`
    SET `followers` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `following_id` = NEW.`following_id`)
    WHERE `id` = NEW.`following_id`;
END$$

CREATE TRIGGER `trg_phone_chirp_following_after_delete`
AFTER DELETE ON `phone_chirp_following`
FOR EACH ROW
BEGIN
    UPDATE `phone_chirp_accounts`
    SET `following` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `follower_id` = OLD.`follower_id`)
    WHERE `id` = OLD.`follower_id`;

    UPDATE `phone_chirp_accounts`
    SET `followers` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `following_id` = OLD.`following_id`)
    WHERE `id` = OLD.`following_id`;
END$$

CREATE TRIGGER `trg_phone_snap_posts_after_insert`
AFTER INSERT ON `phone_snap_posts`
FOR EACH ROW
BEGIN
    IF NEW.`is_live` = 0 THEN
        UPDATE `phone_snap_accounts`
        SET `posts` = (SELECT COUNT(*) FROM `phone_snap_posts` WHERE `account_id` = NEW.`account_id` AND `is_live` = 0)
        WHERE `id` = NEW.`account_id`;
    END IF;
END$$

CREATE TRIGGER `trg_phone_snap_posts_after_delete`
AFTER DELETE ON `phone_snap_posts`
FOR EACH ROW
BEGIN
    IF OLD.`is_live` = 0 THEN
        UPDATE `phone_snap_accounts`
        SET `posts` = (SELECT COUNT(*) FROM `phone_snap_posts` WHERE `account_id` = OLD.`account_id` AND `is_live` = 0)
        WHERE `id` = OLD.`account_id`;
    END IF;
END$$

DELIMITER ;

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS `idx_messages_transmitter_receiver` ON `phone_messages` (`transmitter`, `receiver`);
CREATE INDEX IF NOT EXISTS `idx_calls_owner_time` ON `phone_calls` (`owner`, `time`);

ALTER TABLE `phone_numbers`
ADD COLUMN IF NOT EXISTS `theme` VARCHAR(10) DEFAULT 'light' AFTER `coque`;
