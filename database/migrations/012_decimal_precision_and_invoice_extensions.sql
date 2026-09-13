-- Migration 012: Ensure Decimal Quantity Precision & Invoice Phase 3 Extensions
-- Purpose: Support fractional kilogram quantities (e.g. 12.500 KG, 0.250 KG) and complete invoice schema extensions

-- 1. Modify invoice_items.quantity from INT to DECIMAL(12,3)
ALTER TABLE invoice_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000;

-- 2. Modify products.stock from INT to DECIMAL(12,3)
ALTER TABLE products MODIFY COLUMN stock DECIMAL(12,3) NOT NULL DEFAULT 0.000;

-- 3. Ensure Phase 3 Extensions on invoices table exist
-- (Note: run_012.js verifies column existence via information_schema before adding to ensure MySQL compatibility)
