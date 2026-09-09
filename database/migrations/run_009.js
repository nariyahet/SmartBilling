const path = require("path");
const fs = require("fs");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const REQUIRED_TABLES = [
  "plastic_purchase_requisitions",
  "plastic_purchase_requisition_items",
  "plastic_supplier_quotations",
  "plastic_supplier_quotation_items",
  "plastic_purchase_orders",
  "plastic_purchase_order_items",
  "plastic_purchase_deliveries",
  "plastic_supplier_performance",
  "plastic_purchase_rate_history",
  "plastic_material_requirements",
];

async function runMigration() {
  console.log("==========================================================");
  console.log("  Running Migration 009: Phase 6 Procurement & Vendor ERP");
  console.log("==========================================================");

  const conn = db.promise();

  try {
    const sqlPath = path.resolve(__dirname, "009_plastic_recycling_phase6_procurement.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    // Split SQL by statements, removing comments
    const statements = sqlContent
      .replace(/--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`Found ${statements.length} SQL table statements to execute.\n`);

    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith("CREATE TABLE")) {
        const match = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
        const tableName = match ? match[1] : "unknown";
        console.log(`Applying definition for table: ${tableName}...`);
        await conn.query(stmt);
        console.log(`✅ Table verified/created: ${tableName}`);
      }
    }

    // Optional column additions to existing tables (Idempotent)
    const [pbCols] = await conn.query("SHOW COLUMNS FROM purchase_bills LIKE 'purchase_order_id'");
    if (pbCols.length === 0) {
      console.log("Adding optional column purchase_order_id to purchase_bills...");
      await conn.query("ALTER TABLE purchase_bills ADD COLUMN purchase_order_id INT NULL, ADD INDEX idx_pb_po_id (purchase_order_id)");
    }

    const [tiCols] = await conn.query("SHOW COLUMNS FROM truck_inwards LIKE 'purchase_order_id'");
    if (tiCols.length === 0) {
      console.log("Adding optional column purchase_order_id to truck_inwards...");
      await conn.query("ALTER TABLE truck_inwards ADD COLUMN purchase_order_id INT NULL, ADD INDEX idx_ti_po_id (purchase_order_id)");
    }

    // Verify all 10 required tables exist
    console.log("Verifying newly created Phase 6 tables...");
    for (const tbl of REQUIRED_TABLES) {
      const [rows] = await conn.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [tbl]
      );
      if (rows.length === 0) {
        throw new Error(`Table ${tbl} was not found after migration!`);
      }
      console.log(`  ✓ Table ${tbl} exists.`);
    }

    console.log("\n==========================================================");
    console.log("✅ Migration 009 Completed Successfully with 0 Errors!");
    console.log("==========================================================");
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration 009 failed:", error);
    process.exit(1);
  }
}

runMigration();
