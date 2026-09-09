-- SmartBilling Migration 008: Plastic Recycling ERP Phase 5 Accounting, GST & Compliance
-- Purpose: Add specialized ERP tables for Chart of Accounts, Journal Entries, Cash & Bank,
--          Bank Reconciliation, Supplier Ledger & Payments, GST Auditing, and GST Reconciliation.
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE, NO DROPS, STRICT MULTI-TENANT ISOLATION

-- 1. Account Groups Table
CREATE TABLE IF NOT EXISTS plastic_account_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  parent_id INT NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_group_code (company_id, code),
  INDEX idx_acc_groups_company (company_id, type),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES plastic_account_groups(id) ON DELETE SET NULL
);

-- 2. Ledger Accounts Table
CREATE TABLE IF NOT EXISTS plastic_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  group_id INT NOT NULL,
  account_code VARCHAR(50) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_type VARCHAR(20) NOT NULL, -- ASSET, LIABILITY, EQUITY, INCOME, EXPENSE
  debit_credit_nature VARCHAR(10) NOT NULL DEFAULT 'DEBIT', -- DEBIT, CREDIT
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  description TEXT NULL,
  reference_type VARCHAR(50) NULL,
  reference_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_account_code (company_id, account_code),
  INDEX idx_accounts_company (company_id, status),
  INDEX idx_accounts_group (company_id, group_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES plastic_account_groups(id) ON DELETE RESTRICT
);

-- 3. Double-Entry Journal Entries Table
CREATE TABLE IF NOT EXISTS plastic_journal_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  journal_no VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  reference_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  reference_id INT NULL,
  reference_no VARCHAR(100) NULL,
  narration TEXT NULL,
  debit_account_id INT NULL,
  credit_account_id INT NULL,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'POSTED',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_journal_no (company_id, journal_no),
  INDEX idx_journal_company_date (company_id, entry_date),
  INDEX idx_journal_ref (company_id, reference_type, reference_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (debit_account_id) REFERENCES plastic_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (credit_account_id) REFERENCES plastic_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 4. Journal Entry Items Table (Compound Multi-Leg Line Items)
CREATE TABLE IF NOT EXISTS plastic_journal_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  journal_entry_id INT NOT NULL,
  account_id INT NOT NULL,
  entry_type VARCHAR(10) NOT NULL, -- DEBIT, CREDIT
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  narration VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal_items_entry (company_id, journal_entry_id),
  INDEX idx_journal_items_acc (company_id, account_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (journal_entry_id) REFERENCES plastic_journal_entries(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES plastic_accounts(id) ON DELETE RESTRICT
);

-- 5. Cash & Bank Accounts Master Table
CREATE TABLE IF NOT EXISTS plastic_bank_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  account_id INT NULL,
  account_type VARCHAR(20) NOT NULL DEFAULT 'BANK', -- BANK, CASH
  bank_name VARCHAR(100) NOT NULL,
  account_name VARCHAR(150) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(30) NULL,
  branch VARCHAR(100) NULL,
  opening_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  current_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_bank_acc_num (company_id, account_number),
  INDEX idx_bank_acc_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES plastic_accounts(id) ON DELETE SET NULL
);

-- 6. Bank & Cash Transactions Ledger Table
CREATE TABLE IF NOT EXISTS plastic_bank_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  bank_account_id INT NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- DEPOSIT, WITHDRAWAL, TRANSFER, RECEIPT, PAYMENT
  reference_type VARCHAR(50) NULL,
  reference_id INT NULL,
  reference_no VARCHAR(100) NULL,
  amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_mode VARCHAR(30) NOT NULL DEFAULT 'BANK',
  description TEXT NULL,
  is_reconciled TINYINT(1) NOT NULL DEFAULT 0,
  reconciled_at DATETIME NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bank_tx_acc_date (company_id, bank_account_id, transaction_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_account_id) REFERENCES plastic_bank_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 7. Bank Statement & Reconciliation Table
CREATE TABLE IF NOT EXISTS plastic_bank_reconciliations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  bank_account_id INT NOT NULL,
  statement_date DATE NOT NULL,
  reference_no VARCHAR(100) NULL,
  description TEXT NULL,
  withdrawal_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  deposit_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  bank_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  matched_transaction_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'UNRECONCILED', -- UNRECONCILED, RECONCILED, EXCLUDED
  difference_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reconciled_at DATETIME NULL,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bank_recon_acc (company_id, bank_account_id, statement_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (bank_account_id) REFERENCES plastic_bank_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_transaction_id) REFERENCES plastic_bank_transactions(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 8. Supplier Ledger Table
CREATE TABLE IF NOT EXISTS plastic_supplier_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  supplier_id INT NOT NULL,
  transaction_date DATE NOT NULL,
  reference_type VARCHAR(50) NOT NULL, -- PURCHASE_BILL, PAYMENT, DEBIT_NOTE, ADVANCE, OPENING_BALANCE
  reference_id INT NULL,
  reference_no VARCHAR(50) NOT NULL,
  debit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sup_ledger_company (company_id, supplier_id, transaction_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 9. Supplier Payments Table
CREATE TABLE IF NOT EXISTS plastic_supplier_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  payment_no VARCHAR(50) NOT NULL,
  supplier_id INT NOT NULL,
  purchase_bill_id INT NULL,
  bank_account_id INT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'BANK', -- BANK, CASH, UPI, CHEQUE, RTGS_NEFT
  reference_number VARCHAR(100) NULL,
  notes TEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_sup_payment_no (company_id, payment_no),
  INDEX idx_sup_payments_company (company_id, supplier_id),
  INDEX idx_sup_payments_bill (company_id, purchase_bill_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  FOREIGN KEY (purchase_bill_id) REFERENCES purchase_bills(id) ON DELETE SET NULL,
  FOREIGN KEY (bank_account_id) REFERENCES plastic_bank_accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 10. GST Audit Records Table (Input and Output GST)
CREATE TABLE IF NOT EXISTS plastic_gst_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  gst_type VARCHAR(20) NOT NULL, -- INPUT, OUTPUT
  transaction_type VARCHAR(50) NOT NULL, -- PURCHASE, SALE, CREDIT_NOTE, DEBIT_NOTE, ADVANCE
  reference_type VARCHAR(50) NOT NULL, -- invoices, purchase_bills, plastic_credit_notes, plastic_debit_notes
  reference_id INT NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  party_type VARCHAR(20) NOT NULL, -- SUPPLIER, CUSTOMER
  party_id INT NOT NULL,
  party_name VARCHAR(150) NOT NULL,
  party_gstin VARCHAR(30) NULL,
  place_of_supply VARCHAR(100) NULL,
  hsn_code VARCHAR(20) NULL,
  taxable_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cgst_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  cgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  sgst_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  sgst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  igst_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  igst_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_tax DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  itc_eligibility VARCHAR(30) NOT NULL DEFAULT 'ELIGIBLE', -- ELIGIBLE, INELIGIBLE, BLOCKED
  itc_reconciliation_status VARCHAR(30) NOT NULL DEFAULT 'UNMATCHED', -- MATCHED, UNMATCHED, REVIEW_REQUIRED
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gst_records_company (company_id, gst_type, invoice_date),
  INDEX idx_gst_records_ref (company_id, reference_type, reference_id),
  INDEX idx_gst_records_hsn (company_id, hsn_code),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 11. GST Reconciliation Items Table (Portal GSTR-2B vs Books)
CREATE TABLE IF NOT EXISTS plastic_gst_reconciliation_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  gst_record_id INT NULL,
  supplier_gstin VARCHAR(30) NULL,
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  portal_taxable_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  portal_tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  books_taxable_value DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  books_tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  difference_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'MISMATCH', -- MATCHED, PARTIAL, MISMATCH, MISSING
  notes TEXT NULL,
  reconciled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_gst_recon_company (company_id, status, invoice_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (gst_record_id) REFERENCES plastic_gst_records(id) ON DELETE SET NULL
);
