-- SmartBilling Database Schema

CREATE DATABASE IF NOT EXISTS smartbilling_db;
USE smartbilling_db;

-- 1. Companies Table
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

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
);

-- Foreign key for companies.owner_admin_id -> admins(id)
ALTER TABLE companies
  ADD CONSTRAINT fk_companies_owner_admin_id
  FOREIGN KEY (owner_admin_id) REFERENCES admins(id) ON DELETE SET NULL;

-- 3. Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_customers_company_id (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_company_id (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 5. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  customer_id INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoices_company_id (company_id),
  UNIQUE KEY unique_company_invoice_no (company_id, invoice_no),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
);

-- 6. Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  invoice_id INT NOT NULL,
  product_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invoice_items_company_id (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- 7. Business Settings Table
CREATE TABLE IF NOT EXISTS business_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL UNIQUE,
  business_name VARCHAR(255) NOT NULL DEFAULT 'Shiv Enterprises',
  tagline VARCHAR(255) DEFAULT 'All Brands Electronic Appliances Sales & Service',
  logo LONGTEXT,
  address TEXT,
  phone VARCHAR(50) DEFAULT '+91 9876543210',
  email VARCHAR(100) DEFAULT 'contact@smartbilling.com',
  tax_number VARCHAR(100) DEFAULT '24ABCDE1234F1Z5',
  default_tax_percent DECIMAL(5,2) NOT NULL DEFAULT 18.00,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  currency_symbol VARCHAR(10) NOT NULL DEFAULT '₹',
  terms_conditions TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
