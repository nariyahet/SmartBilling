const jwt = require("jsonwebtoken");

const PROD_API = "https://smartbilling-api-het.onrender.com/api";
const VERCEL_URL = "https://smartbilling-sigma.vercel.app";

const investigate = async () => {
  console.log("==================================================");
  console.log("PRODUCTION MULTI-TENANT INVESTIGATION");
  console.log("==================================================\n");

  // CHECK 1: Vercel frontend VITE_API_URL / Bundle API URL
  console.log("CHECK 1: Inspecting Vercel deployed frontend bundle...");
  try {
    const vercelRes = await fetch(VERCEL_URL);
    const html = await vercelRes.text();
    const scriptMatches = html.match(/src="(\/assets\/[^"]+\.js)"/g) || [];
    console.log("Found scripts in Vercel HTML:", scriptMatches);

    for (const match of scriptMatches) {
      const scriptPath = match.replace('src="', "").replace('"', "");
      const bundleRes = await fetch(VERCEL_URL + scriptPath);
      const bundleText = await bundleRes.text();
      const renderUrls = bundleText.match(/https?:\/\/[a-zA-Z0-9-]+\.onrender\.com\/api/g);
      if (renderUrls) {
        console.log(`Script ${scriptPath} references API URL:`, [...new Set(renderUrls)]);
      }
    }
  } catch (err) {
    console.error("Failed to fetch Vercel bundle:", err.message);
  }

  // CHECK 2 & 3: Demo & Admin Login on Render Production API
  console.log("\nCHECK 2 & 3: Testing Demo & Admin login on Render production API...");
  console.log(`Calling ${PROD_API}/auth/login...`);

  let demoToken = null;
  let demoLoginData = null;
  try {
    const demoRes = await fetch(`${PROD_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "demo@smartbilling.com",
        password: "Demo@12345",
      }),
    });
    demoLoginData = await demoRes.json();
    console.log("Production Demo Login HTTP Status:", demoRes.status);
    console.log("Production Demo Login Response Body:", JSON.stringify(demoLoginData, null, 2));
    demoToken = demoLoginData.data?.token;
  } catch (err) {
    console.error("Demo login error:", err.message);
  }

  let adminToken = null;
  let adminLoginData = null;
  try {
    const adminRes = await fetch(`${PROD_API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@gmail.com",
        password: "admin123",
      }),
    });
    adminLoginData = await adminRes.json();
    console.log("\nProduction Admin Login HTTP Status:", adminRes.status);
    console.log("Production Admin Login Response Body:", JSON.stringify(adminLoginData, null, 2));
    adminToken = adminLoginData.data?.token;
  } catch (err) {
    console.error("Admin login error:", err.message);
  }

  // CHECK 4: Decode JWTs
  console.log("\nCHECK 4: Inspecting decoded JWT payloads from Production API...");
  if (demoToken) {
    const decodedDemo = jwt.decode(demoToken);
    console.log("Decoded Production Demo JWT:", decodedDemo);
  } else {
    console.log("❌ No Demo Token received!");
  }

  if (adminToken) {
    const decodedAdmin = jwt.decode(adminToken);
    console.log("Decoded Production Admin JWT:", decodedAdmin);
  } else {
    console.log("❌ No Admin Token received!");
  }

  // CHECK 5 & 6: Call Production /api/invoices with Demo and Admin JWT
  console.log("\nCHECK 5: Calling Production GET /api/invoices with Demo JWT...");
  if (demoToken) {
    const demoInvRes = await fetch(`${PROD_API}/invoices`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    console.log("Demo Invoices HTTP Status:", demoInvRes.status);
    const demoInvData = await demoInvRes.json();
    console.log("Demo Invoices Count:", demoInvData.invoices?.length);
    console.log(
      "Demo Invoices List:",
      demoInvData.invoices?.map((i) => ({
        id: i.id,
        invoice_no: i.invoice_no,
        company_id: i.company_id,
        grand_total: i.grand_total,
        customer_name: i.customer_name,
        created_at: i.created_at,
      }))
    );
  }

  console.log("\nCHECK 6: Calling Production GET /api/invoices with Admin JWT...");
  if (adminToken) {
    const adminInvRes = await fetch(`${PROD_API}/invoices`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log("Admin Invoices HTTP Status:", adminInvRes.status);
    const adminInvData = await adminInvRes.json();
    console.log("Admin Invoices Count:", adminInvData.invoices?.length);
    console.log(
      "Admin Invoices List:",
      adminInvData.invoices?.map((i) => ({
        id: i.id,
        invoice_no: i.invoice_no,
        company_id: i.company_id,
        grand_total: i.grand_total,
        customer_name: i.customer_name,
        created_at: i.created_at,
      }))
    );
  }

  // CHECK: Call /api/auth/me on Production
  console.log("\nCHECK 6b: Testing GET /api/auth/me on Production API...");
  if (demoToken) {
    const meRes = await fetch(`${PROD_API}/auth/me`, {
      headers: { Authorization: `Bearer ${demoToken}` },
    });
    console.log("Production Demo /api/auth/me HTTP Status:", meRes.status);
    const meData = await meRes.text();
    console.log("Production Demo /api/auth/me Body:", meData);
  }

  // CHECK 10: Production database records
  console.log("\nCHECK 10: Inspecting actual DB invoice records directly via project DB connection...");
  const db = require("../config/db");
  const [dbInvoices] = await db.promise().query(
    "SELECT id, invoice_no, company_id, customer_id, grand_total, created_at FROM invoices ORDER BY id ASC"
  );
  console.log("DB Invoices in TiDB Cloud (Total: " + dbInvoices.length + "):");
  console.table(dbInvoices);

  const [dbProducts] = await db.promise().query(
    "SELECT id, name, company_id FROM products"
  );
  console.log("\nDB Products:");
  console.table(dbProducts);

  const [dbCustomers] = await db.promise().query(
    "SELECT id, name, company_id FROM customers"
  );
  console.log("\nDB Customers:");
  console.table(dbCustomers);

  const [dbCompanies] = await db.promise().query(
    "SELECT * FROM companies"
  );
  console.log("\nDB Companies:");
  console.table(dbCompanies);

  const [dbAdmins] = await db.promise().query(
    "SELECT id, name, email, company_id FROM admins"
  );
  console.log("\nDB Admins:");
  console.table(dbAdmins);

  db.end();
};

investigate().catch(console.error);
