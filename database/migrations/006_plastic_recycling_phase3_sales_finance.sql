-- SmartBilling Migration 006: Plastic Recycling ERP Phase 3 Sales, Dispatch & Finance
-- Purpose: Add tables and additive fields for Sales Orders, Stock Reservations, Dispatches,
--          Delivery Challans, Transport/Vehicles, Payments, Customer Ledger, Sales Returns,
--          Credit Notes, Debit Notes, and Auditable Outward FG Stock Movements.
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE, NO DROPS, STRICT MULTI-TENANT ISOLATION

-- 1. Sales Orders Table
CREATE TABLE IF NOT EXISTS plastic_sales_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  sales_order_no VARCHAR(50) NOT NULL,
  customer_id INT NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery_date DATE NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_sales_order_no (company_id, sales_order_no),
  INDEX idx_sales_orders_company (company_id, status),
  INDEX idx_sales_orders_customer (company_id, customer_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 2. Sales Order Items Table
CREATE TABLE IF NOT EXISTS plastic_sales_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  sales_order_id INT NOT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  reserved_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  dispatched_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_so_items_company_order (company_id, sales_order_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_id) REFERENCES plastic_sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE RESTRICT,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL
);

-- 3. Finished Goods Stock Reservations Table
CREATE TABLE IF NOT EXISTS plastic_fg_reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  sales_order_id INT NOT NULL,
  sales_order_item_id INT NOT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  reserved_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP NULL,
  INDEX idx_reservations_company_fg (company_id, finished_good_id, status),
  INDEX idx_reservations_order (company_id, sales_order_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_id) REFERENCES plastic_sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES plastic_sales_order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL
);

-- 4. Vehicles / Transport Master Table
CREATE TABLE IF NOT EXISTS plastic_vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  vehicle_number VARCHAR(50) NOT NULL,
  vehicle_type VARCHAR(50) NULL,
  transporter_name VARCHAR(150) NULL,
  transporter_mobile VARCHAR(20) NULL,
  driver_name VARCHAR(100) NULL,
  driver_mobile VARCHAR(20) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_vehicle_number (company_id, vehicle_number),
  INDEX idx_vehicles_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 5. Dispatches Table
CREATE TABLE IF NOT EXISTS plastic_dispatches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  dispatch_no VARCHAR(50) NOT NULL,
  dispatch_date DATE NOT NULL,
  customer_id INT NOT NULL,
  sales_order_id INT NULL,
  vehicle_id INT NULL,
  vehicle_number VARCHAR(50) NULL,
  driver_name VARCHAR(100) NULL,
  driver_mobile VARCHAR(20) NULL,
  transporter VARCHAR(150) NULL,
  destination VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_dispatch_no (company_id, dispatch_no),
  INDEX idx_dispatches_company (company_id, status),
  INDEX idx_dispatches_customer (company_id, customer_id),
  INDEX idx_dispatches_order (company_id, sales_order_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (sales_order_id) REFERENCES plastic_sales_orders(id) ON DELETE SET NULL,
  FOREIGN KEY (vehicle_id) REFERENCES plastic_vehicles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 6. Dispatch Items Table
CREATE TABLE IF NOT EXISTS plastic_dispatch_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  dispatch_id INT NOT NULL,
  sales_order_item_id INT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dispatch_items_company (company_id, dispatch_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (dispatch_id) REFERENCES plastic_dispatches(id) ON DELETE CASCADE,
  FOREIGN KEY (sales_order_item_id) REFERENCES plastic_sales_order_items(id) ON DELETE SET NULL,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE RESTRICT,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL
);

-- 7. Delivery Challans Table
CREATE TABLE IF NOT EXISTS plastic_delivery_challans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  challan_no VARCHAR(50) NOT NULL,
  challan_date DATE NOT NULL,
  customer_id INT NOT NULL,
  dispatch_id INT NOT NULL,
  vehicle_id INT NULL,
  vehicle_number VARCHAR(50) NULL,
  transporter VARCHAR(150) NULL,
  destination VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  remarks TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_challan_no (company_id, challan_no),
  INDEX idx_challans_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (dispatch_id) REFERENCES plastic_dispatches(id) ON DELETE RESTRICT,
  FOREIGN KEY (vehicle_id) REFERENCES plastic_vehicles(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 8. Delivery Challan Items Table
CREATE TABLE IF NOT EXISTS plastic_delivery_challan_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  challan_id INT NOT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_challan_items_company (company_id, challan_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (challan_id) REFERENCES plastic_delivery_challans(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE RESTRICT,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL
);

-- 9. Finished Goods Outward Stock Movements Table
CREATE TABLE IF NOT EXISTS plastic_sales_stock_movements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  movement_type VARCHAR(50) NOT NULL,
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
  INDEX idx_sales_movements_company_fg (company_id, finished_good_id),
  INDEX idx_sales_movements_type (company_id, movement_type),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE CASCADE,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 10. Payments Collection Table
CREATE TABLE IF NOT EXISTS plastic_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  payment_no VARCHAR(50) NOT NULL,
  customer_id INT NOT NULL,
  invoice_id INT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'BANK',
  reference_number VARCHAR(100) NULL,
  notes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'RECEIVED',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_payment_no (company_id, payment_no),
  INDEX idx_payments_company_customer (company_id, customer_id),
  INDEX idx_payments_invoice (company_id, invoice_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 11. Customer Ledger Table
CREATE TABLE IF NOT EXISTS plastic_customer_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  customer_id INT NOT NULL,
  transaction_date DATE NOT NULL,
  reference_type VARCHAR(50) NOT NULL,
  reference_id INT NULL,
  reference_no VARCHAR(50) NOT NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ledger_company_customer (company_id, customer_id, transaction_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 12. Sales Returns Table
CREATE TABLE IF NOT EXISTS plastic_sales_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  return_no VARCHAR(50) NOT NULL,
  return_date DATE NOT NULL,
  customer_id INT NOT NULL,
  invoice_id INT NULL,
  dispatch_id INT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_return_no (company_id, return_no),
  INDEX idx_returns_company (company_id, status),
  INDEX idx_returns_customer (company_id, customer_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (dispatch_id) REFERENCES plastic_dispatches(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 13. Sales Return Items Table
CREATE TABLE IF NOT EXISTS plastic_sales_return_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  return_id INT NOT NULL,
  finished_good_id INT NOT NULL,
  lot_id INT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  unit VARCHAR(20) NOT NULL DEFAULT 'KG',
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  qc_disposition VARCHAR(30) NOT NULL DEFAULT 'RETURN_TO_STOCK',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_return_items_company (company_id, return_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (return_id) REFERENCES plastic_sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (finished_good_id) REFERENCES plastic_finished_goods(id) ON DELETE RESTRICT,
  FOREIGN KEY (lot_id) REFERENCES plastic_finished_goods_lots(id) ON DELETE SET NULL
);

-- 14. Credit Notes Table
CREATE TABLE IF NOT EXISTS plastic_credit_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  credit_note_no VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  customer_id INT NOT NULL,
  invoice_id INT NULL,
  sales_return_id INT NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_credit_note_no (company_id, credit_note_no),
  INDEX idx_credit_notes_company (company_id, customer_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (sales_return_id) REFERENCES plastic_sales_returns(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 15. Credit Note Items Table
CREATE TABLE IF NOT EXISTS plastic_credit_note_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  credit_note_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_credit_note_items_company (company_id, credit_note_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (credit_note_id) REFERENCES plastic_credit_notes(id) ON DELETE CASCADE
);

-- 16. Debit Notes Table
CREATE TABLE IF NOT EXISTS plastic_debit_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  debit_note_no VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  customer_id INT NOT NULL,
  invoice_id INT NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ISSUED',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_debit_note_no (company_id, debit_note_no),
  INDEX idx_debit_notes_company (company_id, customer_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 17. Debit Note Items Table
CREATE TABLE IF NOT EXISTS plastic_debit_note_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  debit_note_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1.00,
  rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_debit_note_items_company (company_id, debit_note_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (debit_note_id) REFERENCES plastic_debit_notes(id) ON DELETE CASCADE
);
