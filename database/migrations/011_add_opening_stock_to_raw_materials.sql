-- ==============================================================================
-- Migration 011: Add Opening Stock to Raw Materials Master
-- Plastic Recycling ERP - Inventory Foundation
-- ==============================================================================

-- Safely add opening stock columns to raw_materials
ALTER TABLE raw_materials
  ADD COLUMN opening_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit,
  ADD COLUMN opening_stock_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER opening_stock,
  ADD COLUMN opening_stock_date DATE NULL AFTER opening_stock_rate;
