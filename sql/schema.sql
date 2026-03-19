-- ============================================================
-- gcphone-next — COMPLETE DATABASE SCHEMA REFERENCE (post-V20)
-- Compatible with MariaDB 10.5+ / MySQL 8.0+
-- ============================================================
--
-- REFERENCE ONLY — This file is NOT executed by the migration
-- system.  All schema changes are applied automatically by the
-- Lua auto-migration runner in server/modules/database.lua.
--
-- This file reflects the FINAL state of every table, trigger,
-- stored procedure, event, and generated column after all
-- migrations (V1 through V20) have been applied.
--
-- Generated: 2026-03-19
-- ============================================================

-- ============================================================
-- MIGRATION TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS `phone_migrations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `version` INT NOT NULL UNIQUE,
    `name` VARCHAR(64) NOT NULL,
    `description` VARCHAR(255) DEFAULT NULL,
    `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `execution_time_ms` INT DEFAULT 0,
    KEY `idx_version` (`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Phone numbers, settings, and metadata (V1 + V11 + V13 + V14 + V16 + V18)
CREATE TABLE IF NOT EXISTS `phone_numbers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL UNIQUE,
    `imei` VARCHAR(20) NULL DEFAULT NULL UNIQUE,
    `wallpaper` VARCHAR(255) DEFAULT './img/background/back001.jpg',
    `ringtone` VARCHAR(50) DEFAULT 'call_1',
    `call_ringtone` VARCHAR(64) DEFAULT 'call_1',
    `notification_tone` VARCHAR(64) DEFAULT 'notif_1',
    `message_tone` VARCHAR(64) DEFAULT 'msg_1',
    `volume` FLOAT DEFAULT 0.5,
    `lock_code` VARCHAR(10) DEFAULT '0000',
    `pin_hash` CHAR(64) NULL,
    `is_setup` TINYINT(1) NOT NULL DEFAULT 1,
    `theme` VARCHAR(10) DEFAULT 'light',
    `language` VARCHAR(8) DEFAULT 'es',
    `audio_profile` VARCHAR(16) DEFAULT 'normal',
    `is_stolen` TINYINT(1) NOT NULL DEFAULT 0,
    `stolen_at` TIMESTAMP NULL DEFAULT NULL,
    `stolen_reason` VARCHAR(255) DEFAULT NULL,
    `stolen_reporter` VARCHAR(80) DEFAULT NULL,
    `clips_username` VARCHAR(32) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_identifier` (`identifier`),
    UNIQUE KEY `idx_phone_number` (`phone_number`),
    UNIQUE KEY `idx_phone_numbers_clips_username` (`clips_username`),
    KEY `idx_phone_numbers_stolen_imei` (`imei`, `is_stolen`),
    KEY `idx_phone_numbers_stolen_number` (`phone_number`, `is_stolen`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- IMEI auto-generation sequence (V18)
CREATE TABLE IF NOT EXISTS `phone_imei_sequence` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed IMEI sequence from existing data
INSERT INTO `phone_imei_sequence` (`id`)
SELECT MAX(CAST(`imei` AS UNSIGNED))
FROM `phone_numbers`
WHERE `imei` REGEXP '^[0-9]{15}$'
HAVING MAX(CAST(`imei` AS UNSIGNED)) IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM `phone_imei_sequence`
  );

-- Contacts (V1)
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

-- ============================================================
-- MESSAGING (WaveChat)
-- ============================================================

-- Direct messages (V1)
CREATE TABLE IF NOT EXISTS `phone_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `transmitter` VARCHAR(15) NOT NULL,
    `receiver` VARCHAR(15) NOT NULL,
    `message` TEXT NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `is_read` TINYINT(1) DEFAULT 0,
    `owner` TINYINT(1) DEFAULT 0,
    `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_transmitter` (`transmitter`),
    KEY `idx_receiver` (`receiver`),
    KEY `idx_time` (`time`),
    KEY `idx_messages_transmitter_receiver` (`transmitter`, `receiver`),
    KEY `idx_phone_messages_time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat groups (V1)
CREATE TABLE IF NOT EXISTS `phone_chat_groups` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `owner_identifier` VARCHAR(50) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `avatar` VARCHAR(255) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_owner_identifier` (`owner_identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat group members (V1)
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

-- Chat group invites (V1 + V15)
CREATE TABLE IF NOT EXISTS `phone_chat_group_invites` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `group_id` INT NOT NULL,
    `inviter_identifier` VARCHAR(50) NOT NULL,
    `target_identifier` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'accepted', 'declined') NOT NULL DEFAULT 'pending',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `responded_at` TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (`group_id`) REFERENCES `phone_chat_groups`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uniq_group_target_pending` (`group_id`, `target_identifier`),
    KEY `idx_group_invites_target` (`target_identifier`, `status`, `created_at`),
    KEY `idx_group_invites_group` (`group_id`, `status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chat group messages (V1)
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
    KEY `idx_created_at` (`created_at`),
    KEY `idx_group_messages_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WaveChat statuses (V1)
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

-- ============================================================
-- CALLS
-- ============================================================

-- Call history (V1)
CREATE TABLE IF NOT EXISTS `phone_calls` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `owner` VARCHAR(15) NOT NULL,
    `num` VARCHAR(15) NOT NULL,
    `incoming` TINYINT(1) NOT NULL,
    `accepts` TINYINT(1) NOT NULL,
    `duration` INT DEFAULT 0,
    `hidden` TINYINT(1) DEFAULT 0,
    `time` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_owner` (`owner`),
    KEY `idx_num` (`num`),
    KEY `idx_time` (`time`),
    KEY `idx_calls_owner_time` (`owner`, `time`),
    KEY `idx_phone_calls_time` (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- GALLERY
-- ============================================================

-- Photos and videos (V1)
CREATE TABLE IF NOT EXISTS `phone_gallery` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `type` ENUM('image', 'video') DEFAULT 'image',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- HOME SCREEN LAYOUTS
-- ============================================================

-- Home screen layout storage (V1)
CREATE TABLE IF NOT EXISTS `phone_layouts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `layout_json` LONGTEXT NOT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CHIRP (Twitter-like)
-- ============================================================

-- Chirp accounts (V1 + V9)
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

-- Chirp tweets (V1 + V6)
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
    KEY `idx_created` (`created_at`),
    KEY `idx_chirp_tweets_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp likes (V1)
CREATE TABLE IF NOT EXISTS `phone_chirp_likes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tweet_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_tweet_account` (`tweet_id`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp following relationships (V1)
CREATE TABLE IF NOT EXISTS `phone_chirp_following` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `follower_id` INT NOT NULL,
    `following_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`follower_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`following_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_follow` (`follower_id`, `following_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp comments (V6)
CREATE TABLE IF NOT EXISTS `phone_chirp_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `tweet_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_tweet_id` (`tweet_id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_chirp_comments_tweet` (`tweet_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Chirp rechirps (V6 + V17)
CREATE TABLE IF NOT EXISTS `phone_chirp_rechirps` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `original_tweet_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `content` VARCHAR(280) DEFAULT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`original_tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_unique_rechirp` (`original_tweet_id`, `account_id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_chirp_rechirps_original` (`original_tweet_id`, `created_at`),
    KEY `idx_chirp_rechirps_account` (`account_id`, `created_at`),
    KEY `idx_chirp_rechirps_created_content` (`created_at`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SNAP (Instagram-like)
-- ============================================================

-- Snap accounts (V1)
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

-- Snap posts (V1)
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
    KEY `idx_created` (`created_at`),
    KEY `idx_snap_posts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Snap stories (V1)
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
    KEY `idx_expires` (`expires_at`),
    KEY `idx_snap_stories_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CLIPS (TikTok-like)
-- ============================================================

-- Clips accounts (V11)
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

-- Clips posts (V1 + V20)
CREATE TABLE IF NOT EXISTS `phone_clips_posts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `account_id` INT NOT NULL,
    `media_url` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(500) DEFAULT NULL,
    `likes` INT DEFAULT 0,
    `comments_count` INT DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_account` (`account_id`),
    KEY `idx_created` (`created_at`),
    KEY `idx_clips_posts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clips likes (V7)
CREATE TABLE IF NOT EXISTS `phone_clips_likes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clip_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`clip_id`) REFERENCES `phone_clips_posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `idx_unique_clip_like` (`clip_id`, `account_id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_clips_likes_clip` (`clip_id`, `account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clips comments (V7)
CREATE TABLE IF NOT EXISTS `phone_clips_comments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `clip_id` INT NOT NULL,
    `account_id` INT NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`clip_id`) REFERENCES `phone_clips_posts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
    KEY `idx_clip_id` (`clip_id`),
    KEY `idx_account_id` (`account_id`),
    KEY `idx_created_at` (`created_at`),
    KEY `idx_clips_comments_clip` (`clip_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- SOCIAL: FRIEND REQUESTS & NOTIFICATIONS
-- ============================================================

-- Friend/follow requests (V1 + V9)
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
    UNIQUE KEY `idx_request` (`from_identifier`, `to_identifier`, `type`),
    KEY `idx_friend_requests_to_type_status` (`to_identifier`, `type`, `status`),
    KEY `idx_friend_requests_from_type_status` (`from_identifier`, `type`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Social notifications (V9)
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

-- Persistent notification inbox (V12)
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

-- ============================================================
-- DARK ROOMS (Anonymous forums)
-- ============================================================

-- Dark Rooms: rooms (V2)
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

-- Dark Rooms: members (V2)
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

-- Dark Rooms: posts (V2)
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
    KEY `idx_created` (`created_at`),
    KEY `idx_darkrooms_posts_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dark Rooms: votes (V2)
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

-- Dark Rooms: comments (V2)
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
    KEY `idx_created` (`created_at`),
    KEY `idx_darkrooms_comments_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- WALLET & DOCUMENTS
-- ============================================================

-- Wallet balances (V3)
CREATE TABLE IF NOT EXISTS `phone_wallets` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL UNIQUE,
    `balance` DECIMAL(12,2) DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY `idx_wallet_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet cards (V3)
CREATE TABLE IF NOT EXISTS `phone_wallet_cards` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `label` VARCHAR(32) NOT NULL,
    `last4` CHAR(4) NOT NULL,
    `color` VARCHAR(20) DEFAULT '#2E3B57',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_wallet_cards_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Wallet transactions (V3)
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

-- Documents (V3 + V8)
CREATE TABLE IF NOT EXISTS `phone_documents` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `doc_type` VARCHAR(24) NOT NULL,
    `title` VARCHAR(64) NOT NULL,
    `holder_name` VARCHAR(64) NOT NULL,
    `holder_number` VARCHAR(20) DEFAULT NULL,
    `expires_at` VARCHAR(24) DEFAULT NULL,
    `verification_code` VARCHAR(20) NOT NULL,
    `nfc_enabled` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_documents_identifier` (`identifier`),
    KEY `idx_documents_type` (`doc_type`),
    KEY `idx_documents_code` (`verification_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documents NFC scans (V8)
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

-- ============================================================
-- GARAGE
-- ============================================================

-- Garage vehicles (V1)
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

-- Garage vehicle locations (V8)
CREATE TABLE IF NOT EXISTS `phone_garage_locations` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `plate` VARCHAR(10) NOT NULL,
    `location_x` FLOAT NOT NULL,
    `location_y` FLOAT NOT NULL,
    `location_z` FLOAT NOT NULL,
    `location_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `idx_garage_loc` (`identifier`, `plate`),
    KEY `idx_updated` (`location_updated`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Garage vehicle location history (V8)
CREATE TABLE IF NOT EXISTS `phone_garage_location_history` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `plate` VARCHAR(10) NOT NULL,
    `location_x` FLOAT NOT NULL,
    `location_y` FLOAT NOT NULL,
    `location_z` FLOAT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_garage_hist` (`identifier`, `plate`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- YELLOW PAGES / MARKETPLACE
-- ============================================================

-- Market listings (V1 + V8)
CREATE TABLE IF NOT EXISTS `phone_market` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `phone_number` VARCHAR(15) NOT NULL,
    `seller_name` VARCHAR(100) DEFAULT NULL,
    `seller_avatar` VARCHAR(255) DEFAULT NULL,
    `location_shared` TINYINT(1) DEFAULT 0,
    `location_x` FLOAT DEFAULT NULL,
    `location_y` FLOAT DEFAULT NULL,
    `location_z` FLOAT DEFAULT NULL,
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
    KEY `idx_expires` (`expires_at`),
    KEY `idx_market_created` (`created_at`),
    KEY `idx_market_seller` (`identifier`, `created_at`),
    KEY `idx_market_location` (`location_shared`, `location_x`, `location_y`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- YellowPages contact history (V8)
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

-- ============================================================
-- NEWS
-- ============================================================

-- News articles (V1)
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
    KEY `idx_created` (`created_at`),
    KEY `idx_phone_news_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- NOTES
-- ============================================================

-- Notes (V1)
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

-- ============================================================
-- ALARMS
-- ============================================================

-- Alarms (V1)
CREATE TABLE IF NOT EXISTS `phone_alarms` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(50) NOT NULL,
    `time` TIME NOT NULL,
    `label` VARCHAR(100) DEFAULT NULL,
    `enabled` TINYINT(1) DEFAULT 1,
    `days` JSON DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_identifier` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MAPS & LOCATION SHARING
-- ============================================================

-- Shared locations (V1)
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
    KEY `idx_expires` (`expires_at`),
    KEY `idx_shared_locations_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Live locations (V1)
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
    KEY `idx_expires` (`expires_at`),
    KEY `idx_live_locations_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- PHONE DROP SYSTEM
-- ============================================================

-- Dropped phones (V1)
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
-- MAIL
-- ============================================================

-- Mail accounts (V10)
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

-- Mail boxes (counter cache) (V10)
CREATE TABLE IF NOT EXISTS `phone_mail_boxes` (
    `account_id` INT PRIMARY KEY,
    `unread_count` INT NOT NULL DEFAULT 0,
    `total_count` INT NOT NULL DEFAULT 0,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT `fk_mail_boxes_account`
        FOREIGN KEY (`account_id`) REFERENCES `phone_mail_accounts`(`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mail messages (V10)
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

-- ============================================================
-- SERVICES (Worker directory) — V19
-- ============================================================

-- Service workers (V19 + V20 generated column)
CREATE TABLE IF NOT EXISTS `phone_services` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(64) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `display_name` VARCHAR(60) NOT NULL,
    `avatar` VARCHAR(500) DEFAULT NULL,
    `category` VARCHAR(30) NOT NULL DEFAULT 'other',
    `description` VARCHAR(500) DEFAULT NULL,
    `availability` ENUM('online','offline','busy') NOT NULL DEFAULT 'offline',
    `rating_sum` INT NOT NULL DEFAULT 0,
    `rating_count` INT NOT NULL DEFAULT 0,
    `rating` FLOAT GENERATED ALWAYS AS (IF(`rating_count` > 0, ROUND(`rating_sum` / `rating_count`, 1), 0)) VIRTUAL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_services_identifier` (`identifier`),
    KEY `idx_services_category` (`category`, `is_active`),
    KEY `idx_services_availability` (`availability`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Service ratings (V19)
CREATE TABLE IF NOT EXISTS `phone_services_ratings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `service_id` INT NOT NULL,
    `rater_identifier` VARCHAR(64) NOT NULL,
    `score` TINYINT NOT NULL,
    `comment` VARCHAR(200) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_service_rater` (`service_id`, `rater_identifier`),
    KEY `idx_ratings_service` (`service_id`),
    CONSTRAINT `fk_ratings_service` FOREIGN KEY (`service_id`) REFERENCES `phone_services` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MATCHMYLOVE (Dating) — V19
-- ============================================================

-- Dating profiles (V19)
CREATE TABLE IF NOT EXISTS `phone_matchmylove_profiles` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(64) NOT NULL,
    `display_name` VARCHAR(30) NOT NULL,
    `age` TINYINT UNSIGNED NOT NULL DEFAULT 21,
    `bio` VARCHAR(500) DEFAULT NULL,
    `avatar` VARCHAR(500) DEFAULT NULL,
    `photos` JSON DEFAULT NULL,
    `interests` JSON DEFAULT NULL,
    `gender` ENUM('male','female','other') NOT NULL DEFAULT 'other',
    `looking_for` ENUM('male','female','everyone') NOT NULL DEFAULT 'everyone',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_matchmylove_identifier` (`identifier`),
    KEY `idx_matchmylove_active` (`is_active`, `gender`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Swipes (V19)
CREATE TABLE IF NOT EXISTS `phone_matchmylove_swipes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `swiper_id` VARCHAR(64) NOT NULL,
    `target_id` VARCHAR(64) NOT NULL,
    `direction` ENUM('left','right') NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_swipe_pair` (`swiper_id`, `target_id`),
    KEY `idx_swipes_target` (`target_id`, `direction`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Matches (V19)
CREATE TABLE IF NOT EXISTS `phone_matchmylove_matches` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `profile_a_id` VARCHAR(64) NOT NULL,
    `profile_b_id` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_match_pair` (`profile_a_id`, `profile_b_id`),
    KEY `idx_matches_a` (`profile_a_id`),
    KEY `idx_matches_b` (`profile_b_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Match messages (V19)
CREATE TABLE IF NOT EXISTS `phone_matchmylove_messages` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `match_id` INT NOT NULL,
    `sender_id` VARCHAR(64) NOT NULL,
    `content` VARCHAR(500) NOT NULL,
    `media_url` VARCHAR(500) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    KEY `idx_matchmsg_match` (`match_id`, `created_at`),
    CONSTRAINT `fk_matchmsg_match` FOREIGN KEY (`match_id`) REFERENCES `phone_matchmylove_matches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CITYRIDE (Ride-hailing) — V19
-- ============================================================

-- Drivers (V19 + V20 generated column)
CREATE TABLE IF NOT EXISTS `phone_cityride_drivers` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `identifier` VARCHAR(64) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `display_name` VARCHAR(60) NOT NULL,
    `vehicle_name` VARCHAR(50) DEFAULT NULL,
    `vehicle_plate` VARCHAR(10) DEFAULT NULL,
    `is_available` TINYINT(1) NOT NULL DEFAULT 0,
    `rating_sum` INT NOT NULL DEFAULT 0,
    `rating_count` INT NOT NULL DEFAULT 0,
    `rating` FLOAT GENERATED ALWAYS AS (IF(`rating_count` > 0, ROUND(`rating_sum` / `rating_count`, 1), 0)) VIRTUAL,
    `total_rides` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_cityride_identifier` (`identifier`),
    KEY `idx_cityride_available` (`is_available`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Rides (V19)
CREATE TABLE IF NOT EXISTS `phone_cityride_rides` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `passenger_identifier` VARCHAR(64) NOT NULL,
    `passenger_phone` VARCHAR(20) DEFAULT NULL,
    `driver_identifier` VARCHAR(64) DEFAULT NULL,
    `driver_phone` VARCHAR(20) DEFAULT NULL,
    `pickup_x` FLOAT DEFAULT NULL,
    `pickup_y` FLOAT DEFAULT NULL,
    `pickup_z` FLOAT DEFAULT NULL,
    `dest_x` FLOAT DEFAULT NULL,
    `dest_y` FLOAT DEFAULT NULL,
    `dest_z` FLOAT DEFAULT NULL,
    `distance` FLOAT NOT NULL DEFAULT 0,
    `price` INT NOT NULL DEFAULT 0,
    `status` ENUM('requested','accepted','pickup','in_progress','completed','cancelled') NOT NULL DEFAULT 'requested',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `accepted_at` TIMESTAMP NULL DEFAULT NULL,
    `completed_at` TIMESTAMP NULL DEFAULT NULL,
    KEY `idx_cityride_rides_passenger` (`passenger_identifier`, `status`),
    KEY `idx_cityride_rides_driver` (`driver_identifier`, `status`),
    KEY `idx_cityride_rides_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ride ratings (V19)
CREATE TABLE IF NOT EXISTS `phone_cityride_ratings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `ride_id` INT NOT NULL,
    `rater_identifier` VARCHAR(64) NOT NULL,
    `driver_identifier` VARCHAR(64) NOT NULL,
    `score` TINYINT NOT NULL,
    `comment` VARCHAR(200) DEFAULT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uniq_cityride_rating` (`ride_id`, `rater_identifier`),
    KEY `idx_cityride_ratings_driver` (`driver_identifier`),
    CONSTRAINT `fk_cityride_rating_ride` FOREIGN KEY (`ride_id`) REFERENCES `phone_cityride_rides` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CLEANUP SYSTEM (V4)
-- ============================================================

-- Cleanup rules table (V4)
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

-- ============================================================
-- STORED PROCEDURES (V4)
-- ============================================================

DELIMITER $$

-- Add or update a cleanup rule
CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_cleanup_add_rule`(
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

-- Seed all default cleanup rules (V4 + V10 + V12 + V15 + V20)
CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_cleanup_seed_defaults`()
BEGIN
    -- Expiry-based cleanup
    CALL sp_gcphone_cleanup_add_rule('live_locations_expired', 'delete', 'phone_live_locations', NULL, 'expires_at < NOW()', 1);
    CALL sp_gcphone_cleanup_add_rule('shared_locations_expired', 'delete', 'phone_shared_locations', NULL, 'expires_at IS NOT NULL AND expires_at < NOW()', 1);
    CALL sp_gcphone_cleanup_add_rule('snap_stories_expired', 'delete', 'phone_snap_stories', NULL, 'expires_at < NOW() OR created_at < (NOW() - INTERVAL 7 DAY)', 5);
    CALL sp_gcphone_cleanup_add_rule('wavechat_statuses_expired', 'delete', 'phone_wavechat_statuses', NULL, 'expires_at < NOW()', 15);

    -- Retention-based cleanup (7 days)
    CALL sp_gcphone_cleanup_add_rule('retention_messages', 'delete', 'phone_messages', NULL, '`time` < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_group_messages', 'delete', 'phone_chat_group_messages', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_calls', 'delete', 'phone_calls', NULL, '`time` < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_chirp_tweets', 'delete', 'phone_chirp_tweets', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_snap_posts', 'delete', 'phone_snap_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_clips_posts', 'delete', 'phone_clips_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_darkrooms_posts', 'delete', 'phone_darkrooms_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
    CALL sp_gcphone_cleanup_add_rule('retention_darkrooms_comments', 'delete', 'phone_darkrooms_comments', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);

    -- Retention-based cleanup (10 days)
    CALL sp_gcphone_cleanup_add_rule('retention_news', 'delete', 'phone_news', NULL, 'is_live = 0 AND created_at < (NOW() - INTERVAL 10 DAY)', 30);

    -- Retention-based cleanup (14 days)
    CALL sp_gcphone_cleanup_add_rule('retention_group_invites', 'delete', 'phone_chat_group_invites', NULL, '(status != ''pending'' AND created_at < (NOW() - INTERVAL 14 DAY)) OR created_at < (NOW() - INTERVAL 30 DAY)', 120);
    CALL sp_gcphone_cleanup_add_rule('retention_cityride_rides', 'delete', 'phone_cityride_rides', NULL, 'completed_at IS NOT NULL AND completed_at < (NOW() - INTERVAL 14 DAY)', 60);
    CALL sp_gcphone_cleanup_add_rule('retention_matchmylove_messages', 'delete', 'phone_matchmylove_messages', NULL, 'created_at < (NOW() - INTERVAL 14 DAY)', 30);

    -- Retention-based cleanup (45 days)
    CALL sp_gcphone_cleanup_add_rule('retention_notifications', 'delete', 'phone_notifications', NULL, 'created_at < (NOW() - INTERVAL 45 DAY)', 60);

    -- Retention-based cleanup (90 days)
    CALL sp_gcphone_cleanup_add_rule('retention_mail_messages', 'delete', 'phone_mail_messages', NULL, 'created_at < (NOW() - INTERVAL 90 DAY)', 60);
    CALL sp_gcphone_cleanup_add_rule('retention_services_ratings', 'delete', 'phone_services_ratings', NULL, 'created_at < (NOW() - INTERVAL 90 DAY)', 120);
END$$

-- Cleanup runner — iterates due rules, builds and executes SQL (V4)
CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_run_cleanup`()
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

-- Seed default cleanup rules
CALL `sp_gcphone_cleanup_seed_defaults`();

-- ============================================================
-- MYSQL EVENT SCHEDULER (V4)
-- ============================================================

-- Runs sp_gcphone_run_cleanup every minute
DROP EVENT IF EXISTS `ev_gcphone_cleanup_runner`;
CREATE EVENT `ev_gcphone_cleanup_runner`
    ON SCHEDULE EVERY 1 MINUTE
    DO
        CALL `sp_gcphone_run_cleanup`();

-- ============================================================
-- TRIGGERS
-- ============================================================

DELIMITER $$

-- -----------------------------------------------------------
-- IMEI auto-generation (V18)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_numbers_before_insert_imei`$$
CREATE TRIGGER `trg_phone_numbers_before_insert_imei`
    BEFORE INSERT ON `phone_numbers`
    FOR EACH ROW
    BEGIN
        IF NEW.`imei` IS NULL OR NEW.`imei` = '' OR NEW.`imei` NOT REGEXP '^[0-9]{15}$' THEN
            INSERT INTO `phone_imei_sequence` VALUES (NULL);
            SET NEW.`imei` = LPAD(LAST_INSERT_ID(), 15, '0');
        END IF;
    END$$

DROP TRIGGER IF EXISTS `trg_phone_numbers_before_update_imei`$$
CREATE TRIGGER `trg_phone_numbers_before_update_imei`
    BEFORE UPDATE ON `phone_numbers`
    FOR EACH ROW
    BEGIN
        IF NEW.`imei` IS NULL OR NEW.`imei` = '' OR NEW.`imei` NOT REGEXP '^[0-9]{15}$' THEN
            INSERT INTO `phone_imei_sequence` VALUES (NULL);
            SET NEW.`imei` = LPAD(LAST_INSERT_ID(), 15, '0');
        END IF;
    END$$

-- -----------------------------------------------------------
-- Chirp: likes counter (V5)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_insert`$$
CREATE TRIGGER `trg_phone_chirp_likes_after_insert`
    AFTER INSERT ON `phone_chirp_likes`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = NEW.`tweet_id`)
    WHERE `id` = NEW.`tweet_id`$$

DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_delete`$$
CREATE TRIGGER `trg_phone_chirp_likes_after_delete`
    AFTER DELETE ON `phone_chirp_likes`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = OLD.`tweet_id`)
    WHERE `id` = OLD.`tweet_id`$$

-- -----------------------------------------------------------
-- Chirp: following counter (V5)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_insert`$$
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

DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_delete`$$
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

-- -----------------------------------------------------------
-- Chirp: replies counter (V6)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_chirp_comments_after_insert`$$
CREATE TRIGGER `trg_phone_chirp_comments_after_insert`
    AFTER INSERT ON `phone_chirp_comments`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `replies` = (SELECT COUNT(*) FROM `phone_chirp_comments` WHERE `tweet_id` = NEW.`tweet_id`)
    WHERE `id` = NEW.`tweet_id`$$

DROP TRIGGER IF EXISTS `trg_phone_chirp_comments_after_delete`$$
CREATE TRIGGER `trg_phone_chirp_comments_after_delete`
    AFTER DELETE ON `phone_chirp_comments`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `replies` = (SELECT COUNT(*) FROM `phone_chirp_comments` WHERE `tweet_id` = OLD.`tweet_id`)
    WHERE `id` = OLD.`tweet_id`$$

-- -----------------------------------------------------------
-- Chirp: rechirps counter (V6)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_chirp_rechirps_after_insert`$$
CREATE TRIGGER `trg_phone_chirp_rechirps_after_insert`
    AFTER INSERT ON `phone_chirp_rechirps`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `rechirps` = (SELECT COUNT(*) FROM `phone_chirp_rechirps` WHERE `original_tweet_id` = NEW.`original_tweet_id`)
    WHERE `id` = NEW.`original_tweet_id`$$

DROP TRIGGER IF EXISTS `trg_phone_chirp_rechirps_after_delete`$$
CREATE TRIGGER `trg_phone_chirp_rechirps_after_delete`
    AFTER DELETE ON `phone_chirp_rechirps`
    FOR EACH ROW
    UPDATE `phone_chirp_tweets`
    SET `rechirps` = (SELECT COUNT(*) FROM `phone_chirp_rechirps` WHERE `original_tweet_id` = OLD.`original_tweet_id`)
    WHERE `id` = OLD.`original_tweet_id`$$

-- -----------------------------------------------------------
-- Snap: posts counter (V5)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_insert`$$
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

DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_delete`$$
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

-- -----------------------------------------------------------
-- Clips: likes counter (V7)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_phone_clips_likes_after_insert`$$
CREATE TRIGGER `trg_phone_clips_likes_after_insert`
    AFTER INSERT ON `phone_clips_likes`
    FOR EACH ROW
    UPDATE `phone_clips_posts`
    SET `likes` = (SELECT COUNT(*) FROM `phone_clips_likes` WHERE `clip_id` = NEW.`clip_id`)
    WHERE `id` = NEW.`clip_id`$$

DROP TRIGGER IF EXISTS `trg_phone_clips_likes_after_delete`$$
CREATE TRIGGER `trg_phone_clips_likes_after_delete`
    AFTER DELETE ON `phone_clips_likes`
    FOR EACH ROW
    UPDATE `phone_clips_posts`
    SET `likes` = (SELECT COUNT(*) FROM `phone_clips_likes` WHERE `clip_id` = OLD.`clip_id`)
    WHERE `id` = OLD.`clip_id`$$

-- -----------------------------------------------------------
-- Clips: comments_count counter (V20)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_clips_comments_ai`$$
CREATE TRIGGER `trg_clips_comments_ai`
    AFTER INSERT ON `phone_clips_comments`
    FOR EACH ROW
    UPDATE `phone_clips_posts`
    SET `comments_count` = `comments_count` + 1
    WHERE `id` = NEW.`clip_id`$$

DROP TRIGGER IF EXISTS `trg_clips_comments_ad`$$
CREATE TRIGGER `trg_clips_comments_ad`
    AFTER DELETE ON `phone_clips_comments`
    FOR EACH ROW
    UPDATE `phone_clips_posts`
    SET `comments_count` = GREATEST(`comments_count` - 1, 0)
    WHERE `id` = OLD.`clip_id`$$

-- -----------------------------------------------------------
-- Mail: account auto-mailbox, recipient normalization,
--       unread/total counters (V10)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `tr_mail_accounts_after_insert`$$
CREATE TRIGGER `tr_mail_accounts_after_insert`
    AFTER INSERT ON `phone_mail_accounts`
    FOR EACH ROW
    INSERT IGNORE INTO `phone_mail_boxes` (`account_id`, `unread_count`, `total_count`)
    VALUES (NEW.`id`, 0, 0)$$

DROP TRIGGER IF EXISTS `tr_mail_messages_before_insert`$$
CREATE TRIGGER `tr_mail_messages_before_insert`
    BEFORE INSERT ON `phone_mail_messages`
    FOR EACH ROW
    SET NEW.`recipient_email` = LOWER(TRIM(NEW.`recipient_email`))$$

DROP TRIGGER IF EXISTS `tr_mail_messages_after_insert`$$
CREATE TRIGGER `tr_mail_messages_after_insert`
    AFTER INSERT ON `phone_mail_messages`
    FOR EACH ROW
    UPDATE `phone_mail_boxes`
    SET `total_count` = `total_count` + 1,
        `unread_count` = `unread_count` + IF(NEW.`is_read` = 1, 0, 1),
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `account_id` = NEW.`recipient_account_id`$$

DROP TRIGGER IF EXISTS `tr_mail_messages_after_update`$$
CREATE TRIGGER `tr_mail_messages_after_update`
    AFTER UPDATE ON `phone_mail_messages`
    FOR EACH ROW
    UPDATE `phone_mail_boxes`
    SET `unread_count` = GREATEST(`unread_count` - 1, 0),
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `account_id` = NEW.`recipient_account_id`
      AND OLD.`is_read` = 0
      AND NEW.`is_read` = 1$$

DROP TRIGGER IF EXISTS `tr_mail_messages_after_delete`$$
CREATE TRIGGER `tr_mail_messages_after_delete`
    AFTER DELETE ON `phone_mail_messages`
    FOR EACH ROW
    UPDATE `phone_mail_boxes`
    SET `total_count` = GREATEST(`total_count` - 1, 0),
        `unread_count` = GREATEST(`unread_count` - IF(OLD.`is_read` = 0, 1, 0), 0),
        `updated_at` = CURRENT_TIMESTAMP
    WHERE `account_id` = OLD.`recipient_account_id`$$

-- -----------------------------------------------------------
-- DarkRooms: comments_count counter (V20)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_darkrooms_comments_ai`$$
CREATE TRIGGER `trg_darkrooms_comments_ai`
    AFTER INSERT ON `phone_darkrooms_comments`
    FOR EACH ROW
    UPDATE `phone_darkrooms_posts`
    SET `comments_count` = `comments_count` + 1
    WHERE `id` = NEW.`post_id`$$

DROP TRIGGER IF EXISTS `trg_darkrooms_comments_ad`$$
CREATE TRIGGER `trg_darkrooms_comments_ad`
    AFTER DELETE ON `phone_darkrooms_comments`
    FOR EACH ROW
    UPDATE `phone_darkrooms_posts`
    SET `comments_count` = GREATEST(`comments_count` - 1, 0)
    WHERE `id` = OLD.`post_id`$$

-- -----------------------------------------------------------
-- DarkRooms: vote score counters (V20)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_darkrooms_votes_ai`$$
CREATE TRIGGER `trg_darkrooms_votes_ai`
    AFTER INSERT ON `phone_darkrooms_votes`
    FOR EACH ROW
    UPDATE `phone_darkrooms_posts`
    SET `score` = `score` + NEW.`value`
    WHERE `id` = NEW.`post_id`$$

DROP TRIGGER IF EXISTS `trg_darkrooms_votes_au`$$
CREATE TRIGGER `trg_darkrooms_votes_au`
    AFTER UPDATE ON `phone_darkrooms_votes`
    FOR EACH ROW
    UPDATE `phone_darkrooms_posts`
    SET `score` = `score` + (NEW.`value` - OLD.`value`)
    WHERE `id` = NEW.`post_id`$$

DROP TRIGGER IF EXISTS `trg_darkrooms_votes_ad`$$
CREATE TRIGGER `trg_darkrooms_votes_ad`
    AFTER DELETE ON `phone_darkrooms_votes`
    FOR EACH ROW
    UPDATE `phone_darkrooms_posts`
    SET `score` = `score` - OLD.`value`
    WHERE `id` = OLD.`post_id`$$

-- -----------------------------------------------------------
-- CityRide: rating counter (V20)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_cityride_ratings_ai`$$
CREATE TRIGGER `trg_cityride_ratings_ai`
    AFTER INSERT ON `phone_cityride_ratings`
    FOR EACH ROW
    UPDATE `phone_cityride_drivers`
    SET `rating_sum` = `rating_sum` + NEW.`score`,
        `rating_count` = `rating_count` + 1
    WHERE `identifier` = NEW.`driver_identifier`$$

-- -----------------------------------------------------------
-- Services: rating counters (V20)
-- -----------------------------------------------------------

DROP TRIGGER IF EXISTS `trg_services_ratings_ai`$$
CREATE TRIGGER `trg_services_ratings_ai`
    AFTER INSERT ON `phone_services_ratings`
    FOR EACH ROW
    UPDATE `phone_services`
    SET `rating_sum` = `rating_sum` + NEW.`score`,
        `rating_count` = `rating_count` + 1
    WHERE `id` = NEW.`service_id`$$

DROP TRIGGER IF EXISTS `trg_services_ratings_au`$$
CREATE TRIGGER `trg_services_ratings_au`
    AFTER UPDATE ON `phone_services_ratings`
    FOR EACH ROW
    UPDATE `phone_services`
    SET `rating_sum` = `rating_sum` + (NEW.`score` - OLD.`score`)
    WHERE `id` = NEW.`service_id`$$

DROP TRIGGER IF EXISTS `trg_services_ratings_ad`$$
CREATE TRIGGER `trg_services_ratings_ad`
    AFTER DELETE ON `phone_services_ratings`
    FOR EACH ROW
    UPDATE `phone_services`
    SET `rating_sum` = `rating_sum` - OLD.`score`,
        `rating_count` = GREATEST(`rating_count` - 1, 0)
    WHERE `id` = OLD.`service_id`$$

DELIMITER ;

-- ============================================================
-- END OF SCHEMA REFERENCE
-- ============================================================
