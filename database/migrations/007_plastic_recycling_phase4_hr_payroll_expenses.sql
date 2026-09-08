-- SmartBilling Migration 007: Plastic Recycling ERP Phase 4
-- HR, Payroll, Workforce & Expense Management
-- Safety: IDEMPOTENT, NON-DESTRUCTIVE, NO DROPS, STRICT MULTI-TENANT ISOLATION

-- 1. Employees Master Table
CREATE TABLE IF NOT EXISTS plastic_employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NULL,
  full_name VARCHAR(200) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(100) NULL,
  department VARCHAR(100) NOT NULL DEFAULT 'Production',
  designation VARCHAR(100) NOT NULL DEFAULT 'Worker',
  joining_date DATE NOT NULL,
  employment_type VARCHAR(50) NOT NULL DEFAULT 'FULL_TIME',
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  emergency_contact_name VARCHAR(100) NULL,
  emergency_contact_phone VARCHAR(20) NULL,
  bank_name VARCHAR(100) NULL,
  bank_account_no VARCHAR(50) NULL,
  bank_ifsc VARCHAR(20) NULL,
  pan_number VARCHAR(20) NULL,
  aadhaar_number VARCHAR(20) NULL,
  address TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_emp_code (company_id, employee_code),
  INDEX idx_emp_company_status (company_id, status, department),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 2. Employee Salary Structure Master Table
CREATE TABLE IF NOT EXISTS plastic_employee_salaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  salary_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  hra DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  conveyance_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  medical_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  special_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  overtime_rate_per_hour DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pf_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  esic_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  professional_tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  effective_from DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_emp_sal_company (company_id, employee_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE
);

-- 3. Daily Employee Attendance Records Table
CREATE TABLE IF NOT EXISTS plastic_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  shift_id INT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRESENT',
  check_in TIME NULL,
  check_out TIME NULL,
  working_hours DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  overtime_hours DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  notes VARCHAR(255) NULL,
  marked_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_emp_date (company_id, employee_id, attendance_date),
  INDEX idx_attendance_date (company_id, attendance_date, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (shift_id) REFERENCES plastic_shifts(id) ON DELETE SET NULL,
  FOREIGN KEY (marked_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 4. Leave Types Master Table
CREATE TABLE IF NOT EXISTS plastic_leave_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  annual_quota INT NOT NULL DEFAULT 12,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_leave_code (company_id, code),
  INDEX idx_leave_types_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 5. Employee Annual Leave Balances Table
CREATE TABLE IF NOT EXISTS plastic_leave_balances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  year INT NOT NULL,
  total_allocated INT NOT NULL DEFAULT 12,
  used DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  balance DECIMAL(5,2) NOT NULL DEFAULT 12.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_emp_leave_year (company_id, employee_id, leave_type_id, year),
  INDEX idx_leave_bal_company (company_id, employee_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES plastic_leave_types(id) ON DELETE CASCADE
);

-- 6. Leave Applications and Requests Table
CREATE TABLE IF NOT EXISTS plastic_leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  leave_type_id INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  approved_by INT NULL,
  approval_date DATETIME NULL,
  rejection_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_leave_req_company (company_id, status, start_date),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (leave_type_id) REFERENCES plastic_leave_types(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 7. Employee Salary Advances and Recovery Tracking Table
CREATE TABLE IF NOT EXISTS plastic_employee_advances (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  advance_no VARCHAR(50) NOT NULL,
  employee_id INT NOT NULL,
  advance_amount DECIMAL(12,2) NOT NULL,
  advance_date DATE NOT NULL,
  reason VARCHAR(255) NULL,
  recovery_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  outstanding_amount DECIMAL(12,2) NOT NULL,
  monthly_installment DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  notes TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_advance_no (company_id, advance_no),
  INDEX idx_advances_emp (company_id, employee_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 8. Monthly Payroll Runs / Batches Master Table
CREATE TABLE IF NOT EXISTS plastic_payrolls (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  payroll_batch_no VARCHAR(50) NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_employees INT NOT NULL DEFAULT 0,
  total_gross_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_advances_recovered DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_net_salary DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  total_overtime_pay DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  payment_date DATE NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  notes TEXT NULL,
  processed_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_payroll_month (company_id, year, month),
  INDEX idx_payrolls_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES admins(id) ON DELETE SET NULL
);

-- 9. Monthly Payroll Payslips / Items Table
CREATE TABLE IF NOT EXISTS plastic_payroll_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  payroll_id INT NOT NULL,
  employee_id INT NOT NULL,
  payslip_no VARCHAR(50) NOT NULL,
  base_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  present_days DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  absent_days DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  half_days DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  paid_leaves DECIMAL(4,1) NOT NULL DEFAULT 0.0,
  overtime_hours DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  earned_basic DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  allowances DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  overtime_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  bonus_incentive DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  gross_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  pf_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  esic_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pt_deduction DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  advance_recovery DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  other_deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  net_salary DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  payment_mode VARCHAR(30) NULL,
  payment_reference VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_payslip_no (company_id, payslip_no),
  UNIQUE KEY unique_company_payroll_emp (company_id, payroll_id, employee_id),
  INDEX idx_payroll_items_emp (company_id, employee_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (payroll_id) REFERENCES plastic_payrolls(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE CASCADE
);

-- 10. Plant Expense Categories Master Table
CREATE TABLE IF NOT EXISTS plastic_expense_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_exp_code (company_id, code),
  INDEX idx_exp_cat_company (company_id, status),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- 11. Plant Expenses Records Table
CREATE TABLE IF NOT EXISTS plastic_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  expense_no VARCHAR(50) NOT NULL,
  category_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT NULL,
  payment_mode VARCHAR(30) NOT NULL DEFAULT 'CASH',
  reference_no VARCHAR(100) NULL,
  vendor_name VARCHAR(150) NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_company_exp_no (company_id, expense_no),
  INDEX idx_expenses_date (company_id, expense_date, category_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES plastic_expense_categories(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
);
