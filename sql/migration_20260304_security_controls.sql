-- gcphone-next incremental migration
-- Security controls: blocks + reports

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
