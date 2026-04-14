-- ============================================================
-- Folders V2: optimistic concurrency + layout_json now carries folders[]
-- Safe to run multiple times.
-- ============================================================

ALTER TABLE `phone_layouts`
    ADD COLUMN IF NOT EXISTS `version` INT NOT NULL DEFAULT 1 AFTER `layout_json`;
