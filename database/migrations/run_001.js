const path = require("path");
const db = require(path.resolve(__dirname, "../../server/config/db"));

const runMigration = async () => {
  console.log("🚀 Starting Migration: 001_multi_tenant_foundation...");

  const promiseDb = db.promise();

  try {
    // 1. Create companies table
    console.log("Step 1: Creating companies table if not exists...");
    await promiseDb.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        owner_admin_id INT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        is_demo TINYINT(1) NOT NULL DEFAULT 0,
        trial_start_at DATETIME NULL,
        trial_end_at DATETIME NULL,
        subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_companies_slug (slug),
        INDEX idx_companies_status (status)
      )
    `);
    console.log("✅ companies table ready.");

    // 2. Check and add company_id to admins
    console.log("Step 2: Checking company_id column in admins...");
    const [cols] = await promiseDb.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'admins'
        AND COLUMN_NAME = 'company_id'
    `);

    if (cols.length === 0) {
      console.log("Adding company_id column and index to admins table...");
      await promiseDb.query(`
        ALTER TABLE admins
        ADD COLUMN company_id INT NULL,
        ADD INDEX idx_admins_company_id (company_id)
      `);
      console.log("✅ company_id added to admins.");
    } else {
      console.log("ℹ️ company_id column already exists on admins.");
    }

    // 3. Insert Demo Company if not exists
    console.log("Step 3: Checking Demo Company...");
    const [demoComp] = await promiseDb.query(
      `SELECT id, name, slug FROM companies WHERE slug = ?`,
      ["demo-company"]
    );
    if (demoComp.length === 0) {
      console.log("Inserting Demo Company...");
      await promiseDb.query(`
        INSERT INTO companies (name, slug, owner_admin_id, status, is_demo, subscription_status)
        VALUES ('Demo Company', 'demo-company', NULL, 'active', 1, 'active')
      `);
      console.log("✅ Demo Company created.");
    } else {
      console.log("ℹ️ Demo Company already exists (id:", demoComp[0].id, ")");
    }

    // 4. Insert SmartBilling Main Company if not exists
    console.log("Step 4: Checking SmartBilling Main Company...");
    const [mainComp] = await promiseDb.query(
      `SELECT id, name, slug FROM companies WHERE slug = ?`,
      ["smartbilling-main"]
    );
    if (mainComp.length === 0) {
      console.log("Inserting SmartBilling Main Company...");
      await promiseDb.query(`
        INSERT INTO companies (name, slug, owner_admin_id, status, is_demo, subscription_status)
        VALUES ('SmartBilling Main', 'smartbilling-main', NULL, 'active', 0, 'active')
      `);
      console.log("✅ SmartBilling Main Company created.");
    } else {
      console.log("ℹ️ SmartBilling Main Company already exists (id:", mainComp[0].id, ")");
    }

    // Fetch company IDs
    const [allCompanies] = await promiseDb.query(
      `SELECT id, slug FROM companies WHERE slug IN ('demo-company', 'smartbilling-main')`
    );
    const demoCompanyId = allCompanies.find((c) => c.slug === "demo-company")?.id;
    const mainCompanyId = allCompanies.find((c) => c.slug === "smartbilling-main")?.id;

    // 5. Attach existing demo admin to Demo Company
    console.log("Step 5: Attaching demo admin to Demo Company...");
    if (demoCompanyId) {
      await promiseDb.query(
        `UPDATE admins SET company_id = ? WHERE email = 'demo@smartbilling.com'`,
        [demoCompanyId]
      );
      console.log("✅ Demo admin attached to Demo Company (company_id: " + demoCompanyId + ").");
    }

    // 6. Attach existing main admin to SmartBilling Main
    console.log("Step 6: Attaching main admin to SmartBilling Main...");
    if (mainCompanyId) {
      await promiseDb.query(
        `UPDATE admins SET company_id = ? WHERE email = 'admin@gmail.com'`,
        [mainCompanyId]
      );
      console.log("✅ Main admin attached to SmartBilling Main (company_id: " + mainCompanyId + ").");
    }

    // 7. Fallback: attach any remaining admins to demo company
    if (demoCompanyId) {
      await promiseDb.query(
        `UPDATE admins SET company_id = ? WHERE company_id IS NULL`,
        [demoCompanyId]
      );
    }

    // 8. Update owner_admin_id in companies
    console.log("Step 8: Updating owner_admin_id in companies...");
    const [admins] = await promiseDb.query(`SELECT id, email FROM admins`);
    const demoAdmin = admins.find((a) => a.email === "demo@smartbilling.com");
    const mainAdmin = admins.find((a) => a.email === "admin@gmail.com");

    if (demoAdmin && demoCompanyId) {
      await promiseDb.query(
        `UPDATE companies SET owner_admin_id = ? WHERE id = ? AND owner_admin_id IS NULL`,
        [demoAdmin.id, demoCompanyId]
      );
    }
    if (mainAdmin && mainCompanyId) {
      await promiseDb.query(
        `UPDATE companies SET owner_admin_id = ? WHERE id = ? AND owner_admin_id IS NULL`,
        [mainAdmin.id, mainCompanyId]
      );
    }

    // 9. Foreign key constraints
    console.log("Step 9: Ensuring Foreign Key constraints...");
    const [constraints] = await promiseDb.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME IN ('fk_admins_company_id', 'fk_companies_owner_admin_id')
    `);
    const constraintNames = constraints.map((c) => c.CONSTRAINT_NAME);

    if (!constraintNames.includes("fk_admins_company_id")) {
      console.log("Adding fk_admins_company_id...");
      await promiseDb.query(`
        ALTER TABLE admins
        ADD CONSTRAINT fk_admins_company_id
        FOREIGN KEY (company_id) REFERENCES companies(id)
        ON DELETE SET NULL
      `);
      console.log("✅ fk_admins_company_id added.");
    } else {
      console.log("ℹ️ fk_admins_company_id already present.");
    }

    if (!constraintNames.includes("fk_companies_owner_admin_id")) {
      console.log("Adding fk_companies_owner_admin_id...");
      await promiseDb.query(`
        ALTER TABLE companies
        ADD CONSTRAINT fk_companies_owner_admin_id
        FOREIGN KEY (owner_admin_id) REFERENCES admins(id)
        ON DELETE SET NULL
      `);
      console.log("✅ fk_companies_owner_admin_id added.");
    } else {
      console.log("ℹ️ fk_companies_owner_admin_id already present.");
    }

    // Verification queries
    console.log("\n--- Verification ---");
    const [companiesResult] = await promiseDb.query(`SELECT * FROM companies`);
    console.log("Companies:", companiesResult);

    const [adminsResult] = await promiseDb.query(
      `SELECT a.id, a.name, a.email, a.company_id, c.name AS company_name, c.slug, c.is_demo
       FROM admins a
       LEFT JOIN companies c ON a.company_id = c.id`
    );
    console.log("Admins with Companies:", adminsResult);

    console.log("\n🎉 Migration 001 completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    db.end();
  }
};

runMigration();
