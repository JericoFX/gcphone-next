-- gcphone-next incremental migration
-- Generic SQL cleanup engine (single event + rules table)
--
-- IMPORTANT:
-- 1) Enable MySQL/MariaDB event scheduler:
--      event_scheduler = ON
-- 2) In server.cfg set:
--      setr gcphone_sql_cleanup_events 1
--    to disable Lua cleanup loops and use SQL scheduler as source of truth.

ALTER TABLE `phone_live_locations`
    ADD INDEX IF NOT EXISTS `idx_live_locations_expires` (`expires_at`);

ALTER TABLE `phone_shared_locations`
    ADD INDEX IF NOT EXISTS `idx_shared_locations_expires` (`expires_at`);

ALTER TABLE `phone_snap_stories`
    ADD INDEX IF NOT EXISTS `idx_snap_stories_expires` (`expires_at`);

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
        'created_at < (NOW() - INTERVAL 7 DAY)',
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

-- Example to add a new rule later:
-- CALL sp_gcphone_cleanup_add_rule(
--   'my_new_rule',
--   'delete',
--   'my_table',
--   NULL,
--   'created_at < (NOW() - INTERVAL 7 DAY)',
--   60
-- );
