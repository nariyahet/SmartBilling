const path = require("path");
const db = require(path.resolve(__dirname, "../../server/config/db"));

async function runMigration() {
  console.log("==========================================================");
  console.log("  Running Migration 011: Add Opening Stock to Raw Materials");
  console.log("==========================================================");

  const conn = db.promise();

  try {
    // Check if columns already exist
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raw_materials' 
         AND COLUMN_NAME IN ('opening_stock', 'opening_stock_rate', 'opening_stock_date')`
    );

    const existingCols = cols.map((c) => c.COLUMN_NAME);

    if (existingCols.length === 3) {
      console.log("ℹ️ Columns opening_stock, opening_stock_rate, opening_stock_date already exist in raw_materials.");
    } else {
      console.log("Applying columns to raw_materials table...");
      
      if (!existingCols.includes("opening_stock")) {
        await conn.query(`ALTER TABLE raw_materials ADD COLUMN opening_stock DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER unit`);
        console.log("✅ Added column: opening_stock");
      }
      
      if (!existingCols.includes("opening_stock_rate")) {
        await conn.query(`ALTER TABLE raw_materials ADD COLUMN opening_stock_rate DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER opening_stock`);
        console.log("✅ Added column: opening_stock_rate");
      }
      
      if (!existingCols.includes("opening_stock_date")) {
        await conn.query(`ALTER TABLE raw_materials ADD COLUMN opening_stock_date DATE NULL AFTER opening_stock_rate`);
        console.log("✅ Added column: opening_stock_date");
      }
    }

    // Verify
    const [finalCols] = await conn.query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raw_materials' 
         AND COLUMN_NAME IN ('opening_stock', 'opening_stock_rate', 'opening_stock_date')`
    );

    console.log("\nVerified columns in raw_materials:");
    console.table(finalCols);

    console.log("\n==========================================================");
    console.log("  Migration 011 Completed Successfully!");
    console.log("==========================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration 011 Failed:", error);
    process.exit(1);
  }
}

runMigration();
