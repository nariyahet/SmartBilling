const path = require("path");
const fs = require("fs");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const REQUIRED_TABLES = [
  "plastic_employees",
  "plastic_employee_salaries",
  "plastic_attendance",
  "plastic_leave_types",
  "plastic_leave_balances",
  "plastic_leave_requests",
  "plastic_employee_advances",
  "plastic_payrolls",
  "plastic_payroll_items",
  "plastic_expense_categories",
  "plastic_expenses",
];

const DEFAULT_LEAVE_TYPES = [
  { name: "Casual Leave", code: "CL", annual_quota: 12, is_paid: 1 },
  { name: "Sick Leave", code: "SL", annual_quota: 7, is_paid: 1 },
  { name: "Earned / Privilege Leave", code: "EL", annual_quota: 15, is_paid: 1 },
  { name: "Leave Without Pay", code: "LWP", annual_quota: 0, is_paid: 0 },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Factory Expenses", code: "EXP_FACTORY", description: "Shop floor consumables, packaging, and plant utilities" },
  { name: "Transport & Logistics", code: "EXP_TRANSPORT", description: "Truck fuel, inward/outward freight, toll charges" },
  { name: "Electricity & Power", code: "EXP_ELECTRICITY", description: "High-tension power bills, DG diesel, power maintenance" },
  { name: "Machine Maintenance", code: "EXP_MAINTENANCE", description: "Spare parts, hydraulic oil, blade sharpening, motor repairs" },
  { name: "Labour & Worker Welfare", code: "EXP_LABOUR", description: "Overtime food, tea/refreshments, PPE safety gear, medical" },
  { name: "Office & Admin", code: "EXP_OFFICE", description: "Stationery, internet, printing, security services" },
  { name: "Miscellaneous", code: "EXP_MISC", description: "General unanticipated operational expenses" },
];

const runMigration007 = async () => {
  console.log("=================================================================");
  console.log("🚀 Starting Migration: 007_plastic_recycling_phase4_hr_payroll_expenses...");
  console.log("=================================================================\n");

  const promiseDb = db.promise();

  try {
    const sqlPath = path.resolve(
      __dirname,
      "007_plastic_recycling_phase4_hr_payroll_expenses.sql"
    );
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Remove comments and split into individual statements
    const statements = sqlContent
      .replace(/--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Found ${statements.length} SQL table creation statements to execute.\n`);

    for (const statement of statements) {
      const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      const tableName = match ? match[1] : "unknown";

      console.log(`Applying definition for table: ${tableName}...`);
      await promiseDb.query(statement);
      console.log(`✅ Table verified/created: ${tableName}`);
    }

    console.log("\n--- Checking and applying additive employee_id column to plastic_operators table ---");
    const [operatorCols] = await promiseDb.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'plastic_operators' AND COLUMN_NAME = 'employee_id'
    `);

    if (operatorCols.length === 0) {
      console.log("Adding employee_id column to plastic_operators...");
      await promiseDb.query(`
        ALTER TABLE plastic_operators
        ADD COLUMN employee_id INT NULL AFTER mobile,
        ADD INDEX idx_operators_emp (company_id, employee_id),
        ADD CONSTRAINT fk_operator_employee FOREIGN KEY (employee_id) REFERENCES plastic_employees(id) ON DELETE SET NULL
      `);
      console.log("✅ Column employee_id added to plastic_operators.");
    } else {
      console.log("ℹ️ Column employee_id already exists on plastic_operators.");
    }

    console.log("\n--- Seeding standard leave types and expense categories for companies ---");
    const [companies] = await promiseDb.query("SELECT id FROM companies");

    for (const comp of companies) {
      for (const lt of DEFAULT_LEAVE_TYPES) {
        await promiseDb.query(
          `INSERT IGNORE INTO plastic_leave_types (company_id, name, code, annual_quota, is_paid)
           VALUES (?, ?, ?, ?, ?)`,
          [comp.id, lt.name, lt.code, lt.annual_quota, lt.is_paid]
        );
      }
      for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
        await promiseDb.query(
          `INSERT IGNORE INTO plastic_expense_categories (company_id, name, code, description)
           VALUES (?, ?, ?, ?)`,
          [comp.id, cat.name, cat.code, cat.description]
        );
      }
    }
    console.log(`✅ Seeded default leave types and expense categories for ${companies.length} companies.`);

    console.log("\n--- Verifying all 11 required Phase 4 tables exist ---");
    const [tables] = await promiseDb.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);
    const tableNames = tables.map((t) => t.table_name || t.TABLE_NAME);

    const missingTables = REQUIRED_TABLES.filter((t) => !tableNames.includes(t));
    if (missingTables.length > 0) {
      throw new Error(`Migration incomplete! Missing tables: ${missingTables.join(", ")}`);
    }

    console.log("✅ All 11 Phase 4 tables confirmed present in the database:");
    REQUIRED_TABLES.forEach((t) => console.log(`   - ${t}`));

    console.log("\n🎉 Phase 4 Migration completed successfully with ZERO errors!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration 007 Error:", error);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration007();
