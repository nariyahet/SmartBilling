const assert = require("assert");
const path = require("path");
const db = require(path.resolve(__dirname, "../config/db"));

const BASE_URL = "http://localhost:5000/api";

const cleanupCompany2 = async () => {
  const pdb = db.promise();
  await pdb.query("DELETE FROM invoice_items WHERE company_id = 2");
  await pdb.query("DELETE FROM invoices WHERE company_id = 2");
  await pdb.query("DELETE FROM products WHERE company_id = 2");
  await pdb.query("DELETE FROM customers WHERE company_id = 2");
};

const runTests = async () => {
  console.log("🔒 Starting Multi-Tenant Data Isolation Test Suite...\n");
  await cleanupCompany2();

  // 1. Unauthenticated Route Protection (401 checks)
  console.log("Test 1: Unauthenticated request rejection (401)...");
  const unauthEndpoints = [
    { url: "/products", method: "GET" },
    { url: "/customers", method: "GET" },
    { url: "/invoices", method: "GET" },
    { url: "/dashboard", method: "GET" },
    { url: "/business-settings", method: "GET" },
    { url: "/invoices/new", method: "GET" },
  ];

  for (const ep of unauthEndpoints) {
    const res = await fetch(BASE_URL + ep.url, { method: ep.method });
    assert.strictEqual(
      res.status,
      401,
      `Expected 401 for unauthenticated ${ep.method} ${ep.url}, got ${res.status}`
    );
  }
  console.log("✅ All 6 tenant endpoints reject unauthenticated requests with 401.");

  // 2. Login as Demo Admin (Company 1)
  console.log("\nTest 2: Authenticate Demo Admin (Company 1)...");
  const demoLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    }),
  });
  const demoLoginData = await demoLoginRes.json();
  assert.strictEqual(demoLoginRes.status, 200);
  const demoToken = demoLoginData.data.token;
  assert.strictEqual(demoLoginData.data.admin.company_id, 1);
  const demoHeaders = {
    Authorization: `Bearer ${demoToken}`,
    "Content-Type": "application/json",
  };
  console.log("✅ Demo Admin logged in with company_id: 1.");

  // 3. Login as Primary Admin (Company 2)
  console.log("\nTest 3: Authenticate Primary Admin (Company 2)...");
  const mainLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@gmail.com",
      password: "admin123",
    }),
  });
  const mainLoginData = await mainLoginRes.json();
  assert.strictEqual(mainLoginRes.status, 200);
  const mainToken = mainLoginData.data.token;
  assert.strictEqual(mainLoginData.data.admin.company_id, 2);
  const mainHeaders = {
    Authorization: `Bearer ${mainToken}`,
    "Content-Type": "application/json",
  };
  console.log("✅ Primary Admin logged in with company_id: 2.");

  // 4. Verify Demo Company Data Access
  console.log("\nTest 4: Verify Demo Company data visibility...");
  const demoProductsRes = await fetch(`${BASE_URL}/products`, { headers: demoHeaders });
  const demoProducts = (await demoProductsRes.json()).products;
  assert(demoProducts.some((p) => p.id === 7), "Demo should see product 7");

  const demoCustomersRes = await fetch(`${BASE_URL}/customers`, { headers: demoHeaders });
  const demoCustomers = (await demoCustomersRes.json()).customers;
  assert(demoCustomers.some((c) => c.id === 8), "Demo should see customer 8");

  const demoInvoicesRes = await fetch(`${BASE_URL}/invoices`, { headers: demoHeaders });
  const demoInvoices = (await demoInvoicesRes.json()).invoices;
  assert(demoInvoices.length >= 5, "Demo should see at least 5 invoices");
  console.log("✅ Demo Company successfully accesses its own data.");

  // 5. Verify Company 2 Initial Isolation (Clean state)
  console.log("\nTest 5: Verify Company 2 sees empty list initially...");
  const mainProductsRes = await fetch(`${BASE_URL}/products`, { headers: mainHeaders });
  const mainProducts = (await mainProductsRes.json()).products;
  assert.strictEqual(mainProducts.length, 0, "Company 2 should see 0 products initially");

  const mainCustomersRes = await fetch(`${BASE_URL}/customers`, { headers: mainHeaders });
  const mainCustomers = (await mainCustomersRes.json()).customers;
  assert.strictEqual(mainCustomers.length, 0, "Company 2 should see 0 customers initially");

  const mainInvoicesRes = await fetch(`${BASE_URL}/invoices`, { headers: mainHeaders });
  const mainInvoices = (await mainInvoicesRes.json()).invoices;
  assert.strictEqual(mainInvoices.length, 0, "Company 2 should see 0 invoices initially");
  console.log("✅ Company 2 does not see any Demo Company data in listing endpoints.");

  // 6. Cross-Tenant IDOR Attacks by Company 2 targeting Demo Company Data
  console.log("\nTest 6: Cross-Tenant IDOR Attack prevention...");

  // 6.1 GET Demo product 7 by Company 2
  const idorGetProduct = await fetch(`${BASE_URL}/products/7`, { headers: mainHeaders });
  assert.strictEqual(idorGetProduct.status, 404, "GET /products/7 by Company 2 should return 404");

  // 6.2 PUT Demo product 7 by Company 2
  const idorPutProduct = await fetch(`${BASE_URL}/products/7`, {
    method: "PUT",
    headers: mainHeaders,
    body: JSON.stringify({ name: "Hacked Product", price: 100, stock: 50 }),
  });
  assert.strictEqual(idorPutProduct.status, 404, "PUT /products/7 by Company 2 should return 404");

  // 6.3 DELETE Demo product 7 by Company 2
  const idorDelProduct = await fetch(`${BASE_URL}/products/7`, {
    method: "DELETE",
    headers: mainHeaders,
  });
  assert.strictEqual(idorDelProduct.status, 404, "DELETE /products/7 by Company 2 should return 404");

  // 6.4 GET Demo customer 8 by Company 2
  const idorGetCustomer = await fetch(`${BASE_URL}/customers/8`, { headers: mainHeaders });
  assert.strictEqual(idorGetCustomer.status, 404, "GET /customers/8 by Company 2 should return 404");

  // 6.5 PUT Demo customer 8 by Company 2
  const idorPutCustomer = await fetch(`${BASE_URL}/customers/8`, {
    method: "PUT",
    headers: mainHeaders,
    body: JSON.stringify({ name: "Hacked Customer", mobile: "1234567890" }),
  });
  assert.strictEqual(idorPutCustomer.status, 404, "PUT /customers/8 by Company 2 should return 404");

  // 6.6 DELETE Demo customer 8 by Company 2
  const idorDelCustomer = await fetch(`${BASE_URL}/customers/8`, {
    method: "DELETE",
    headers: mainHeaders,
  });
  assert.strictEqual(idorDelCustomer.status, 404, "DELETE /customers/8 by Company 2 should return 404");

  // 6.7 GET Demo invoice 14 by Company 2
  const idorGetInvoice = await fetch(`${BASE_URL}/invoices/14`, { headers: mainHeaders });
  assert.strictEqual(idorGetInvoice.status, 404, "GET /invoices/14 by Company 2 should return 404");

  // 6.8 CREATE Invoice by Company 2 using Demo Customer (ID 8)
  const idorCreateInvBadCustomer = await fetch(`${BASE_URL}/invoices`, {
    method: "POST",
    headers: mainHeaders,
    body: JSON.stringify({
      customer_id: 8,
      items: [{ product_id: 7, quantity: 1 }],
    }),
  });
  assert.strictEqual(
    idorCreateInvBadCustomer.status,
    404,
    "Invoice creation with cross-tenant customer must return 404"
  );

  console.log("✅ All IDOR attacks by Company 2 targeting Demo Company were blocked with 404.");

  // 7. Legitimate Operations for Company 2
  console.log("\nTest 7: Legitimate Company 2 creation & isolated numbering...");

  // 7.1 Create Company 2 Customer
  const createCustRes = await fetch(`${BASE_URL}/customers`, {
    method: "POST",
    headers: mainHeaders,
    body: JSON.stringify({
      name: "Acme Corp Client",
      mobile: "9988776655",
      email: "acme@example.com",
      address: "Industrial Area, Ahmedabad",
    }),
  });
  assert.strictEqual(createCustRes.status, 201);
  const company2Customer = (await createCustRes.json()).customer;
  console.log(`Created Company 2 customer (id: ${company2Customer.id}).`);

  // 7.2 Create Company 2 Product
  const createProdRes = await fetch(`${BASE_URL}/products`, {
    method: "POST",
    headers: mainHeaders,
    body: JSON.stringify({
      name: "Cloud Hosting Plan",
      price: 5000,
      stock: 20,
    }),
  });
  assert.strictEqual(createProdRes.status, 201);
  const company2ProductId = (await createProdRes.json()).productId;
  console.log(`Created Company 2 product (id: ${company2ProductId}).`);

  // 7.3 Verify next invoice number for Company 2 is INV-1001 (isolated sequence!)
  const nextInvRes = await fetch(`${BASE_URL}/invoices/new`, { headers: mainHeaders });
  const nextInvData = await nextInvRes.json();
  assert.strictEqual(
    nextInvData.invoiceNo,
    "INV-1001",
    `Company 2 first invoice should be INV-1001, got ${nextInvData.invoiceNo}`
  );
  console.log("✅ Company 2 gets isolated next invoice number: INV-1001.");

  // 7.4 Create Invoice for Company 2
  const createInvRes = await fetch(`${BASE_URL}/invoices`, {
    method: "POST",
    headers: mainHeaders,
    body: JSON.stringify({
      customer_id: company2Customer.id,
      items: [{ product_id: company2ProductId, quantity: 2 }],
      discount_percent: 10,
      tax_percent: 18,
    }),
  });
  assert.strictEqual(createInvRes.status, 201);
  const company2Invoice = (await createInvRes.json()).invoice;
  assert.strictEqual(company2Invoice.invoice_no, "INV-1001");
  console.log("✅ Company 2 created invoice INV-1001 successfully.");

  // 8. Cross-check: Demo Company cannot see Company 2's new records
  console.log("\nTest 8: Verify Demo Company cannot see Company 2 data...");
  const demoCheckProd = await fetch(`${BASE_URL}/products/${company2ProductId}`, {
    headers: demoHeaders,
  });
  assert.strictEqual(demoCheckProd.status, 404, "Demo should not see Company 2 product");

  const demoCheckCust = await fetch(`${BASE_URL}/customers/${company2Customer.id}`, {
    headers: demoHeaders,
  });
  assert.strictEqual(demoCheckCust.status, 404, "Demo should not see Company 2 customer");

  const demoCheckInv = await fetch(`${BASE_URL}/invoices/${company2Invoice.id}`, {
    headers: demoHeaders,
  });
  assert.strictEqual(demoCheckInv.status, 404, "Demo should not see Company 2 invoice");
  console.log("✅ Demo Company cannot see any Company 2 records (all return 404).");

  // 9. Dashboard Statistics Isolation
  console.log("\nTest 9: Verify Dashboard stats isolation...");
  const demoStatsRes = await fetch(`${BASE_URL}/dashboard`, { headers: demoHeaders });
  const demoStats = (await demoStatsRes.json()).stats;

  const mainStatsRes = await fetch(`${BASE_URL}/dashboard`, { headers: mainHeaders });
  const mainStats = (await mainStatsRes.json()).stats;

  console.log("Demo stats:", demoStats);
  console.log("Company 2 stats:", mainStats);

  assert.strictEqual(demoStats.totalCustomers, 1);
  assert.strictEqual(demoStats.totalProducts, 1);
  assert.strictEqual(demoStats.totalInvoices, 5);

  assert.strictEqual(mainStats.totalCustomers, 1);
  assert.strictEqual(mainStats.totalProducts, 1);
  assert.strictEqual(mainStats.totalInvoices, 1);
  console.log("✅ Dashboard statistics are completely isolated per tenant.");

  // 10. Business Settings Isolation
  console.log("\nTest 10: Business Settings isolation...");
  // Update Company 2 settings
  const updateSettingsRes = await fetch(`${BASE_URL}/business-settings`, {
    method: "PUT",
    headers: mainHeaders,
    body: JSON.stringify({
      business_name: "SmartBilling Enterprise Solution",
      tagline: "Next-Gen Billing Software",
    }),
  });
  assert.strictEqual(updateSettingsRes.status, 200);

  // Fetch Demo settings
  const demoSettingsRes = await fetch(`${BASE_URL}/business-settings`, { headers: demoHeaders });
  const demoSettings = (await demoSettingsRes.json()).settings;
  assert.strictEqual(
    demoSettings.business_name,
    "Het Nariya Billing",
    "Demo settings should remain Het Nariya Billing"
  );

  // Fetch Company 2 settings
  const mainSettingsRes = await fetch(`${BASE_URL}/business-settings`, { headers: mainHeaders });
  const mainSettings = (await mainSettingsRes.json()).settings;
  assert.strictEqual(
    mainSettings.business_name,
    "SmartBilling Enterprise Solution",
    "Company 2 settings should be updated"
  );
  console.log("✅ Business Settings are isolated and independently modifiable per tenant.");

  console.log("\nCleaning up Company 2 test entities...");
  await cleanupCompany2();
  db.end();

  console.log("\n🎉 ALL 14 MULTI-TENANT ISOLATION TESTS PASSED PERFECTLY!");
};

runTests().catch((err) => {
  console.error("❌ Test failed:", err);
  try { db.end(); } catch (e) {}
  process.exit(1);
});
