-- SmartBilling Database Migration
-- 001_multi_tenant_foundation.sql
-- Phase 1: Foundation for Multi-Tenant / Separate Client Account Architecture

-- 1. Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  owner_admin_id INT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  trial_start_at DATETIME NULL,
  trial_end_at DATETIME NULL,
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_slug (slug),
  INDEX idx_companies_status (status)
);

-- 2. Add company_id to admins table (idempotent via procedure)
DELIMITER $$
DROP PROCEDURE IF EXISTS AddCompanyIdToAdmins$$
CREATE PROCEDURE AddCompanyIdToAdmins()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'admins'
      AND COLUMN_NAME = 'company_id'
  ) THEN
    ALTER TABLE admins
      ADD COLUMN company_id INT NULL,
      ADD INDEX idx_admins_company_id (company_id);
  END IF;
END$$
DELIMITER ;

CALL AddCompanyIdToAdmins();
DROP PROCEDURE IF EXISTS AddCompanyIdToAdmins;

-- 3. Insert Demo Company if not exists
INSERT INTO companies (name, slug, owner_admin_id, status, is_demo, subscription_status)
SELECT 'Demo Company', 'demo-company', NULL, 'active', 1, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'demo-company'
);

-- 4. Insert SmartBilling Main Company if not exists
INSERT INTO companies (name, slug, owner_admin_id, status, is_demo, subscription_status)
SELECT 'SmartBilling Main', 'smartbilling-main', NULL, 'active', 0, 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'smartbilling-main'
);

-- 5. Attach existing demo admin to Demo Company
UPDATE admins
SET company_id = (SELECT id FROM companies WHERE slug = 'demo-company' LIMIT 1)
WHERE email = 'demo@smartbilling.com';

-- 6. Attach existing main admin to SmartBilling Main Company
UPDATE admins
SET company_id = (SELECT id FROM companies WHERE slug = 'smartbilling-main' LIMIT 1)
WHERE email = 'admin@gmail.com';

-- 7. Fallback: attach any remaining unassigned admin to Demo Company
UPDATE admins
SET company_id = (SELECT id FROM companies WHERE slug = 'demo-company' LIMIT 1)
WHERE company_id IS NULL;

-- 8. Set owner_admin_id in companies to point to actual admin IDs
UPDATE companies c
JOIN admins a ON a.email = 'demo@smartbilling.com'
SET c.owner_admin_id = a.id
WHERE c.slug = 'demo-company';

UPDATE companies c
JOIN admins a ON a.email = 'admin@gmail.com'
SET c.owner_admin_id = a.id
WHERE c.slug = 'smartbilling-main';

-- 9. Add Foreign Key constraints safely
DELIMITER $$
DROP PROCEDURE IF EXISTS AddMultiTenantForeignKeys$$
CREATE PROCEDURE AddMultiTenantForeignKeys()
BEGIN
  -- Foreign key on admins(company_id) -> companies(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'admins'
      AND CONSTRAINT_NAME = 'fk_admins_company_id'
  ) THEN
    ALTER TABLE admins
      ADD CONSTRAINT fk_admins_company_id
      FOREIGN KEY (company_id) REFERENCES companies(id)
      ON DELETE SET NULL;
  END IF;

  -- Foreign key on companies(owner_admin_id) -> admins(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND CONSTRAINT_NAME = 'fk_companies_owner_admin_id'
  ) THEN
    ALTER TABLE companies
      ADD CONSTRAINT fk_companies_owner_admin_id
      FOREIGN KEY (owner_admin_id) REFERENCES admins(id)
      ON DELETE SET NULL;
  END IF;
END$$
DELIMITER ;

CALL AddMultiTenantForeignKeys();
DROP PROCEDURE IF EXISTS AddMultiTenantForeignKeys;
