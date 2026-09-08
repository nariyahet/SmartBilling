const path = require("path");
const fs = require("fs");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const REQUIRED_TABLES = [
  "plastic_sales_orders",
  "plastic_sales_order_items",
  "plastic_fg_reservations",
  "plastic_vehicles",
  "plastic_dispatches",
  "plastic_dispatch_items",
  "plastic_delivery_challans",
  "plastic_delivery_challan_items",
  "plastic_sales_stock_movements",
  "plastic_payments",
  "plastic_customer_ledger",
  "plastic_sales_returns",
  "plastic_sales_return_items",
  "plastic_credit_notes",
  "plastic_credit_note_items",
  "plastic_debit_notes",
  "plastic_debit_note_items",
];

const runMigration006 = async () => {
  console.log("=================================================================");
  console.log("🚀 Starting Migration: 006_plastic_recycling_phase3_sales_finance...");
  console.log("=================================================================\n");

  const promiseDb = db.promise();

  try {
    const sqlPath = path.resolve(
      __dirname,
      "006_plastic_recycling_phase3_sales_finance.sql"
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

    console.log("\n--- Checking and applying additive columns to existing invoices table ---");

    // Check existing columns on invoices
    const [invoiceColumns] = await promiseDb.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'
    `);
    const existingColNames = invoiceColumns.map((c) => c.COLUMN_NAME.toLowerCase());

    if (!existingColNames.includes("sales_order_id")) {
      console.log("Adding column sales_order_id to invoices...");
      await promiseDb.query("ALTER TABLE invoices ADD COLUMN sales_order_id INT NULL");
      await promiseDb.query("ALTER TABLE invoices ADD INDEX idx_invoices_sales_order_id (sales_order_id)");
      console.log("✅ Added sales_order_id column to invoices.");
    }

    if (!existingColNames.includes("dispatch_id")) {
      console.log("Adding column dispatch_id to invoices...");
      await promiseDb.query("ALTER TABLE invoices ADD COLUMN dispatch_id INT NULL");
      await promiseDb.query("ALTER TABLE invoices ADD INDEX idx_invoices_dispatch_id (dispatch_id)");
      console.log("✅ Added dispatch_id column to invoices.");
    }

    if (!existingColNames.includes("payment_status")) {
      console.log("Adding column payment_status to invoices...");
      await promiseDb.query("ALTER TABLE invoices ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'");
      await promiseDb.query("ALTER TABLE invoices ADD INDEX idx_invoices_payment_status (payment_status)");
      console.log("✅ Added payment_status column to invoices.");
    }

    if (!existingColNames.includes("paid_amount")) {
      console.log("Adding column paid_amount to invoices...");
      await promiseDb.query("ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00");
      console.log("✅ Added paid_amount column to invoices.");
    }

    if (!existingColNames.includes("due_date")) {
      console.log("Adding column due_date to invoices...");
      await promiseDb.query("ALTER TABLE invoices ADD COLUMN due_date DATE NULL");
      console.log("✅ Added due_date column to invoices.");
    }

    console.log("\n--- Verification: Checking All Phase 3 Tables in Schema ---");
    const [existingTables] = await promiseDb.query(`
      SELECT TABLE_NAME, TABLE_ROWS
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${REQUIRED_TABLES.map(() => "?").join(",")})
      ORDER BY TABLE_NAME ASC
    `, REQUIRED_TABLES);

    console.table(existingTables);

    const foundNames = existingTables.map((t) => t.TABLE_NAME);
    const missing = REQUIRED_TABLES.filter((t) => !foundNames.includes(t));

    if (missing.length > 0) {
      throw new Error(`Migration incomplete. Missing tables: ${missing.join(", ")}`);
    }

    console.log(`\n🎉 Migration 006 completed successfully! All ${REQUIRED_TABLES.length} Phase 3 tables and invoice extensions are ready.\n`);
  } catch (err) {
    console.error("❌ Migration 006 failed:", err);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration006();
