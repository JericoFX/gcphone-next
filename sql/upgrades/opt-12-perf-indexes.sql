-- OPT-12: performance indexes for existing installs.
-- Run once on existing databases. Fresh installs already get these via schema.sql.
-- Each statement is independent; ignore "Duplicate key name" errors if re-run.

ALTER TABLE `phone_messages`
    ADD INDEX `idx_messages_receiver_unread` (`receiver`, `is_read`, `owner`);

ALTER TABLE `phone_calls`
    ADD INDEX `idx_calls_owner_num` (`owner`, `num`);

ALTER TABLE `phone_social_notifications`
    ADD INDEX `idx_social_notif_from` (`from_identifier`);
