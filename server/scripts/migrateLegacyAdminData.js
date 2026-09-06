const db = require('../config/db');

async function migrate() {
  const conn = db.promise();

  try {
    await conn.beginTransaction();

    console.log('\n🔍 Checking production data...\n');

    // Verify companies
    const [companies] = await conn.query(`
      SELECT id, name, is_demo, owner_admin_id, status
      FROM companies
      WHERE id IN (1, 2)
      ORDER BY id
      FOR UPDATE
    `);

    if (companies.length !== 2) {
      throw new Error('Expected Demo Company (1) and SmartBilling Main (2).');
    }

    console.table(companies);

    // Verify legacy customer
    const [customers] = await conn.query(`
      SELECT id, name, email, company_id
      FROM customers
      WHERE id = 11
      FOR UPDATE
    `);

    if (
      customers.length !== 1 ||
      customers[0].company_id !== null
    ) {
      throw new Error(
        'Customer #11 is not in the expected legacy state.'
      );
    }

    // Verify legacy invoices
    const [invoices] = await conn.query(`
      SELECT id, invoice_no, customer_id, company_id, grand_total
      FROM invoices
      WHERE id IN (17, 18, 19)
      ORDER BY id
      FOR UPDATE
    `);

    if (
      invoices.length !== 3 ||
      invoices.some(i => i.company_id !== null || i.customer_id !== 11)
    ) {
      throw new Error(
        'Invoices 17-19 are not in the expected legacy state.'
      );
    }

    // Verify legacy invoice items
    const [items] = await conn.query(`
      SELECT id, invoice_id, product_id, product_name, quantity, price, total, company_id
      FROM invoice_items
      WHERE id IN (17, 18, 19)
      ORDER BY id
      FOR UPDATE
    `);

    if (
      items.length !== 3 ||
      items.some(i => i.company_id !== null || i.product_id !== 7)
    ) {
      throw new Error(
        'Invoice items 17-19 are not in the expected legacy state.'
      );
    }

    // Verify Demo product #7
    const [products] = await conn.query(`
      SELECT id, name, price, stock, company_id
      FROM products
      WHERE id = 7
      FOR UPDATE
    `);

    if (
      products.length !== 1 ||
      products[0].company_id !== 1
    ) {
      throw new Error(
        'Demo product #7 is not in the expected state.'
      );
    }

    const demoProduct = products[0];

    console.log('✅ Legacy data checks passed.');
    console.log('🔒 Demo Product #7 will NOT be modified.');

    // Create Admin-owned copy of the legacy product
    const [cloneResult] = await conn.query(`
      INSERT INTO products
        (name, price, stock, company_id)
      VALUES
        (?, ?, ?, 2)
    `, [
      demoProduct.name,
      demoProduct.price,
      demoProduct.stock
    ]);

    const adminProductId = cloneResult.insertId;

    console.log(`✅ Created Admin product clone: #${adminProductId}`);

    // Move customer to Admin company
    await conn.query(`
      UPDATE customers
      SET company_id = 2
      WHERE id = 11 AND company_id IS NULL
    `);

    // Move invoices to Admin company
    await conn.query(`
      UPDATE invoices
      SET company_id = 2
      WHERE id IN (17, 18, 19)
        AND company_id IS NULL
        AND customer_id = 11
    `);

    // Move invoice items and re-point product to Admin clone
    await conn.query(`
      UPDATE invoice_items
      SET company_id = 2,
          product_id = ?
      WHERE id IN (17, 18, 19)
        AND company_id IS NULL
        AND product_id = 7
    `, [adminProductId]);

    // Final verification inside transaction
    const [verifyCustomer] = await conn.query(`
      SELECT id, name, company_id
      FROM customers
      WHERE id = 11
    `);

    const [verifyInvoices] = await conn.query(`
      SELECT id, invoice_no, company_id, customer_id
      FROM invoices
      WHERE id IN (17, 18, 19)
      ORDER BY id
    `);

    const [verifyItems] = await conn.query(`
      SELECT id, invoice_id, product_id, company_id
      FROM invoice_items
      WHERE id IN (17, 18, 19)
      ORDER BY id
    `);

    console.log('\n📋 Final verification:');
    console.table(verifyCustomer);
    console.table(verifyInvoices);
    console.table(verifyItems);

    if (
      verifyCustomer.length !== 1 ||
      verifyCustomer[0].company_id !== 2 ||
      verifyInvoices.some(i => i.company_id !== 2) ||
      verifyItems.some(i => i.company_id !== 2 || i.product_id !== adminProductId)
    ) {
      throw new Error('Final verification failed. Rolling back.');
    }

    await conn.commit();

    console.log('\n🎉 MIGRATION SUCCESSFUL');
    console.log(`Admin Product Clone ID: ${adminProductId}`);
    console.log('Customer #11 → company_id 2');
    console.log('Invoices 17-19 → company_id 2');
    console.log(`Invoice Items 17-19 → company_id 2 + product #${adminProductId}`);
    console.log('Demo Product #7 remains company_id 1.');
  } catch (error) {
    await conn.rollback();

    console.error('\n❌ MIGRATION FAILED');
    console.error('🔄 ALL changes were rolled back.');
    console.error(error.message);

    process.exitCode = 1;
  } finally {
    await conn.end();
    await db.end();
  }
}

migrate();
