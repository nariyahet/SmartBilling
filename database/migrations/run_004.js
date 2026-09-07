const path = require("path");
const fs = require("fs");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const REQUIRED_TABLES = [
  "suppliers",
  "raw_materials",
  "truck_inwards",
  "weighments",
  "purchase_bills",
  "purchase_bill_items",
  "raw_material_stock",
  "raw_material_stock_movements",
];

const runMigration004 = async () => {
  console.log("=================================================================");
  console.log("🚀 Starting Migration: 004_plastic_recycling_phase1_foundation...");
  console.log("=================================================================\n");

  const promiseDb = db.promise();

  try {
    const sqlPath = path.resolve(
      __dirname,
      "004_plastic_recycling_phase1_foundation.sql"
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

    console.log("\n--- Verification: Checking All Phase 1 Tables in Schema ---");
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

    console.log("\n🎉 Migration 004 completed successfully! All Phase 1 tables are ready.\n");
  } catch (err) {
    console.error("❌ Migration 004 failed:", err);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration004();
