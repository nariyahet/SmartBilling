-- Migration 003: Add tax_enabled setting to business_settings table
-- Preserves existing data, defaults to TRUE for backward compatibility

ALTER TABLE business_settings
  ADD COLUMN tax_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER default_tax_percent;
