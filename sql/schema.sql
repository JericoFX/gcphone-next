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
    `call_ringtone` VARCHAR(64) DEFAULT 'ring.ogg',
    `notification_tone` VARCHAR(64) DEFAULT 'soft-ping.ogg',
    `message_tone` VARCHAR(64) DEFAULT 'pop.ogg',
    `volume` FLOAT DEFAULT 0.5,
    `lock_code` VARCHAR(10) DEFAULT '0000',
    `theme` VARCHAR(10) DEFAULT 'light',
    `language` VARCHAR(8) DEFAULT 'es',
    `audio_profile` VARCHAR(16) DEFAULT 'normal',
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
    KEY `idx_number` (`number`),
    KEY `idx_identifier_number` (`identifier`, `number`)
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

CREATE TABLE IF NOT EXISTS `phone_chat_group_invites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `group_id` INT NOT NULL,
    `inviter_identifier` VARCHAR(50) NOT NULL,
    `target_identifier` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `responded_at` TIMESTAMP NULL DEFAULT NULL,
    UNIQUE KEY `uniq_group_target_pending` (`group_id`, `target_identifier`),
    KEY `idx_group_invites_target` (`target_identifier`, `status`, `created_at`),
    KEY `idx_group_invites_group` (`group_id`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_wavechat_statuses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL,
    `media_url` VARCHAR(500) NOT NULL,
    `media_type` ENUM('image', 'video') NOT NULL DEFAULT 'image',
    `caption` VARCHAR(140) DEFAULT NULL,
    `views` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `expires_at` TIMESTAMP NOT NULL,
    KEY `idx_wavechat_status_feed` (`expires_at`, `phone_number`, `created_at`),
    KEY `idx_wavechat_status_owner` (`identifier`, `created_at`),
    KEY `idx_wavechat_status_phone` (`phone_number`, `created_at`),
    KEY `idx_wavechat_status_expires` (`expires_at`)
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
    `is_private` TINYINT(1) DEFAULT 0,
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
    KEY `idx_news_live_created` (`is_live`, `created_at`),
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
    `status` ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `responded_at` TIMESTAMP NULL DEFAULT NULL,
    KEY `idx_from` (`from_identifier`),
    KEY `idx_to` (`to_identifier`),
    KEY `idx_to_type_status` (`to_identifier`, `type`, `status`),
    KEY `idx_from_type_status` (`from_identifier`, `type`, `status`),
    UNIQUE KEY `idx_request` (`from_identifier`, `to_identifier`, `type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Social notifications (deduplicated per app + event + reference)
CREATE TABLE IF NOT EXISTS `phone_social_notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_identifier` VARCHAR(50) NOT NULL,
    `from_identifier` VARCHAR(50) NOT NULL,
    `app_type` ENUM('chirp', 'snap') NOT NULL,
    `notification_type` ENUM('follow_request', 'follow_accepted', 'like', 'comment', 'mention') NOT NULL,
    `reference_id` INT DEFAULT NULL,
    `reference_type` VARCHAR(20) DEFAULT NULL,
    `content_preview` VARCHAR(100) DEFAULT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_notification_unique` (`account_identifier`, `from_identifier`, `app_type`, `notification_type`, `reference_id`),
    KEY `idx_account_unread` (`account_identifier`, `is_read`, `created_at`),
    KEY `idx_created` (`created_at`)
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
    KEY `idx_to` (`to_identifier`),
    KEY `idx_expires` (`expires_at`)
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
-- EVENTS (AUTO CLEANUP)
-- ============================================================

CREATE TABLE IF NOT EXISTS `phone_cleanup_rules` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `rule_key` VARCHAR(64) NOT NULL,
    `action` ENUM('delete', 'update') NOT NULL DEFAULT 'delete',
    `table_name` VARCHAR(64) NOT NULL,
    `set_clause` VARCHAR(500) DEFAULT NULL,
    `where_clause` VARCHAR(1000) NOT NULL,
    `run_every_minutes` INT NOT NULL DEFAULT 5,
    `last_run_at` TIMESTAMP NULL DEFAULT NULL,
    `enabled` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_rule_key` (`rule_key`),
    KEY `idx_enabled_schedule` (`enabled`, `run_every_minutes`, `last_run_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS `sp_gcphone_cleanup_add_rule`;
DROP PROCEDURE IF EXISTS `sp_gcphone_cleanup_seed_defaults`;
DROP PROCEDURE IF EXISTS `sp_gcphone_run_cleanup`;

DELIMITER $$

CREATE PROCEDURE `sp_gcphone_cleanup_add_rule`(
    IN p_rule_key VARCHAR(64),
    IN p_action VARCHAR(10),
    IN p_table_name VARCHAR(64),
    IN p_set_clause VARCHAR(500),
    IN p_where_clause VARCHAR(1000),
    IN p_run_every_minutes INT
)
BEGIN
    IF p_rule_key IS NULL OR p_rule_key = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rule_key is required';
    END IF;

    IF p_table_name IS NULL OR p_table_name = '' OR p_table_name NOT REGEXP '^[a-zA-Z0-9_]+$' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'table_name must be alphanumeric + underscore';
    END IF;

    IF p_action NOT IN ('delete', 'update') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'action must be delete or update';
    END IF;

    IF p_where_clause IS NULL OR p_where_clause = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'where_clause is required';
    END IF;

    IF p_action = 'update' AND (p_set_clause IS NULL OR p_set_clause = '') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'set_clause is required for update action';
    END IF;

    IF p_run_every_minutes IS NULL OR p_run_every_minutes < 1 THEN
        SET p_run_every_minutes = 1;
    END IF;

    INSERT INTO `phone_cleanup_rules` (
        `rule_key`, `action`, `table_name`, `set_clause`, `where_clause`, `run_every_minutes`, `enabled`
    ) VALUES (
        p_rule_key, p_action, p_table_name, p_set_clause, p_where_clause, p_run_every_minutes, 1
    )
    ON DUPLICATE KEY UPDATE
        `action` = VALUES(`action`),
        `table_name` = VALUES(`table_name`),
        `set_clause` = VALUES(`set_clause`),
        `where_clause` = VALUES(`where_clause`),
        `run_every_minutes` = VALUES(`run_every_minutes`),
        `enabled` = 1;
END$$

CREATE PROCEDURE `sp_gcphone_cleanup_seed_defaults`()
BEGIN
    CALL sp_gcphone_cleanup_add_rule(
        'live_locations_expired',
        'delete',
        'phone_live_locations',
        NULL,
        'expires_at < NOW()',
        1
    );

    CALL sp_gcphone_cleanup_add_rule(
        'shared_locations_expired',
        'delete',
        'phone_shared_locations',
        NULL,
        'expires_at IS NOT NULL AND expires_at < NOW()',
        1
    );

    CALL sp_gcphone_cleanup_add_rule(
        'snap_stories_expired',
        'delete',
        'phone_snap_stories',
        NULL,
        'expires_at < NOW() OR created_at < (NOW() - INTERVAL 7 DAY)',
        5
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_messages',
        'delete',
        'phone_messages',
        NULL,
        '`time` < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_group_messages',
        'delete',
        'phone_chat_group_messages',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_calls',
        'delete',
        'phone_calls',
        NULL,
        '`time` < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_chirp_tweets',
        'delete',
        'phone_chirp_tweets',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_snap_posts',
        'delete',
        'phone_snap_posts',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_clips_posts',
        'delete',
        'phone_clips_posts',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_news',
        'delete',
        'phone_news',
        NULL,
        'is_live = 0 AND created_at < (NOW() - INTERVAL 10 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_market',
        'delete',
        'phone_market',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_darkrooms_posts',
        'delete',
        'phone_darkrooms_posts',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'retention_darkrooms_comments',
        'delete',
        'phone_darkrooms_comments',
        NULL,
        'created_at < (NOW() - INTERVAL 7 DAY)',
        30
    );

    CALL sp_gcphone_cleanup_add_rule(
        'market_mark_expired',
        'update',
        'phone_market',
        "status = 'expired'",
        "status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()",
        15
    );
END$$

CREATE PROCEDURE `sp_gcphone_run_cleanup`()
BEGIN
    DECLARE v_done INT DEFAULT 0;
    DECLARE v_id INT;
    DECLARE v_action VARCHAR(10);
    DECLARE v_table_name VARCHAR(64);
    DECLARE v_set_clause VARCHAR(500);
    DECLARE v_where_clause VARCHAR(1000);
    DECLARE v_sql LONGTEXT;

    DECLARE cleanup_cursor CURSOR FOR
        SELECT `id`, `action`, `table_name`, `set_clause`, `where_clause`
        FROM `phone_cleanup_rules`
        WHERE `enabled` = 1
          AND (
              `last_run_at` IS NULL
              OR TIMESTAMPDIFF(MINUTE, `last_run_at`, NOW()) >= `run_every_minutes`
          )
        ORDER BY `id` ASC;

    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

    OPEN cleanup_cursor;

    cleanup_loop: LOOP
        FETCH cleanup_cursor INTO v_id, v_action, v_table_name, v_set_clause, v_where_clause;

        IF v_done = 1 THEN
            LEAVE cleanup_loop;
        END IF;

        IF v_table_name REGEXP '^[a-zA-Z0-9_]+$' THEN
            IF v_action = 'delete' THEN
                SET v_sql = CONCAT('DELETE FROM `', v_table_name, '` WHERE ', v_where_clause);
            ELSEIF v_action = 'update' AND v_set_clause IS NOT NULL AND v_set_clause <> '' THEN
                SET v_sql = CONCAT('UPDATE `', v_table_name, '` SET ', v_set_clause, ' WHERE ', v_where_clause);
            ELSE
                SET v_sql = NULL;
            END IF;

            IF v_sql IS NOT NULL THEN
                SET @gcphone_cleanup_sql = v_sql;
                PREPARE stmt_cleanup FROM @gcphone_cleanup_sql;
                EXECUTE stmt_cleanup;
                DEALLOCATE PREPARE stmt_cleanup;

                UPDATE `phone_cleanup_rules`
                SET `last_run_at` = NOW()
                WHERE `id` = v_id;
            END IF;
        END IF;
    END LOOP;

    CLOSE cleanup_cursor;
END$$

DELIMITER ;

CALL `sp_gcphone_cleanup_seed_defaults`();

DROP EVENT IF EXISTS `ev_gcphone_cleanup_live_locations`;
DROP EVENT IF EXISTS `ev_gcphone_cleanup_shared_locations`;
DROP EVENT IF EXISTS `ev_gcphone_cleanup_snap_stories`;
DROP EVENT IF EXISTS `ev_gcphone_cleanup_market_expired`;
DROP EVENT IF EXISTS `ev_gcphone_cleanup_runner`;
CREATE EVENT `ev_gcphone_cleanup_runner`
    ON SCHEDULE EVERY 1 MINUTE
    DO
        CALL `sp_gcphone_run_cleanup`();

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS `idx_messages_transmitter_receiver` ON `phone_messages` (`transmitter`, `receiver`);
CREATE INDEX IF NOT EXISTS `idx_calls_owner_time` ON `phone_calls` (`owner`, `time`);

ALTER TABLE `phone_numbers`
DROP COLUMN IF EXISTS `coque`;

ALTER TABLE `phone_numbers`
ADD COLUMN IF NOT EXISTS `theme` VARCHAR(10) DEFAULT 'light' AFTER `lock_code`;

ALTER TABLE `phone_numbers`
ADD COLUMN IF NOT EXISTS `language` VARCHAR(8) DEFAULT 'es' AFTER `theme`;

ALTER TABLE `phone_numbers`
ADD COLUMN IF NOT EXISTS `audio_profile` VARCHAR(16) DEFAULT 'normal' AFTER `language`;

CREATE TABLE IF NOT EXISTS `phone_wallets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL UNIQUE,
    `balance` DECIMAL(12,2) DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_wallet_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_wallet_cards` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `label` VARCHAR(32) NOT NULL,
    `last4` CHAR(4) NOT NULL,
    `color` VARCHAR(20) DEFAULT '#2E3B57',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_wallet_cards_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_wallet_transactions` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `amount` DECIMAL(12,2) NOT NULL,
    `type` ENUM('in','out','adjust') NOT NULL,
    `title` VARCHAR(64) DEFAULT NULL,
    `target_phone` VARCHAR(15) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_wallet_tx_identifier` (`identifier`),
    KEY `idx_wallet_tx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `doc_type` VARCHAR(24) NOT NULL,
    `title` VARCHAR(64) NOT NULL,
    `holder_name` VARCHAR(64) NOT NULL,
    `holder_number` VARCHAR(20) DEFAULT NULL,
    `expires_at` VARCHAR(24) DEFAULT NULL,
    `verification_code` VARCHAR(20) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_documents_identifier` (`identifier`),
    KEY `idx_documents_type` (`doc_type`),
    KEY `idx_documents_code` (`verification_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `phone_numbers`
    ADD COLUMN IF NOT EXISTS `pin_hash` CHAR(64) NULL AFTER `lock_code`,
    ADD COLUMN IF NOT EXISTS `is_setup` TINYINT(1) NOT NULL DEFAULT 1 AFTER `pin_hash`,
    ADD COLUMN IF NOT EXISTS `clips_username` VARCHAR(32) NULL AFTER `audio_profile`,
    ADD COLUMN IF NOT EXISTS `call_ringtone` VARCHAR(64) DEFAULT 'ring.ogg' AFTER `ringtone`,
    ADD COLUMN IF NOT EXISTS `notification_tone` VARCHAR(64) DEFAULT 'soft-ping.ogg' AFTER `call_ringtone`,
    ADD COLUMN IF NOT EXISTS `message_tone` VARCHAR(64) DEFAULT 'pop.ogg' AFTER `notification_tone`;

CREATE UNIQUE INDEX IF NOT EXISTS `idx_phone_numbers_clips_username`
    ON `phone_numbers` (`clips_username`);

ALTER TABLE `phone_snap_accounts`
    ADD COLUMN IF NOT EXISTS `verified` TINYINT(1) DEFAULT 0 AFTER `bio`;

CREATE TABLE IF NOT EXISTS `phone_snap_likes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `post_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`post_id`) REFERENCES `phone_snap_posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_snap_post_account` (`post_id`, `account_id`),
    KEY `idx_snap_likes_account` (`account_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_user_blocks` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(64) NOT NULL,
    `target_identifier` VARCHAR(64) DEFAULT NULL,
    `target_phone` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(120) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_block_pair` (`identifier`, `target_phone`),
    KEY `idx_blocks_identifier` (`identifier`),
    KEY `idx_blocks_target_phone` (`target_phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_user_reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(64) NOT NULL,
    `target_identifier` VARCHAR(64) DEFAULT NULL,
    `target_phone` VARCHAR(20) DEFAULT NULL,
    `app_id` VARCHAR(24) NOT NULL,
    `evidence` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_reports_identifier` (`identifier`),
    KEY `idx_reports_target_phone` (`target_phone`),
    KEY `idx_reports_app` (`app_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_wallet_requests` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `requester_identifier` VARCHAR(64) NOT NULL,
    `requester_phone` VARCHAR(20) NOT NULL,
    `target_identifier` VARCHAR(64) NOT NULL,
    `target_phone` VARCHAR(20) NOT NULL,
    `amount` DECIMAL(12,2) NOT NULL,
    `title` VARCHAR(64) DEFAULT NULL,
    `method` ENUM('qr','nfc') NOT NULL DEFAULT 'qr',
    `status` ENUM('pending','accepted','declined','expired','cancelled') NOT NULL DEFAULT 'pending',
    `expires_at` TIMESTAMP NOT NULL,
    `responded_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_wallet_requests_target` (`target_identifier`, `status`, `expires_at`),
    KEY `idx_wallet_requests_requester` (`requester_identifier`, `status`),
    KEY `idx_wallet_requests_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_mail_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `alias` VARCHAR(32) NOT NULL,
    `domain` VARCHAR(64) NOT NULL,
    `email` VARCHAR(128) NOT NULL,
    `password_hash` CHAR(64) NOT NULL,
    `is_primary` TINYINT(1) DEFAULT 1,
    `last_login_at` TIMESTAMP NULL DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_mail_email` (`email`),
    UNIQUE KEY `uniq_mail_identifier_alias` (`identifier`, `alias`),
    KEY `idx_mail_accounts_identifier` (`identifier`),
    KEY `idx_mail_accounts_domain` (`domain`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_mail_boxes` (
    `account_id` INT PRIMARY KEY,
    `unread_count` INT NOT NULL DEFAULT 0,
    `total_count` INT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_mail_boxes_account`
        FOREIGN KEY (`account_id`) REFERENCES `phone_mail_accounts`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_mail_messages` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `sender_account_id` INT NOT NULL,
    `recipient_email` VARCHAR(128) NOT NULL,
    `recipient_account_id` INT DEFAULT NULL,
    `subject` VARCHAR(120) DEFAULT NULL,
    `body` TEXT NOT NULL,
    `attachments` LONGTEXT DEFAULT NULL,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `is_deleted_sender` TINYINT(1) NOT NULL DEFAULT 0,
    `is_deleted_recipient` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_mail_messages_sender` (`sender_account_id`, `created_at`),
    KEY `idx_mail_messages_recipient` (`recipient_account_id`, `created_at`),
    KEY `idx_mail_messages_recipient_email` (`recipient_email`),
    CONSTRAINT `fk_mail_messages_sender`
        FOREIGN KEY (`sender_account_id`) REFERENCES `phone_mail_accounts`(`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_mail_messages_recipient`
        FOREIGN KEY (`recipient_account_id`) REFERENCES `phone_mail_accounts`(`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_clips_accounts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `username` VARCHAR(32) NOT NULL,
    `display_name` VARCHAR(50) DEFAULT NULL,
    `avatar` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_clips_identifier` (`identifier`),
    UNIQUE KEY `uniq_clips_username` (`username`),
    KEY `idx_clips_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_notifications` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `app_id` VARCHAR(40) NOT NULL,
    `title` VARCHAR(80) NOT NULL,
    `content` VARCHAR(255) NOT NULL,
    `avatar` VARCHAR(500) DEFAULT NULL,
    `meta` LONGTEXT DEFAULT NULL,
    `is_read` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_notifications_identifier` (`identifier`, `created_at`),
    KEY `idx_notifications_unread` (`identifier`, `is_read`, `created_at`),
    KEY `idx_notifications_app` (`identifier`, `app_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `phone_yellowpages_contacts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `listing_id` INT NOT NULL,
    `buyer_identifier` VARCHAR(50) NOT NULL,
    `seller_identifier` VARCHAR(50) NOT NULL,
    `contact_type` ENUM('call', 'message') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`listing_id`) REFERENCES `phone_market`(`id`) ON DELETE CASCADE,
    KEY `idx_buyer` (`buyer_identifier`),
    KEY `idx_seller` (`seller_identifier`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `phone_documents`
    ADD COLUMN IF NOT EXISTS `nfc_enabled` TINYINT(1) DEFAULT 0 AFTER `verification_code`;

CREATE TABLE IF NOT EXISTS `phone_documents_nfc_scans` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `document_id` INT NOT NULL,
    `scanned_by` VARCHAR(50) NOT NULL,
    `scan_type` ENUM('nfc', 'manual') DEFAULT 'manual',
    `scanned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`document_id`) REFERENCES `phone_documents`(`id`) ON DELETE CASCADE,
    KEY `idx_scanned_by` (`scanned_by`),
    KEY `idx_scanned_at` (`scanned_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
