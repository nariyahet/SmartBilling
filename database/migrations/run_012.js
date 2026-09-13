const path = require("path");
const db = require(path.resolve(__dirname, "../../server/config/db"));

async function runMigration() {
  console.log("==========================================================");
  console.log("  Running Migration 012: Decimal Precision & Invoice Schema");
  console.log("==========================================================");

  const conn = db.promise();

  try {
    // 1. Check and modify invoice_items.quantity to DECIMAL(12,3)
    const [itemQtyCol] = await conn.query(
      `SELECT DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoice_items' AND COLUMN_NAME = 'quantity'`
    );

    if (itemQtyCol.length > 0 && itemQtyCol[0].DATA_TYPE.toLowerCase() !== "decimal") {
      console.log("Modifying invoice_items.quantity to DECIMAL(12,3)...");
      await conn.query(`ALTER TABLE invoice_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000`);
      console.log("✅ Modified invoice_items.quantity to DECIMAL(12,3)");
    } else {
      console.log("ℹ️ invoice_items.quantity is already DECIMAL precision.");
    }

    // 2. Check and modify products.stock to DECIMAL(12,3)
    const [prodStockCol] = await conn.query(
      `SELECT DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'stock'`
    );

    if (prodStockCol.length > 0 && prodStockCol[0].DATA_TYPE.toLowerCase() !== "decimal") {
      console.log("Modifying products.stock to DECIMAL(12,3)...");
      await conn.query(`ALTER TABLE products MODIFY COLUMN stock DECIMAL(12,3) NOT NULL DEFAULT 0.000`);
      console.log("✅ Modified products.stock to DECIMAL(12,3)");
    } else {
      console.log("ℹ️ products.stock is already DECIMAL precision.");
    }

    // 3. Check and add invoices Phase 3 extension columns
    const [invCols] = await conn.query(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'invoices'`
    );
    const existingInvCols = invCols.map((c) => c.COLUMN_NAME.toLowerCase());

    if (!existingInvCols.includes("sales_order_id")) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN sales_order_id INT NULL`);
      await conn.query(`ALTER TABLE invoices ADD INDEX idx_invoices_sales_order_id (sales_order_id)`);
      console.log("✅ Added sales_order_id to invoices");
    }

    if (!existingInvCols.includes("dispatch_id")) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN dispatch_id INT NULL`);
      await conn.query(`ALTER TABLE invoices ADD INDEX idx_invoices_dispatch_id (dispatch_id)`);
      console.log("✅ Added dispatch_id to invoices");
    }

    if (!existingInvCols.includes("payment_status")) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID'`);
      await conn.query(`ALTER TABLE invoices ADD INDEX idx_invoices_payment_status (payment_status)`);
      console.log("✅ Added payment_status to invoices");
    }

    if (!existingInvCols.includes("paid_amount")) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00`);
      console.log("✅ Added paid_amount to invoices");
    }

    if (!existingInvCols.includes("due_date")) {
      await conn.query(`ALTER TABLE invoices ADD COLUMN due_date DATE NULL`);
      console.log("✅ Added due_date to invoices");
    }

    console.log("\n==========================================================");
    console.log("  Migration 012 Completed Successfully!");
    console.log("==========================================================");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration 012 Failed:", error);
    process.exit(1);
  }
}

runMigration();
