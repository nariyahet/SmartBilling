-- SmartBilling Migration 005: Plastic Recycling ERP Phase 2 Operations
-- Purpose: Tables for Production, Planning, Recipes, Consumption, WIP, Finished Goods,
--          Quality Control, Scrap, Regrind, Machines, Downtime, Maintenance, Shifts,
--          Operators, Traceability, Costing, and Advanced Operations.
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE, NO DROPS, STRICT MULTI-TENANT ISOLATION

-- 0. Extend raw_material_stock_movements.movement_type to VARCHAR(50) to support PRODUCTION_CONSUMPTION
ALTER TABLE raw_material_stock_movements MODIFY COLUMN movement_type VARCHAR(50) NOT NULL;

-- 1. Machines Master Table
CREATE TABLE IF NOT EXISTS plastic_machines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  machine_code VARCHAR(50) NOT NULL,
  machine_name VARCHAR(150) NOT NULL,
  machine_type VARCHAR(100) NOT NULL,
  capacity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG/HR',
  location VARCHAR(100) NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  installation_date DATE NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_machine_code (company_id, machine_code),
  INDEX idx_machines_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. Shifts Master Table
CREATE TABLE IF NOT EXISTS plastic_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  shift_name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration_minutes INT NOT NULL DEFAULT 60,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_shifts_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 3. Operators Master Table
CREATE TABLE IF NOT EXISTS plastic_operators (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  operator_code VARCHAR(50) NOT NULL,
  name VARCHAR(150) NOT NULL,
  mobile VARCHAR(20) NULL,
  skill_level VARCHAR(50) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_operator_code (company_id, operator_code),
  INDEX idx_operators_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 4. Recipes / BOM Master Table
CREATE TABLE IF NOT EXISTS plastic_recipes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  recipe_code VARCHAR(50) NOT NULL,
  recipe_name VARCHAR(150) NOT NULL,
  target_product_name VARCHAR(150) NOT NULL,
  product_id INT NULL,
  version VARCHAR(20) NOT NULL DEFAULT 'v1.0',
  effective_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  description TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_recipe_code_version (company_id, recipe_code, version),
  INDEX idx_recipes_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 5. Recipe / BOM Items Table
CREATE TABLE IF NOT EXISTS plastic_recipe_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  recipe_id INT NOT NULL,
  raw_material_id INT NULL,
  material_name VARCHAR(150) NOT NULL,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  standard_consumption_per_unit DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  is_recycled TINYINT(1) NOT NULL DEFAULT 1,
  is_regrind TINYINT(1) NOT NULL DEFAULT 0,
  is_additive TINYINT(1) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_recipe_items_company (company_id, recipe_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (recipe_id) REFERENCES plastic_recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT
);

-- 6. Production Plans Table
CREATE TABLE IF NOT EXISTS plastic_production_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  plan_code VARCHAR(50) NOT NULL,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'DAILY',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  target_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  machine_id INT NULL,
  shift_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_plan_code (company_id, plan_code),
  INDEX idx_plans_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 7. Production Orders Table
CREATE TABLE IF NOT EXISTS plastic_production_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  production_order_no VARCHAR(50) NOT NULL,
  plan_id INT NULL,
  product_id INT NULL,
  product_name VARCHAR(150) NOT NULL,
  recipe_id INT NULL,
  planned_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  production_date DATE NOT NULL,
  target_date DATE NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  machine_id INT NULL,
  shift_id INT NULL,
  operator_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_order_no (company_id, production_order_no),
  INDEX idx_orders_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES plastic_production_plans(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (recipe_id) REFERENCES plastic_recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (operator_id) REFERENCES plastic_operators(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 8. Production Batches Table
CREATE TABLE IF NOT EXISTS plastic_production_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  batch_no VARCHAR(50) NOT NULL,
  production_order_id INT NULL,
  product_id INT NULL,
  product_name VARCHAR(150) NOT NULL,
  recipe_id INT NULL,
  machine_id INT NULL,
  shift_id INT NULL,
  operator_id INT NULL,
  batch_date DATE NOT NULL,
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  planned_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  actual_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  rejected_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  scrap_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  regrind_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  efficiency_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'PLANNED',
  qc_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_batch_no (company_id, batch_no),
  INDEX idx_batches_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (production_order_id) REFERENCES plastic_production_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (recipe_id) REFERENCES plastic_recipes(id) ON DELETE SET NULL,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (operator_id) REFERENCES plastic_operators(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 9. Raw Material Consumption Table
CREATE TABLE IF NOT EXISTS plastic_material_consumptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  batch_id INT NOT NULL,
  raw_material_id INT NOT NULL,
  material_name VARCHAR(150) NOT NULL,
  planned_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  actual_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  variance_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  lot_number VARCHAR(100) NULL,
  truck_inward_id INT NULL,
  consumed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recorded_by INT NULL,
  INDEX idx_consumptions_batch (company_id, batch_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE RESTRICT,
  FOREIGN KEY (truck_inward_id) REFERENCES truck_inwards(id) ON DELETE SET NULL,
  FOREIGN KEY (recorded_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 10. WIP Inventory Table
CREATE TABLE IF NOT EXISTS plastic_wip_stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  batch_id INT NOT NULL,
  product_name VARCHAR(150) NOT NULL,
  stage VARCHAR(100) NOT NULL DEFAULT 'WASHING',
  machine_id INT NULL,
  location VARCHAR(100) NOT NULL DEFAULT 'Shop Floor 1',
  wip_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wip_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE CASCADE,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL
);

-- 11. Finished Goods Master & Catalog Table
CREATE TABLE IF NOT EXISTS plastic_finished_goods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  product_id INT NULL,
  fg_code VARCHAR(50) NOT NULL,
  fg_name VARCHAR(150) NOT NULL,
  plastic_type VARCHAR(50) NOT NULL,
  grade VARCHAR(50) NULL,
  color VARCHAR(50) NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  minimum_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  standard_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  warehouse_location VARCHAR(100) NULL DEFAULT 'Main Warehouse',
  packing_type VARCHAR(100) NULL DEFAULT '25 KG Bags',
  barcode VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_fg_code (company_id, fg_code),
  INDEX idx_fg_company (company_id, plastic_type),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- 12. Finished Goods Production Lots Table
CREATE TABLE IF NOT EXISTS plastic_finished_goods_lots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  finished_goods_id INT NOT NULL,
  batch_id INT NOT NULL,
  lot_number VARCHAR(100) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  qc_status VARCHAR(20) NOT NULL DEFAULT 'PASSED',
  dispatch_status VARCHAR(20) NOT NULL DEFAULT 'READY',
  production_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fg_lots (company_id, finished_goods_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_goods_id) REFERENCES plastic_finished_goods(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE CASCADE
);

-- 13. Quality Inspections Table
CREATE TABLE IF NOT EXISTS plastic_quality_inspections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  inspection_no VARCHAR(50) NOT NULL,
  qc_type VARCHAR(30) NOT NULL,
  supplier_id INT NULL,
  raw_material_id INT NULL,
  truck_inward_id INT NULL,
  batch_id INT NULL,
  product_id INT NULL,
  machine_id INT NULL,
  sample_size DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  inspection_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  inspector_name VARCHAR(100) NULL,
  overall_status VARCHAR(20) NOT NULL DEFAULT 'PASSED',
  rejection_reason TEXT NULL,
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_inspection_no (company_id, inspection_no),
  INDEX idx_qc_company_type (company_id, qc_type, overall_status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (raw_material_id) REFERENCES raw_materials(id) ON DELETE SET NULL,
  FOREIGN KEY (truck_inward_id) REFERENCES truck_inwards(id) ON DELETE SET NULL,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 14. Quality Inspection Parameter Results Table
CREATE TABLE IF NOT EXISTS plastic_quality_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  inspection_id INT NOT NULL,
  parameter_name VARCHAR(100) NOT NULL,
  expected_value VARCHAR(100) NULL,
  observed_value VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PASS',
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_qc_results (company_id, inspection_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (inspection_id) REFERENCES plastic_quality_inspections(id) ON DELETE CASCADE
);

-- 15. Scrap & Process Waste Records Table
CREATE TABLE IF NOT EXISTS plastic_scrap_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  scrap_no VARCHAR(50) NOT NULL,
  scrap_type VARCHAR(30) NOT NULL DEFAULT 'PROCESS_SCRAP',
  batch_id INT NULL,
  machine_id INT NULL,
  shift_id INT NULL,
  material_id INT NULL,
  material_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  reason TEXT NULL,
  is_reusable TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'GENERATED',
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_scrap_no (company_id, scrap_no),
  INDEX idx_scrap_company (company_id, scrap_type),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 16. Regrind Transactions & Stock Table
CREATE TABLE IF NOT EXISTS plastic_regrind_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  transaction_no VARCHAR(50) NOT NULL,
  transaction_type VARCHAR(30) NOT NULL,
  source_batch_id INT NULL,
  target_batch_id INT NULL,
  material_id INT NULL,
  material_name VARCHAR(150) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  recovery_rate_percent DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  notes TEXT NULL,
  transaction_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_regrind_tx (company_id, transaction_no),
  INDEX idx_regrind_company (company_id, material_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (source_batch_id) REFERENCES plastic_production_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (target_batch_id) REFERENCES plastic_production_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (material_id) REFERENCES raw_materials(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 17. Machine Downtime Records Table
CREATE TABLE IF NOT EXISTS plastic_machine_downtime (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  downtime_no VARCHAR(50) NOT NULL,
  machine_id INT NOT NULL,
  batch_id INT NULL,
  shift_id INT NULL,
  category VARCHAR(50) NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NULL,
  duration_minutes INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  action_taken TEXT NULL,
  logged_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_downtime_no (company_id, downtime_no),
  INDEX idx_downtime_machine (company_id, machine_id, category),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (logged_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 18. Machine Maintenance Schedules & Records Table
CREATE TABLE IF NOT EXISTS plastic_maintenance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  maintenance_no VARCHAR(50) NOT NULL,
  machine_id INT NOT NULL,
  maintenance_type VARCHAR(30) NOT NULL DEFAULT 'PREVENTIVE',
  title VARCHAR(200) NOT NULL,
  scheduled_date DATE NOT NULL,
  performed_date DATE NULL,
  next_maintenance_date DATE NULL,
  cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  spare_parts_used TEXT NULL,
  technician_name VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_maintenance_no (company_id, maintenance_no),
  INDEX idx_maintenance_machine (company_id, machine_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (machine_id) REFERENCES plastic_machines(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 19. Production Costing Table
CREATE TABLE IF NOT EXISTS plastic_production_costs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  batch_id INT NOT NULL UNIQUE,
  raw_material_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  regrind_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  labour_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  machine_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  maintenance_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  overhead_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  scrap_rework_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  output_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  cost_per_kg DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  cost_per_ton DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  standard_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  variance_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  calculated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_costs_company (company_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE CASCADE
);

-- 20. Batch & Lot Traceability Audit Table
CREATE TABLE IF NOT EXISTS plastic_batch_traceability (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  batch_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_description TEXT NOT NULL,
  entity_type VARCHAR(50) NULL,
  entity_id INT NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_traceability_batch (company_id, batch_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES plastic_production_batches(id) ON DELETE CASCADE
);
