const path = require("path");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const runMigration003 = async () => {
  console.log("🚀 Starting Migration: 003_add_tax_enabled_to_business_settings...");

  const promiseDb = db.promise();

  try {
    // 1. Check if column exists
    console.log("Step 1: Checking tax_enabled column in business_settings...");
    const [cols] = await promiseDb.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'business_settings'
        AND COLUMN_NAME = 'tax_enabled'
    `);

    if (cols.length === 0) {
      console.log("Adding tax_enabled column (BOOLEAN NOT NULL DEFAULT TRUE) to business_settings...");
      await promiseDb.query(`
        ALTER TABLE business_settings
        ADD COLUMN tax_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER default_tax_percent
      `);
      console.log("✅ tax_enabled column added successfully.");
    } else {
      console.log("ℹ️ tax_enabled column already exists:", cols[0]);
    }

    // 2. Ensure all existing records have tax_enabled = TRUE
    console.log("Step 2: Ensuring existing business_settings records are tax_enabled = TRUE...");
    const [updateResult] = await promiseDb.query(`
      UPDATE business_settings
      SET tax_enabled = TRUE
      WHERE tax_enabled IS NULL
    `);
    console.log(`✅ Verified/Updated records: ${updateResult.affectedRows} rows updated.`);

    // 3. Verification
    console.log("\n--- Verification of business_settings table ---");
    const [settings] = await promiseDb.query(`
      SELECT id, company_id, business_name, default_tax_percent, tax_enabled
      FROM business_settings
      ORDER BY id ASC
    `);
    console.table(settings);

    console.log("\n🎉 Migration 003 completed successfully!");
  } catch (err) {
    console.error("❌ Migration 003 failed:", err);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration003();
