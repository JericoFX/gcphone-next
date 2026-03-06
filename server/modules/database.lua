-- gcphone-next Database Auto-Migration System
-- Migrations run automatically on resource start
-- To add new migration: insert entry at end of MIGRATIONS table with incrementing version

local MIGRATIONS = {
    {
        version = 1,
        name = "initial_schema",
        description = "Core tables for gcphone-next",
        statements = {
            -- Core tables
            [[CREATE TABLE IF NOT EXISTS `phone_numbers` (
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
                `language` VARCHAR(8) DEFAULT 'es',
                `audio_profile` VARCHAR(16) DEFAULT 'normal',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `idx_identifier` (`identifier`),
                UNIQUE KEY `idx_phone_number` (`phone_number`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_contacts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `number` VARCHAR(15) NOT NULL,
                `display` VARCHAR(100) NOT NULL,
                `avatar` VARCHAR(255) DEFAULT NULL,
                `favorite` TINYINT(1) DEFAULT 0,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_identifier` (`identifier`),
                KEY `idx_number` (`number`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_messages` (
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
                KEY `idx_time` (`time`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chat_groups` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `owner_identifier` VARCHAR(50) NOT NULL,
                `name` VARCHAR(80) NOT NULL,
                `avatar` VARCHAR(255) DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_owner_identifier` (`owner_identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chat_group_members` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `group_id` INT NOT NULL,
                `identifier` VARCHAR(50) NOT NULL,
                `role` ENUM('owner', 'member') DEFAULT 'member',
                `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`group_id`) REFERENCES `phone_chat_groups`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_group_member` (`group_id`, `identifier`),
                KEY `idx_member_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chat_group_messages` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_calls` (
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
                KEY `idx_time` (`time`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_gallery` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `url` VARCHAR(500) NOT NULL,
                `type` ENUM('image', 'video') DEFAULT 'image',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_layouts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `layout_json` LONGTEXT NOT NULL,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_accounts` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_tweets` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_likes` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tweet_id` INT NOT NULL,
                `account_id` INT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_tweet_account` (`tweet_id`, `account_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_following` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `follower_id` INT NOT NULL,
                `following_id` INT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`follower_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`following_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_follow` (`follower_id`, `following_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_snap_accounts` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_snap_posts` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_snap_stories` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_garage` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_market` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_news` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_clips_posts` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `account_id` INT NOT NULL,
                `media_url` VARCHAR(500) NOT NULL,
                `caption` VARCHAR(500) DEFAULT NULL,
                `likes` INT DEFAULT 0,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                KEY `idx_account` (`account_id`),
                KEY `idx_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_friend_requests` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `from_identifier` VARCHAR(50) NOT NULL,
                `to_identifier` VARCHAR(50) NOT NULL,
                `type` ENUM('chirp', 'snap') NOT NULL,
                `status` ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_from` (`from_identifier`),
                KEY `idx_to` (`to_identifier`),
                UNIQUE KEY `idx_request` (`from_identifier`, `to_identifier`, `type`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_shared_locations` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_dropped` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_live_locations` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_notes` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `title` VARCHAR(100) DEFAULT NULL,
                `content` TEXT NOT NULL,
                `color` VARCHAR(10) DEFAULT '#FFFFFF',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_alarms` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `time` TIME NOT NULL,
                `label` VARCHAR(100) DEFAULT NULL,
                `enabled` TINYINT(1) DEFAULT 1,
                `days` JSON DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Indexes
            [[CREATE INDEX IF NOT EXISTS `idx_messages_transmitter_receiver` ON `phone_messages` (`transmitter`, `receiver`)]],
            [[CREATE INDEX IF NOT EXISTS `idx_calls_owner_time` ON `phone_calls` (`owner`, `time`)]]
        }
    },
    
    {
        version = 2,
        name = "darkrooms_feature",
        description = "Dark Rooms forum-style rooms",
        statements = {
            [[CREATE TABLE IF NOT EXISTS `phone_darkrooms_rooms` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_darkrooms_members` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `room_id` INT NOT NULL,
                `identifier` VARCHAR(50) NOT NULL,
                `role` ENUM('member', 'moderator') DEFAULT 'member',
                `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`room_id`) REFERENCES `phone_darkrooms_rooms`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_room_member` (`room_id`, `identifier`),
                KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_darkrooms_posts` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_darkrooms_votes` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `post_id` INT NOT NULL,
                `identifier` VARCHAR(50) NOT NULL,
                `value` TINYINT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`post_id`) REFERENCES `phone_darkrooms_posts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_post_voter` (`post_id`, `identifier`),
                KEY `idx_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_darkrooms_comments` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Additional indexes
            [[ALTER TABLE `phone_darkrooms_rooms` ADD COLUMN IF NOT EXISTS `password_hash` CHAR(64) DEFAULT NULL AFTER `icon`]],
            [[ALTER TABLE `phone_darkrooms_posts` ADD COLUMN IF NOT EXISTS `media_url` VARCHAR(500) DEFAULT NULL AFTER `content`]],
            [[ALTER TABLE `phone_darkrooms_posts` ADD COLUMN IF NOT EXISTS `is_anonymous` TINYINT(1) DEFAULT 0 AFTER `media_url`]],
            [[ALTER TABLE `phone_darkrooms_comments` ADD COLUMN IF NOT EXISTS `media_url` VARCHAR(500) DEFAULT NULL AFTER `content`]],
            [[ALTER TABLE `phone_darkrooms_comments` ADD COLUMN IF NOT EXISTS `is_anonymous` TINYINT(1) DEFAULT 0 AFTER `media_url`]]
        }
    },
    
    {
        version = 3,
        name = "wallet_and_documents",
        description = "Wallet system and document storage",
        statements = {
            [[CREATE TABLE IF NOT EXISTS `phone_wallets` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL UNIQUE,
                `balance` DECIMAL(12,2) DEFAULT 0,
                `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY `idx_wallet_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_wallet_cards` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `label` VARCHAR(32) NOT NULL,
                `last4` CHAR(4) NOT NULL,
                `color` VARCHAR(20) DEFAULT '#2E3B57',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_wallet_cards_identifier` (`identifier`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_wallet_transactions` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `amount` DECIMAL(12,2) NOT NULL,
                `type` ENUM('in','out','adjust') NOT NULL,
                `title` VARCHAR(64) DEFAULT NULL,
                `target_phone` VARCHAR(15) DEFAULT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_wallet_tx_identifier` (`identifier`),
                KEY `idx_wallet_tx_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_documents` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]]
        }
    },
    
    {
        version = 4,
        name = "sql_events_cleanup",
        description = "SQL-based cleanup system with events",
        statements = {
            -- Indexes for cleanup
            [[ALTER TABLE `phone_live_locations` ADD INDEX IF NOT EXISTS `idx_live_locations_expires` (`expires_at`)]],
            [[ALTER TABLE `phone_shared_locations` ADD INDEX IF NOT EXISTS `idx_shared_locations_expires` (`expires_at`)]],
            [[ALTER TABLE `phone_snap_stories` ADD INDEX IF NOT EXISTS `idx_snap_stories_expires` (`expires_at`)]],
            
            -- Cleanup rules table
            [[CREATE TABLE IF NOT EXISTS `phone_cleanup_rules` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Drop old procedures if exist
            [[DROP PROCEDURE IF EXISTS `sp_gcphone_cleanup_add_rule`]],
            [[DROP PROCEDURE IF EXISTS `sp_gcphone_cleanup_seed_defaults`]],
            [[DROP PROCEDURE IF EXISTS `sp_gcphone_run_cleanup`]],
            
            -- Cleanup procedure
            [[CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_cleanup_add_rule`(
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
            END]],
            
            -- Seed default rules
            [[CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_cleanup_seed_defaults`()
            BEGIN
                CALL sp_gcphone_cleanup_add_rule('live_locations_expired', 'delete', 'phone_live_locations', NULL, 'expires_at < NOW()', 1);
                CALL sp_gcphone_cleanup_add_rule('shared_locations_expired', 'delete', 'phone_shared_locations', NULL, 'expires_at IS NOT NULL AND expires_at < NOW()', 1);
                CALL sp_gcphone_cleanup_add_rule('snap_stories_expired', 'delete', 'phone_snap_stories', NULL, 'expires_at < NOW() OR created_at < (NOW() - INTERVAL 7 DAY)', 5);
                CALL sp_gcphone_cleanup_add_rule('retention_messages', 'delete', 'phone_messages', NULL, '`time` < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_group_messages', 'delete', 'phone_chat_group_messages', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_calls', 'delete', 'phone_calls', NULL, '`time` < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_chirp_tweets', 'delete', 'phone_chirp_tweets', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_snap_posts', 'delete', 'phone_snap_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_clips_posts', 'delete', 'phone_clips_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_news', 'delete', 'phone_news', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_market', 'delete', 'phone_market', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_darkrooms_posts', 'delete', 'phone_darkrooms_posts', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('retention_darkrooms_comments', 'delete', 'phone_darkrooms_comments', NULL, 'created_at < (NOW() - INTERVAL 7 DAY)', 30);
                CALL sp_gcphone_cleanup_add_rule('market_mark_expired', 'update', 'phone_market', "status = 'expired'", "status = 'active' AND expires_at IS NOT NULL AND expires_at < NOW()", 15);
            END]],
            
            -- Cleanup runner procedure
            [[CREATE PROCEDURE IF NOT EXISTS `sp_gcphone_run_cleanup`()
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
            END]],
            
            -- Call seed defaults
            [[CALL `sp_gcphone_cleanup_seed_defaults`()]],
            
            -- Create event scheduler
            [[DROP EVENT IF EXISTS `ev_gcphone_cleanup_runner`]],
            [[CREATE EVENT `ev_gcphone_cleanup_runner`
                ON SCHEDULE EVERY 1 MINUTE
                DO
                    CALL `sp_gcphone_run_cleanup`()]]
        }
    },
    
    {
        version = 5,
        name = "triggers_and_performance",
        description = "Auto-counters via triggers and performance indexes",
        statements = {
            -- Performance indexes
            [[ALTER TABLE `phone_messages` ADD INDEX IF NOT EXISTS `idx_phone_messages_time` (`time`)]],
            [[ALTER TABLE `phone_chat_group_messages` ADD INDEX IF NOT EXISTS `idx_group_messages_created` (`created_at`)]],
            [[ALTER TABLE `phone_calls` ADD INDEX IF NOT EXISTS `idx_phone_calls_time` (`time`)]],
            [[ALTER TABLE `phone_chirp_tweets` ADD INDEX IF NOT EXISTS `idx_chirp_tweets_created` (`created_at`)]],
            [[ALTER TABLE `phone_snap_posts` ADD INDEX IF NOT EXISTS `idx_snap_posts_created` (`created_at`)]],
            [[ALTER TABLE `phone_clips_posts` ADD INDEX IF NOT EXISTS `idx_clips_posts_created` (`created_at`)]],
            [[ALTER TABLE `phone_news` ADD INDEX IF NOT EXISTS `idx_phone_news_created` (`created_at`)]],
            [[ALTER TABLE `phone_market` ADD INDEX IF NOT EXISTS `idx_market_created` (`created_at`)]],
            [[ALTER TABLE `phone_darkrooms_posts` ADD INDEX IF NOT EXISTS `idx_darkrooms_posts_created` (`created_at`)]],
            [[ALTER TABLE `phone_darkrooms_comments` ADD INDEX IF NOT EXISTS `idx_darkrooms_comments_created` (`created_at`)]],
            
            -- Drop existing triggers
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_insert`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_likes_after_delete`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_insert`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_following_after_delete`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_insert`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_snap_posts_after_delete`]],
            
            -- Chirp likes triggers
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_likes_after_insert`
                AFTER INSERT ON `phone_chirp_likes`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = NEW.`tweet_id`)
                WHERE `id` = NEW.`tweet_id`]],
            
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_likes_after_delete`
                AFTER DELETE ON `phone_chirp_likes`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `likes` = (SELECT COUNT(*) FROM `phone_chirp_likes` WHERE `tweet_id` = OLD.`tweet_id`)
                WHERE `id` = OLD.`tweet_id`]],
            
            -- Chirp following triggers
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_following_after_insert`
                AFTER INSERT ON `phone_chirp_following`
                FOR EACH ROW
                BEGIN
                    UPDATE `phone_chirp_accounts`
                    SET `following` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `follower_id` = NEW.`follower_id`)
                    WHERE `id` = NEW.`follower_id`;
                    
                    UPDATE `phone_chirp_accounts`
                    SET `followers` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `following_id` = NEW.`following_id`)
                    WHERE `id` = NEW.`following_id`;
                END]],
            
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_following_after_delete`
                AFTER DELETE ON `phone_chirp_following`
                FOR EACH ROW
                BEGIN
                    UPDATE `phone_chirp_accounts`
                    SET `following` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `follower_id` = OLD.`follower_id`)
                    WHERE `id` = OLD.`follower_id`;
                    
                    UPDATE `phone_chirp_accounts`
                    SET `followers` = (SELECT COUNT(*) FROM `phone_chirp_following` WHERE `following_id` = OLD.`following_id`)
                    WHERE `id` = OLD.`following_id`;
                END]],
            
            -- Snap posts triggers
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_snap_posts_after_insert`
                AFTER INSERT ON `phone_snap_posts`
                FOR EACH ROW
                BEGIN
                    IF NEW.`is_live` = 0 THEN
                        UPDATE `phone_snap_accounts`
                        SET `posts` = (SELECT COUNT(*) FROM `phone_snap_posts` WHERE `account_id` = NEW.`account_id` AND `is_live` = 0)
                        WHERE `id` = NEW.`account_id`;
                    END IF;
                END]],
            
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_snap_posts_after_delete`
                AFTER DELETE ON `phone_snap_posts`
                FOR EACH ROW
                BEGIN
                    IF OLD.`is_live` = 0 THEN
                        UPDATE `phone_snap_accounts`
                        SET `posts` = (SELECT COUNT(*) FROM `phone_snap_posts` WHERE `account_id` = OLD.`account_id` AND `is_live` = 0)
                        WHERE `id` = OLD.`account_id`;
                    END IF;
                END]]
        }
    },
    
    {
        version = 6,
        name = "chirp_enhanced_features",
        description = "Comments and ReChirps for Chirp",
        statements = {
            -- Chirp Comments table
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_comments` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `tweet_id` INT NOT NULL,
                `account_id` INT NOT NULL,
                `content` VARCHAR(500) NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
                KEY `idx_tweet_id` (`tweet_id`),
                KEY `idx_account_id` (`account_id`),
                KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Chirp ReChirps table
            [[CREATE TABLE IF NOT EXISTS `phone_chirp_rechirps` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `original_tweet_id` INT NOT NULL,
                `account_id` INT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`original_tweet_id`) REFERENCES `phone_chirp_tweets`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`account_id`) REFERENCES `phone_chirp_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_unique_rechirp` (`original_tweet_id`, `account_id`),
                KEY `idx_account_id` (`account_id`),
                KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Add replies count column to tweets
            [[ALTER TABLE `phone_chirp_tweets` ADD COLUMN IF NOT EXISTS `replies` INT DEFAULT 0 AFTER `rechirps`]],
            
            -- Indexes for performance
            [[CREATE INDEX IF NOT EXISTS `idx_chirp_comments_tweet` ON `phone_chirp_comments` (`tweet_id`, `created_at`)]],
            [[CREATE INDEX IF NOT EXISTS `idx_chirp_rechirps_original` ON `phone_chirp_rechirps` (`original_tweet_id`, `created_at`)]],
            [[CREATE INDEX IF NOT EXISTS `idx_chirp_rechirps_account` ON `phone_chirp_rechirps` (`account_id`, `created_at`)]],
            
            -- Trigger to update replies count
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_comments_after_insert`]],
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_comments_after_insert`
                AFTER INSERT ON `phone_chirp_comments`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `replies` = (SELECT COUNT(*) FROM `phone_chirp_comments` WHERE `tweet_id` = NEW.`tweet_id`)
                WHERE `id` = NEW.`tweet_id`]],
            
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_comments_after_delete`]],
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_comments_after_delete`
                AFTER DELETE ON `phone_chirp_comments`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `replies` = (SELECT COUNT(*) FROM `phone_chirp_comments` WHERE `tweet_id` = OLD.`tweet_id`)
                WHERE `id` = OLD.`tweet_id`]],
            
            -- Trigger to update rechirps count
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_rechirps_after_insert`]],
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_rechirps_after_insert`
                AFTER INSERT ON `phone_chirp_rechirps`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `rechirps` = (SELECT COUNT(*) FROM `phone_chirp_rechirps` WHERE `original_tweet_id` = NEW.`original_tweet_id`)
                WHERE `id` = NEW.`original_tweet_id`]],
            
            [[DROP TRIGGER IF EXISTS `trg_phone_chirp_rechirps_after_delete`]],
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_chirp_rechirps_after_delete`
                AFTER DELETE ON `phone_chirp_rechirps`
                FOR EACH ROW
                UPDATE `phone_chirp_tweets`
                SET `rechirps` = (SELECT COUNT(*) FROM `phone_chirp_rechirps` WHERE `original_tweet_id` = OLD.`original_tweet_id`)
                WHERE `id` = OLD.`original_tweet_id`]]
        }
    },
    
    {
        version = 7,
        name = "clips_enhanced_features",
        description = "Comments and likes for Clips (TikTok)",
        statements = {
            -- Clips likes table
            [[CREATE TABLE IF NOT EXISTS `phone_clips_likes` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `clip_id` INT NOT NULL,
                `account_id` INT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`clip_id`) REFERENCES `phone_clips_posts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_unique_clip_like` (`clip_id`, `account_id`),
                KEY `idx_account_id` (`account_id`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Clips comments table
            [[CREATE TABLE IF NOT EXISTS `phone_clips_comments` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `clip_id` INT NOT NULL,
                `account_id` INT NOT NULL,
                `content` VARCHAR(500) NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`clip_id`) REFERENCES `phone_clips_posts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                KEY `idx_clip_id` (`clip_id`),
                KEY `idx_account_id` (`account_id`),
                KEY `idx_created_at` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Indexes
            [[CREATE INDEX IF NOT EXISTS `idx_clips_likes_clip` ON `phone_clips_likes` (`clip_id`, `account_id`)]],
            [[CREATE INDEX IF NOT EXISTS `idx_clips_comments_clip` ON `phone_clips_comments` (`clip_id`, `created_at`)]],
            
            -- Drop existing triggers
            [[DROP TRIGGER IF EXISTS `trg_phone_clips_likes_after_insert`]],
            [[DROP TRIGGER IF EXISTS `trg_phone_clips_likes_after_delete`]],
            
            -- Trigger to update likes count
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_clips_likes_after_insert`
                AFTER INSERT ON `phone_clips_likes`
                FOR EACH ROW
                UPDATE `phone_clips_posts`
                SET `likes` = (SELECT COUNT(*) FROM `phone_clips_likes` WHERE `clip_id` = NEW.`clip_id`)
                WHERE `id` = NEW.`clip_id`]],
            
            [[CREATE TRIGGER IF NOT EXISTS `trg_phone_clips_likes_after_delete`
                AFTER DELETE ON `phone_clips_likes`
                FOR EACH ROW
                UPDATE `phone_clips_posts`
                SET `likes` = (SELECT COUNT(*) FROM `phone_clips_likes` WHERE `clip_id` = OLD.`clip_id`)
                WHERE `id` = OLD.`clip_id`]]
        }
    },
    
    {
        version = 8,
        name = "yellowpages_enhanced",
        description = "Add seller info and contact features to YellowPages",
        statements = {
            -- Add seller info columns to phone_market
            [[ALTER TABLE `phone_market` 
                ADD COLUMN IF NOT EXISTS `seller_name` VARCHAR(100) DEFAULT NULL AFTER `phone_number`,
                ADD COLUMN IF NOT EXISTS `seller_avatar` VARCHAR(255) DEFAULT NULL AFTER `seller_name`,
                ADD COLUMN IF NOT EXISTS `location_shared` TINYINT(1) DEFAULT 0 AFTER `seller_avatar`,
                ADD COLUMN IF NOT EXISTS `location_x` FLOAT DEFAULT NULL AFTER `location_shared`,
                ADD COLUMN IF NOT EXISTS `location_y` FLOAT DEFAULT NULL AFTER `location_x`,
                ADD COLUMN IF NOT EXISTS `location_z` FLOAT DEFAULT NULL AFTER `location_y`]],
            
            -- Index for seller lookups
            [[CREATE INDEX IF NOT EXISTS `idx_market_seller` ON `phone_market` (`identifier`, `created_at`)]],
            [[CREATE INDEX IF NOT EXISTS `idx_market_location` ON `phone_market` (`location_shared`, `location_x`, `location_y`)]],
            
            -- YellowPages contact history table
            [[CREATE TABLE IF NOT EXISTS `phone_yellowpages_contacts` (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Garage location tables
            [[CREATE TABLE IF NOT EXISTS `phone_garage_locations` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `plate` VARCHAR(10) NOT NULL,
                `location_x` FLOAT NOT NULL,
                `location_y` FLOAT NOT NULL,
                `location_z` FLOAT NOT NULL,
                `location_updated` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY `idx_garage_loc` (`identifier`, `plate`),
                KEY `idx_updated` (`location_updated`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_garage_location_history` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `identifier` VARCHAR(50) NOT NULL,
                `plate` VARCHAR(10) NOT NULL,
                `location_x` FLOAT NOT NULL,
                `location_y` FLOAT NOT NULL,
                `location_z` FLOAT NOT NULL,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                KEY `idx_garage_hist` (`identifier`, `plate`, `created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Documents NFC support
            [[ALTER TABLE `phone_documents` 
                ADD COLUMN IF NOT EXISTS `nfc_enabled` TINYINT(1) DEFAULT 0 AFTER `verification_code`]],
            
            [[CREATE TABLE IF NOT EXISTS `phone_documents_nfc_scans` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `document_id` INT NOT NULL,
                `scanned_by` VARCHAR(50) NOT NULL,
                `scan_type` ENUM('nfc', 'manual') DEFAULT 'manual',
                `scanned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`document_id`) REFERENCES `phone_documents`(`id`) ON DELETE CASCADE,
                KEY `idx_scanned_by` (`scanned_by`),
                KEY `idx_scanned_at` (`scanned_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]]
        }
    },
    
    {
        version = 8,
        name = "social_enhanced_follow_system",
        description = "Enhanced follow system with requests and notifications for Snap and Chirp",
        statements = {
            -- Add is_private to chirp accounts
            [[ALTER TABLE `phone_chirp_accounts` 
                ADD COLUMN IF NOT EXISTS `is_private` TINYINT(1) DEFAULT 0 AFTER `verified`]],
            
            -- Drop old friend_requests table if exists and create new schema
            [[DROP TABLE IF EXISTS `phone_friend_requests_old`]],
            [[RENAME TABLE `phone_friend_requests` TO `phone_friend_requests_old`]],
            
            -- Create new enhanced friend requests table with account_ids
            [[CREATE TABLE IF NOT EXISTS `phone_friend_requests` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `from_account_id` INT NOT NULL,
                `to_account_id` INT NOT NULL,
                `app_type` ENUM('chirp', 'snap') NOT NULL,
                `status` ENUM('pending', 'accepted', 'rejected', 'cancelled') DEFAULT 'pending',
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                `responded_at` TIMESTAMP NULL DEFAULT NULL,
                FOREIGN KEY (`from_account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`to_account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_request` (`from_account_id`, `to_account_id`, `app_type`),
                KEY `idx_to` (`to_account_id`, `status`),
                KEY `idx_from` (`from_account_id`, `status`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Create social notifications table
            [[CREATE TABLE IF NOT EXISTS `phone_social_notifications` (
                `id` INT AUTO_INCREMENT PRIMARY KEY,
                `account_id` INT NOT NULL,
                `from_account_id` INT NOT NULL,
                `app_type` ENUM('chirp', 'snap') NOT NULL,
                `notification_type` ENUM('follow_request', 'follow_accepted', 'like', 'comment', 'mention') NOT NULL,
                `reference_id` INT DEFAULT NULL,
                `reference_type` VARCHAR(20) DEFAULT NULL,
                `content_preview` VARCHAR(100) DEFAULT NULL,
                `is_read` TINYINT(1) DEFAULT 0,
                `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (`account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                FOREIGN KEY (`from_account_id`) REFERENCES `phone_snap_accounts`(`id`) ON DELETE CASCADE,
                UNIQUE KEY `idx_notification_unique` (`account_id`, `from_account_id`, `app_type`, `notification_type`, `reference_id`),
                KEY `idx_account_unread` (`account_id`, `is_read`, `created_at`),
                KEY `idx_created` (`created_at`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci]],
            
            -- Cleanup rule for social notifications retention (30 days)
            [[CALL sp_gcphone_cleanup_add_rule('social_notifications_retention', 'delete', 'phone_social_notifications', NULL, 'created_at < (NOW() - INTERVAL 30 DAY)', 1440)]],
            
            -- Migrate data from old friend_requests if possible
            [[INSERT IGNORE INTO `phone_friend_requests` (`from_account_id`, `to_account_id`, `app_type`, `status`, `created_at`)
                SELECT 
                    COALESCE(fa.id, ta.id) as from_account_id,
                    COALESCE(ta.id, fa.id) as to_account_id,
                    old.type as app_type,
                    old.status,
                    old.created_at
                FROM `phone_friend_requests_old` old
                LEFT JOIN `phone_snap_accounts` fa ON fa.identifier = old.from_identifier
                LEFT JOIN `phone_snap_accounts` ta ON ta.identifier = old.to_identifier
                WHERE fa.id IS NOT NULL AND ta.id IS NOT NULL]]
        }
    }
}

-- Migration tracking table creation
local CREATE_MIGRATIONS_TABLE = [[
    CREATE TABLE IF NOT EXISTS `phone_migrations` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `version` INT NOT NULL UNIQUE,
        `name` VARCHAR(64) NOT NULL,
        `description` VARCHAR(255) DEFAULT NULL,
        `applied_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        `execution_time_ms` INT DEFAULT 0,
        KEY `idx_version` (`version`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
]]

-- Execute a single migration
local function ExecuteMigration(migration)
    local startTime = os.clock()
    local statements = migration.statements or {}
    
    for i, sql in ipairs(statements) do
        local success, errorMsg = pcall(function()
            MySQL.query.await(sql)
        end)
        
        if not success then
            print(string.format('^1[gcphone-next] Migration %d.%s failed at statement %d/%d: %s^7', 
                migration.version, migration.name, i, #statements, errorMsg))
            return false, errorMsg
        end
    end
    
    local executionTime = math.floor((os.clock() - startTime) * 1000)
    
    -- Record migration
    MySQL.insert.await(
        'INSERT INTO `phone_migrations` (`version`, `name`, `description`, `execution_time_ms`) VALUES (?, ?, ?, ?)',
        { migration.version, migration.name, migration.description, executionTime }
    )
    
    print(string.format('^2[gcphone-next] Migration %d.%s applied successfully (%d ms, %d statements)^7',
        migration.version, migration.name, executionTime, #statements))
    
    return true
end

-- Main migration runner
local function RunMigrations()
    -- Wait for MySQL to be ready
    local attempts = 0
    while GetResourceState('oxmysql') ~= 'started' and attempts < 30 do
        Wait(100)
        attempts = attempts + 1
    end
    
    if GetResourceState('oxmysql') ~= 'started' then
        print('^1[gcphone-next] ERROR: oxmysql not started, cannot run migrations^7')
        return
    end
    
    Wait(500) -- Give oxmysql time to fully initialize
    
    -- Create migrations tracking table
    local success, errorMsg = pcall(function()
        MySQL.query.await(CREATE_MIGRATIONS_TABLE)
    end)
    
    if not success then
        print('^1[gcphone-next] ERROR: Failed to create migrations table: ' .. tostring(errorMsg) .. '^7')
        return
    end
    
    -- Get current database version
    local currentVersion = 0
    local result = MySQL.query.await('SELECT MAX(`version`) as max_version FROM `phone_migrations`')
    if result and result[1] and result[1].max_version then
        currentVersion = tonumber(result[1].max_version) or 0
    end
    
    print(string.format('^3[gcphone-next] Database version: %d, Latest migration: %d^7', 
        currentVersion, MIGRATIONS[#MIGRATIONS].version))
    
    -- Run pending migrations
    local migrationsApplied = 0
    for _, migration in ipairs(MIGRATIONS) do
        if migration.version > currentVersion then
            local success, errorMsg = ExecuteMigration(migration)
            if not success then
                print('^1[gcphone-next] Migration failed, stopping. Error: ' .. tostring(errorMsg) .. '^7')
                return
            end
            migrationsApplied = migrationsApplied + 1
        end
    end
    
    if migrationsApplied > 0 then
        print(string.format('^2[gcphone-next] Database migrations complete. Applied %d migration(s).^7', migrationsApplied))
    else
        print('^2[gcphone-next] Database is up to date.^7')
    end
end

-- Run migrations immediately when this file loads
CreateThread(function()
    RunMigrations()
end)

-- Export for potential manual runs
exports('RunMigrations', RunMigrations)

-- Export to get current DB version
exports('GetDatabaseVersion', function()
    local result = MySQL.query.await('SELECT MAX(`version`) as max_version FROM `phone_migrations`')
    if result and result[1] then
        return tonumber(result[1].max_version) or 0
    end
    return 0
end)
