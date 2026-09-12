const path = require("path");
const fs = require("fs");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const REQUIRED_TABLES = [
  "internal_eway_bills",
  "internal_eway_bill_items",
];

async function runMigration() {
  console.log("==========================================================");
  console.log("  Running Migration 010: Practical Internal E-Way Bills");
  console.log("==========================================================");

  const conn = db.promise();

  try {
    const sqlPath = path.resolve(__dirname, "010_internal_eway_bills.sql");
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

    // Verify all required tables exist
    console.log("\nVerifying newly created Internal E-Way Bill tables...");
    for (const tbl of REQUIRED_TABLES) {
      const [rows] = await conn.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [tbl]
      );
      if (rows.length === 0) {
        throw new Error(`Table ${tbl} was not found after migration!`);
      }
      console.log(`✅ Verified table exists in database: ${tbl}`);
    }

    console.log("\n==========================================================");
    console.log("  Migration 010 Completed Successfully!");
    console.log("==========================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration 010 Failed:", error);
    process.exit(1);
  }
}

runMigration();
