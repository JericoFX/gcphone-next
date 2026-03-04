-- gcphone-next incremental migration
-- Wallet bilateral requests (QR/NFC)

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
