-- SmartBilling Database Migration
-- 002_multi_tenant_data_isolation.sql
-- Phase 2: Complete Multi-Tenant Data Isolation

-- 1. Add company_id to tenant tables (idempotent via stored procedure)
DELIMITER $$
DROP PROCEDURE IF EXISTS AddMultiTenantColumns$$
CREATE PROCEDURE AddMultiTenantColumns()
BEGIN
  -- 1.1 products.company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE products
      ADD COLUMN company_id INT NULL,
      ADD INDEX idx_products_company_id (company_id);
  END IF;

  -- 1.2 customers.company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE customers
      ADD COLUMN company_id INT NULL,
      ADD INDEX idx_customers_company_id (company_id);
  END IF;

  -- 1.3 invoices.company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE invoices
      ADD COLUMN company_id INT NULL,
      ADD INDEX idx_invoices_company_id (company_id);
  END IF;

  -- 1.4 invoice_items.company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_items'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE invoice_items
      ADD COLUMN company_id INT NULL,
      ADD INDEX idx_invoice_items_company_id (company_id);
  END IF;

  -- 1.5 business_settings.company_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'business_settings'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE business_settings
      ADD COLUMN company_id INT NULL;
  END IF;
END$$
DELIMITER ;

CALL AddMultiTenantColumns();
DROP PROCEDURE IF EXISTS AddMultiTenantColumns;

-- 2. Backfill existing demo data to company_id = 1 (Demo Company)
UPDATE products SET company_id = 1 WHERE company_id IS NULL;
UPDATE customers SET company_id = 1 WHERE company_id IS NULL;
UPDATE invoices SET company_id = 1 WHERE company_id IS NULL;
UPDATE invoice_items SET company_id = 1 WHERE company_id IS NULL;
UPDATE business_settings SET company_id = 1 WHERE company_id IS NULL;

-- 3. Ensure business_settings exists for company_id = 2 (SmartBilling Main)
INSERT INTO business_settings (
  company_id,
  business_name,
  tagline,
  address,
  phone,
  email,
  tax_number,
  default_tax_percent,
  currency,
  currency_symbol,
  terms_conditions
)
SELECT
  2,
  'SmartBilling Main',
  'Primary Business Account',
  'Corporate Office',
  '+91 9876543210',
  'admin@gmail.com',
  '24ABCDE1234F1Z5',
  18.00,
  'INR',
  '₹',
  'Goods once sold cannot be returned without valid terms.'
WHERE NOT EXISTS (
  SELECT 1 FROM business_settings WHERE company_id = 2
);

-- 4. Add Unique index on business_settings.company_id and foreign keys
DELIMITER $$
DROP PROCEDURE IF EXISTS AddMultiTenantForeignKeysAndConstraints$$
CREATE PROCEDURE AddMultiTenantForeignKeysAndConstraints()
BEGIN
  -- Unique index on business_settings(company_id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'business_settings'
      AND INDEX_NAME = 'idx_business_settings_company_id'
  ) THEN
    ALTER TABLE business_settings
      ADD UNIQUE INDEX idx_business_settings_company_id (company_id);
  END IF;

  -- Update invoice_no uniqueness for multi-tenancy: drop global unique index and add (company_id, invoice_no)
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND INDEX_NAME = 'invoice_no'
  ) THEN
    ALTER TABLE invoices DROP INDEX invoice_no;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND INDEX_NAME = 'unique_company_invoice_no'
  ) THEN
    ALTER TABLE invoices
      ADD UNIQUE INDEX unique_company_invoice_no (company_id, invoice_no);
  END IF;

  -- FK: products -> companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND CONSTRAINT_NAME = 'fk_products_company_id'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT fk_products_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: customers -> companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customers'
      AND CONSTRAINT_NAME = 'fk_customers_company_id'
  ) THEN
    ALTER TABLE customers
      ADD CONSTRAINT fk_customers_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: invoices -> companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoices'
      AND CONSTRAINT_NAME = 'fk_invoices_company_id'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoices_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: invoice_items -> companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'invoice_items'
      AND CONSTRAINT_NAME = 'fk_invoice_items_company_id'
  ) THEN
    ALTER TABLE invoice_items
      ADD CONSTRAINT fk_invoice_items_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE CASCADE;
  END IF;

  -- FK: business_settings -> companies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'business_settings'
      AND CONSTRAINT_NAME = 'fk_business_settings_company_id'
  ) THEN
    ALTER TABLE business_settings
      ADD CONSTRAINT fk_business_settings_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE CASCADE;
  END IF;
END$$
DELIMITER ;

CALL AddMultiTenantForeignKeysAndConstraints();
DROP PROCEDURE IF EXISTS AddMultiTenantForeignKeysAndConstraints;
