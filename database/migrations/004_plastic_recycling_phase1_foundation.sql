-- SmartBilling Migration 004: Plastic Recycling Phase 1 Foundation
-- Purpose: Add specialized ERP tables for Suppliers, Raw Materials, Truck Inward, Weighment, Purchase Bills, and Inventory
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE, NO DROPS, NO MODIFICATION OF EXISTING PRODUCTION TABLES

-- 1. Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  supplier_code VARCHAR(50) NOT NULL,
  supplier_name VARCHAR(150) NOT NULL,
  company_name VARCHAR(255) NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(150) NULL,
  gst_number VARCHAR(50) NULL,
  address TEXT NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  payment_terms VARCHAR(100) NULL,
  opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_supplier_code (company_id, supplier_code),
  INDEX idx_suppliers_company_id (company_id),
  INDEX idx_suppliers_status (status),
  INDEX idx_suppliers_mobile (mobile),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. Raw Material Master Table
CREATE TABLE IF NOT EXISTS raw_materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  material_code VARCHAR(50) NOT NULL,
  material_name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NULL,
  plastic_type VARCHAR(50) NOT NULL,
  grade VARCHAR(50) NULL,
  color VARCHAR(50) NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  minimum_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  maximum_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  default_purchase_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  default_selling_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  description TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_material_code (company_id, material_code),
  INDEX idx_raw_materials_company_id (company_id),
  INDEX idx_raw_materials_plastic_type (plastic_type),
  INDEX idx_raw_materials_status (status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Truck Inward Table
CREATE TABLE IF NOT EXISTS truck_inwards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  inward_no VARCHAR(50) NOT NULL,
  supplier_id INT NOT NULL,
  truck_number VARCHAR(50) NOT NULL,
  driver_name VARCHAR(100) NULL,
  driver_mobile VARCHAR(20) NULL,
  material_id INT NOT NULL,
  gross_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tare_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  rate_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  inward_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  quality_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_inward_no (company_id, inward_no),
  INDEX idx_truck_inwards_company_id (company_id),
  INDEX idx_truck_inwards_supplier_id (supplier_id),
  INDEX idx_truck_inwards_material_id (material_id),
  INDEX idx_truck_inwards_quality_status (quality_status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 4. Weighments Table
CREATE TABLE IF NOT EXISTS weighments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  weighment_no VARCHAR(50) NOT NULL,
  truck_inward_id INT NOT NULL,
  truck_number VARCHAR(50) NOT NULL,
  first_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  second_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_weight DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  weighing_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  operator_name VARCHAR(100) NULL,
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_weighment_no (company_id, weighment_no),
  INDEX idx_weighments_company_id (company_id),
  INDEX idx_weighments_truck_inward_id (truck_inward_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (truck_inward_id) REFERENCES truck_inwards(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 5. Purchase Bills Table
CREATE TABLE IF NOT EXISTS purchase_bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  purchase_bill_no VARCHAR(50) NOT NULL,
  supplier_id INT NOT NULL,
  truck_inward_id INT NULL,
  purchase_date DATE NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_purchase_bill_no (company_id, purchase_bill_no),
  INDEX idx_purchase_bills_company_id (company_id),
  INDEX idx_purchase_bills_supplier_id (supplier_id),
  INDEX idx_purchase_bills_payment_status (payment_status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (truck_inward_id) REFERENCES truck_inwards(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 6. Purchase Bill Items Table
CREATE TABLE IF NOT EXISTS purchase_bill_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  purchase_bill_id INT NOT NULL,
  raw_material_id INT NOT NULL,
  material_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_purchase_bill_items_company_id (company_id),
  INDEX idx_purchase_bill_items_bill_id (purchase_bill_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT
);

-- 7. Raw Material Stock Table
CREATE TABLE IF NOT EXISTS raw_material_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  raw_material_id INT NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  average_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  stock_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_material_stock (company_id, raw_material_id),
  INDEX idx_raw_material_stock_company_id (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE
);

-- 8. Raw Material Stock Movements Table
CREATE TABLE IF NOT EXISTS raw_material_stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  raw_material_id INT NOT NULL,
  movement_type VARCHAR(20) NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  movement_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_stock_movements_company_material (company_id, raw_material_id),
  INDEX idx_stock_movements_type (movement_type),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);
