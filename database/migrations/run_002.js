const path = require("path");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const runMigration002 = async () => {
  console.log("🚀 Starting Migration: 002_multi_tenant_data_isolation...");

  const promiseDb = db.promise();

  try {
    const tenantTables = [
      { name: "products", index: true },
      { name: "customers", index: true },
      { name: "invoices", index: true },
      { name: "invoice_items", index: true },
      { name: "business_settings", index: false },
    ];

    // 1. Add company_id to tenant tables
    for (const t of tenantTables) {
      console.log(`Checking company_id in ${t.name}...`);
      const [cols] = await promiseDb.query(`
        SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = 'company_id'
      `, [t.name]);

      if (cols.length === 0) {
        console.log(`Adding company_id to ${t.name}...`);
        if (t.index) {
          await promiseDb.query(`
            ALTER TABLE ${t.name}
            ADD COLUMN company_id INT NULL,
            ADD INDEX idx_${t.name}_company_id (company_id)
          `);
        } else {
          await promiseDb.query(`
            ALTER TABLE ${t.name}
            ADD COLUMN company_id INT NULL
          `);
        }
        console.log(`✅ company_id added to ${t.name}.`);
      } else {
        console.log(`ℹ️ company_id already exists in ${t.name}.`);
      }
    }

    // 2. Backfill existing demo data to company_id = 1
    console.log("\nBackfilling existing records to company_id = 1 (Demo Company)...");
    for (const t of tenantTables) {
      const [res] = await promiseDb.query(`
        UPDATE ${t.name}
        SET company_id = 1
        WHERE company_id IS NULL
      `);
      console.log(`✅ Backfilled ${t.name}: ${res.affectedRows} rows updated.`);
    }

    // 3. Ensure business_settings exists for company_id = 2
    console.log("\nChecking business settings for company_id = 2 (SmartBilling Main)...");
    const [settingsCompany2] = await promiseDb.query(
      "SELECT id FROM business_settings WHERE company_id = 2"
    );

    if (settingsCompany2.length === 0) {
      console.log("Inserting default business settings for company_id = 2...");
      await promiseDb.query(`
        INSERT INTO business_settings (
          company_id,
          business_name,
          tagline,
          address,
          phone,
          email,
          tax_number,
          default_tax_percent,
          currency,
          currency_symbol,
          terms_conditions
        ) VALUES (
          2,
          'SmartBilling Main',
          'Primary Business Account',
          'Corporate Office',
          '+91 9876543210',
          'admin@gmail.com',
          '24ABCDE1234F1Z5',
          18.00,
          'INR',
          '₹',
          'Goods once sold cannot be returned without valid terms.'
        )
      `);
      console.log("✅ Business settings for company_id = 2 created.");
    } else {
      console.log("ℹ️ Business settings for company_id = 2 already exists.");
    }

    // 4. Unique index on business_settings(company_id)
    console.log("\nChecking unique index on business_settings.company_id...");
    const [statRows] = await promiseDb.query(`
      SELECT INDEX_NAME
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'business_settings'
        AND INDEX_NAME = 'idx_business_settings_company_id'
    `);

    if (statRows.length === 0) {
      console.log("Adding UNIQUE index on business_settings(company_id)...");
      await promiseDb.query(`
        ALTER TABLE business_settings
        ADD UNIQUE INDEX idx_business_settings_company_id (company_id)
      `);
      console.log("✅ Unique index added.");
    } else {
      console.log("ℹ️ Unique index on business_settings(company_id) already exists.");
    }

    // 4.1 Compound unique index on invoices(company_id, invoice_no)
    console.log("\nUpdating invoice_no uniqueness for multi-tenancy...");
    const [invIndexes] = await promiseDb.query(
      "SHOW INDEX FROM invoices WHERE Key_name = 'invoice_no'"
    );
    if (invIndexes.length > 0) {
      console.log("Dropping global unique index invoice_no on invoices...");
      await promiseDb.query("ALTER TABLE invoices DROP INDEX invoice_no");
      console.log("✅ Dropped global unique index invoice_no.");
    }

    const [compInvIndexes] = await promiseDb.query(
      "SHOW INDEX FROM invoices WHERE Key_name = 'unique_company_invoice_no'"
    );
    if (compInvIndexes.length === 0) {
      console.log("Adding compound unique index unique_company_invoice_no (company_id, invoice_no)...");
      await promiseDb.query(
        "ALTER TABLE invoices ADD UNIQUE INDEX unique_company_invoice_no (company_id, invoice_no)"
      );
      console.log("✅ Added unique_company_invoice_no index.");
    } else {
      console.log("ℹ️ unique_company_invoice_no already exists.");
    }

    // 5. Foreign Key constraints
    console.log("\nEnsuring foreign key constraints to companies(id)...");
    const fkDefinitions = [
      { table: "products", name: "fk_products_company_id" },
      { table: "customers", name: "fk_customers_company_id" },
      { table: "invoices", name: "fk_invoices_company_id" },
      { table: "invoice_items", name: "fk_invoice_items_company_id" },
      { table: "business_settings", name: "fk_business_settings_company_id" },
    ];

    const [existingFks] = await promiseDb.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
    `);
    const constraintNames = existingFks.map((r) => r.CONSTRAINT_NAME);

    for (const fk of fkDefinitions) {
      if (!constraintNames.includes(fk.name)) {
        console.log(`Adding ${fk.name} on ${fk.table}...`);
        await promiseDb.query(`
          ALTER TABLE ${fk.table}
          ADD CONSTRAINT ${fk.name}
          FOREIGN KEY (company_id) REFERENCES companies(id)
          ON DELETE CASCADE
        `);
        console.log(`✅ ${fk.name} added.`);
      } else {
        console.log(`ℹ️ ${fk.name} already exists.`);
      }
    }

    // 6. Verification
    console.log("\n--- Verification of Data Isolation Schema ---");
    for (const t of tenantTables) {
      const [rows] = await promiseDb.query(`
        SELECT company_id, COUNT(*) AS count
        FROM ${t.name}
        GROUP BY company_id
      `);
      console.log(`${t.name} distribution by company_id:`, rows);
    }

    console.log("\n🎉 Migration 002 completed successfully!");
  } catch (err) {
    console.error("❌ Migration 002 failed:", err);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration002();
