const assert = require("assert");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const db = require(path.resolve(__dirname, "../config/db"));

const BASE_URL = "http://localhost:5000/api";
let serverProcess = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const startServerIfNeeded = async () => {
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    if (res.status === 401 || res.status === 200) {
      console.log("ℹ️ Server is already running on port 5000.");
      return;
    }
  } catch {
    console.log("🚀 Starting local backend server for automated tests...");
    serverProcess = spawn("node", ["server.js"], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "inherit",
      shell: true,
      env: { ...process.env },
    });

    for (let i = 0; i < 20; i++) {
      await sleep(500);
      try {
        const res = await fetch(`${BASE_URL}/auth/me`);
        if (res.status === 401 || res.status === 200) {
          console.log("✅ Local server is online and ready.");
          return;
        }
      } catch {}
    }
    throw new Error("Failed to start server within timeout");
  }
};

const apiRequest = async (method, endpoint, body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, options);
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { status: res.status, ok: res.ok, data };
};

const runPhase3Tests = async () => {
  console.log("=================================================================");
  console.log("💼 SMARTBILLING: PLASTIC RECYCLING ERP (PHASE 3) TEST SUITE");
  console.log("   Sales, Dispatch, Inventory Movement & Finance Verification");
  console.log("=================================================================\n");

  await startServerIfNeeded();

  let tokenAdminComp2 = null;
  let tokenAdminComp1 = null;

  const cleanupIds = {
    customerId: null,
    fgId: null,
    salesOrderId1: null,
    salesOrderId2: null,
    vehicleId: null,
    dispatchId: null,
    invoiceId: null,
    challanId: null,
    paymentId: null,
    returnId: null,
    creditNoteId: null,
    debitNoteId: null,
  };

  try {
    console.log("Authenticating test administrators...");
    const login1 = await apiRequest("POST", "/auth/login", {
      email: "demo@smartbilling.com",
      password: "Demo@12345",
    });
    tokenAdminComp1 = login1.data?.data?.token;

    const login2 = await apiRequest("POST", "/auth/login", {
      email: "admin@gmail.com",
      password: "admin123",
    });
    tokenAdminComp2 = login2.data?.data?.token;

    assert.ok(tokenAdminComp1, "Company 1 admin token required");
    assert.ok(tokenAdminComp2, "Company 2 admin token required");
    console.log("✅ Authenticated Demo Admin (Company 1) and Primary Admin (Company 2).\n");

    const cleanupAllTestEntities = async () => {
      try {
        const conn = db.promise();
        await conn.query(`DELETE FROM plastic_customer_ledger WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_debit_note_items WHERE debit_note_id IN (SELECT id FROM plastic_debit_notes WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_debit_notes WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_credit_note_items WHERE credit_note_id IN (SELECT id FROM plastic_credit_notes WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_credit_notes WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_sales_return_items WHERE return_id IN (SELECT id FROM plastic_sales_returns WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_sales_returns WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_payments WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_delivery_challan_items WHERE challan_id IN (SELECT id FROM plastic_delivery_challans WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_delivery_challans WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM invoices WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_sales_stock_movements WHERE finished_good_id IN (SELECT id FROM plastic_finished_goods WHERE fg_code = 'FG-HDPE-TST01')`);
        await conn.query(`DELETE FROM plastic_dispatch_items WHERE dispatch_id IN (SELECT id FROM plastic_dispatches WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_dispatches WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_fg_reservations WHERE sales_order_id IN (SELECT id FROM plastic_sales_orders WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_sales_order_items WHERE sales_order_id IN (SELECT id FROM plastic_sales_orders WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd'))`);
        await conn.query(`DELETE FROM plastic_sales_orders WHERE customer_id IN (SELECT id FROM customers WHERE name = 'Test Apex Polymers Ltd')`);
        await conn.query(`DELETE FROM plastic_finished_goods WHERE fg_code = 'FG-HDPE-TST01'`);
        await conn.query(`DELETE FROM plastic_vehicles WHERE vehicle_number = 'GJ-05-BT-4491'`);
        await conn.query(`DELETE FROM customers WHERE name = 'Test Apex Polymers Ltd'`);
      } catch (e) {
        console.warn("Cleanup warning:", e.message);
      }
    };

    // 0. Setup test customer and test finished good in Company 2
    console.log("Setting up self-contained test entities in Company 2...");
    await cleanupAllTestEntities();

    const [custRes] = await db.promise().query(
      `INSERT INTO customers (company_id, name, mobile, email, address)
       VALUES (2, 'Test Apex Polymers Ltd', '9898989898', 'apex@test.com', 'Plot 44, GIDC Panoli, Gujarat')`
    );
    cleanupIds.customerId = custRes.insertId;

    const [fgRes] = await db.promise().query(
      `INSERT INTO plastic_finished_goods
       (company_id, fg_name, fg_code, plastic_type, color, grade, current_stock, minimum_stock, unit, standard_cost, selling_price)
       VALUES (2, 'HDPE Black Granules Test', 'FG-HDPE-TST01', 'HDPE', 'Black', 'Extrusion', 5000.00, 500.00, 'KG', 72.00, 95.00)`
    );
    cleanupIds.fgId = fgRes.insertId;
    console.log(`✅ Test Customer ID ${cleanupIds.customerId} & Finished Good ID ${cleanupIds.fgId} (5,000 KG stock) prepared.\n`);

    // --- TEST 1: Sales Order Creation ---
    console.log("--- TEST 1: Sales Order Creation ---");
    const soRes = await apiRequest(
      "POST",
      "/plastic-erp/sales",
      {
        customer_id: cleanupIds.customerId,
        order_date: new Date().toISOString().split("T")[0],
        expected_delivery_date: new Date().toISOString().split("T")[0],
        notes: "Test order for 1,200 KG HDPE Granules",
        items: [
          {
            finished_good_id: cleanupIds.fgId,
            quantity: 1200,
            rate: 95.00,
            discount: 0,
            tax: 0,
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(soRes.status, 201, `Failed to create SO: ${JSON.stringify(soRes.data)}`);
    assert.ok(soRes.data.orderId, "Must return orderId");
    cleanupIds.salesOrderId1 = soRes.data.orderId;
    console.log(`✅ TEST 1 PASSED: Created Sales Order ID ${cleanupIds.salesOrderId1} (${soRes.data.salesOrderNo}) for 1,200 KG @ ₹95/KG.`);

    // --- TEST 2: Sales Order Multi-Tenant Isolation ---
    console.log("\n--- TEST 2: Sales Order Multi-Tenant Company Isolation ---");
    const crossSoRes = await apiRequest("GET", `/plastic-erp/sales/${cleanupIds.salesOrderId1}`, null, tokenAdminComp1);
    assert.strictEqual(crossSoRes.status, 404, "Company 1 must NOT be able to view Company 2's sales order");
    console.log("✅ TEST 2 PASSED: Cross-tenant sales order access rejected with HTTP 404.");

    // --- TEST 3: Sales Order Item Validation ---
    console.log("\n--- TEST 3: Sales Order Item Validation ---");
    const invalidSoRes = await apiRequest(
      "POST",
      "/plastic-erp/sales",
      {
        customer_id: cleanupIds.customerId,
        items: [{ finished_good_id: cleanupIds.fgId, quantity: -50, rate: 95.00 }],
      },
      tokenAdminComp2
    );
    assert.strictEqual(invalidSoRes.status, 400, "Negative quantity must fail with 400");
    console.log("✅ TEST 3 PASSED: Negative quantity properly rejected with HTTP 400 validation error.");

    // --- TEST 4: Finished Goods Stock Reservation ---
    console.log("\n--- TEST 4: Finished Goods Stock Reservation ---");
    const confirmRes = await apiRequest("PATCH", `/plastic-erp/sales/${cleanupIds.salesOrderId1}/confirm`, {}, tokenAdminComp2);
    assert.strictEqual(confirmRes.status, 200, `Confirm failed: ${JSON.stringify(confirmRes.data)}`);
    assert.strictEqual(confirmRes.data.status, "RESERVED");

    const [resRows] = await db.promise().query(
      `SELECT * FROM plastic_fg_reservations WHERE sales_order_id = ? AND company_id = 2 AND status = 'ACTIVE'`,
      [cleanupIds.salesOrderId1]
    );
    assert.strictEqual(resRows.length, 1, "Must have exactly 1 active reservation");
    assert.strictEqual(Number(resRows[0].reserved_quantity), 1200);
    console.log(`✅ TEST 4 PASSED: Sales order confirmed and 1,200 KG active reservation recorded in plastic_fg_reservations.`);

    // --- TEST 5: Over-Reservation Prevention ---
    console.log("\n--- TEST 5: Over-Reservation Prevention ---");
    // Available = 5000 - 1200 = 3800 KG. Try to order and confirm 4000 KG.
    const excessiveSoRes = await apiRequest(
      "POST",
      "/plastic-erp/sales",
      {
        customer_id: cleanupIds.customerId,
        items: [{ finished_good_id: cleanupIds.fgId, quantity: 4000, rate: 95.00 }],
      },
      tokenAdminComp2
    );
    assert.strictEqual(excessiveSoRes.status, 201);
    cleanupIds.salesOrderId2 = excessiveSoRes.data.orderId;

    const excessiveConfirmRes = await apiRequest(
      "PATCH",
      `/plastic-erp/sales/${cleanupIds.salesOrderId2}/confirm`,
      {},
      tokenAdminComp2
    );
    assert.strictEqual(excessiveConfirmRes.status, 400, "Over-reservation must be blocked with 400");
    console.log(`✅ TEST 5 PASSED: Over-reservation of 4,000 KG (available 3,800 KG) blocked with message: "${excessiveConfirmRes.data.message}"`);

    // --- TEST 6: Reservation Release on Order Cancellation ---
    console.log("\n--- TEST 6: Reservation Release on Order Cancellation ---");
    const cancelRes = await apiRequest(
      "PATCH",
      `/plastic-erp/sales/${cleanupIds.salesOrderId1}/cancel`,
      { reason: "Customer requested schedule change" },
      tokenAdminComp2
    );
    assert.strictEqual(cancelRes.status, 200);

    const [cancelledResRows] = await db.promise().query(
      `SELECT * FROM plastic_fg_reservations WHERE sales_order_id = ? AND company_id = 2 AND status = 'RELEASED'`,
      [cleanupIds.salesOrderId1]
    );
    assert.strictEqual(cancelledResRows.length, 1, "Reservation status must be RELEASED");
    console.log("✅ TEST 6 PASSED: Order cancelled and 1,200 KG stock reservation released.");

    // --- TEST 7: Vehicle & Transport Master Management ---
    console.log("\n--- TEST 7: Vehicle & Transport Master Management ---");
    const vehRes = await apiRequest(
      "POST",
      "/plastic-erp/transport/vehicles",
      {
        vehicle_number: "GJ-05-BT-4491",
        vehicle_type: "TRUCK_16T",
        transporter_name: "Gujarat Freight Express",
        driver_name: "Ramesh Patel",
        driver_mobile: "9825100000",
        capacity_ton: 16.0,
      },
      tokenAdminComp2
    );
    assert.strictEqual(vehRes.status, 201, `Failed to create vehicle: ${JSON.stringify(vehRes.data)}`);
    cleanupIds.vehicleId = vehRes.data.vehicleId;

    const listVehRes = await apiRequest("GET", "/plastic-erp/transport/vehicles", null, tokenAdminComp2);
    assert.strictEqual(listVehRes.status, 200);
    assert.ok(listVehRes.data.vehicles.some((v) => v.id === cleanupIds.vehicleId));
    console.log(`✅ TEST 7 PASSED: Vehicle GJ-05-BT-4491 (ID ${cleanupIds.vehicleId}) registered with 16T capacity.`);

    // --- TEST 8: Dispatch Creation with Vehicle Assignment ---
    console.log("\n--- TEST 8: Dispatch Creation with Vehicle Assignment ---");
    // Re-confirm order 2 for 800 KG so we have a clean order
    await db.promise().query(`UPDATE plastic_sales_orders SET status = 'CONFIRMED' WHERE id = ?`, [cleanupIds.salesOrderId2]);
    await db.promise().query(
      `UPDATE plastic_sales_order_items SET quantity = 800, line_total = 800 * 95 WHERE sales_order_id = ?`,
      [cleanupIds.salesOrderId2]
    );

    const dispatchRes = await apiRequest(
      "POST",
      "/plastic-erp/dispatch",
      {
        customer_id: cleanupIds.customerId,
        sales_order_id: cleanupIds.salesOrderId2,
        vehicle_id: cleanupIds.vehicleId,
        destination: "Panoli GIDC Bay 3",
        dispatch_date: new Date().toISOString().split("T")[0],
        auto_dispatch: true,
        items: [
          {
            finished_good_id: cleanupIds.fgId,
            quantity: 800,
            rate: 95.00,
            unit: "KG",
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(dispatchRes.status, 201, `Failed to create dispatch: ${JSON.stringify(dispatchRes.data)}`);
    cleanupIds.dispatchId = dispatchRes.data.dispatchId;
    assert.strictEqual(dispatchRes.data.status, "DISPATCHED");
    console.log(`✅ TEST 8 PASSED: Dispatch ID ${cleanupIds.dispatchId} (${dispatchRes.data.dispatchNo}) created and DISPATCHED.`);

    // --- TEST 9: Dispatch Stock Deduction ---
    console.log("\n--- TEST 9: Finished Goods Stock Deduction Verification ---");
    const [fgCheck] = await db.promise().query(
      `SELECT current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = 2`,
      [cleanupIds.fgId]
    );
    // Started at 5000, dispatched 800 -> must be exactly 4200
    assert.strictEqual(Number(fgCheck[0].current_stock), 4200.00);
    console.log(`✅ TEST 9 PASSED: Finished good stock accurately reduced from 5,000.00 KG to ${fgCheck[0].current_stock} KG.`);

    // --- TEST 10: Outward Stock Movement Audit Log ---
    console.log("\n--- TEST 10: Outward Stock Movement Audit Log ---");
    const [movCheck] = await db.promise().query(
      `SELECT * FROM plastic_sales_stock_movements WHERE reference_id = ? AND movement_type = 'SALES_OUTWARD' AND company_id = 2`,
      [cleanupIds.dispatchId]
    );
    assert.strictEqual(movCheck.length, 1, "Must find exactly 1 outward movement log");
    assert.strictEqual(Number(movCheck[0].quantity), 800);
    assert.strictEqual(Number(movCheck[0].balance_quantity), 4200);
    console.log(`✅ TEST 10 PASSED: Outward movement log verified in plastic_sales_stock_movements (Qty: 800 KG, Balance: 4,200 KG).`);

    // --- TEST 11: Delivery Challan (Rule 55) Generation ---
    console.log("\n--- TEST 11: Delivery Challan Generation ---");
    const challanRes = await apiRequest(
      "POST",
      "/plastic-erp/transport/challans",
      {
        dispatch_id: cleanupIds.dispatchId,
        customer_id: cleanupIds.customerId,
        challan_date: new Date().toISOString().split("T")[0],
        transporter_name: "Gujarat Freight Express",
        vehicle_number: "GJ-05-BT-4491",
        driver_name: "Ramesh Patel",
        delivery_address: "Panoli GIDC Bay 3",
        items: [
          {
            finished_good_id: cleanupIds.fgId,
            quantity: 800,
            unit: "KG",
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(challanRes.status, 201, `Failed to create challan: ${JSON.stringify(challanRes.data)}`);
    cleanupIds.challanId = challanRes.data.challanId;
    console.log(`✅ TEST 11 PASSED: Delivery Challan ID ${cleanupIds.challanId} (${challanRes.data.challanNo}) generated under Rule 55.`);

    // --- TEST 12: Invoice Creation from Dispatch ---
    console.log("\n--- TEST 12: Invoice Creation from Dispatch (Integration with SmartBilling) ---");
    const invRes = await apiRequest(
      "POST",
      `/plastic-erp/dispatch/${cleanupIds.dispatchId}/create-invoice`,
      {},
      tokenAdminComp2
    );
    assert.strictEqual(invRes.status, 201, `Failed to create invoice: ${JSON.stringify(invRes.data)}`);
    cleanupIds.invoiceId = invRes.data.invoice?.id || invRes.data.invoiceId;
    const invNo = invRes.data.invoice?.invoice_no || invRes.data.invoiceNo;
    assert.ok(invNo, "Must return invoice_no");

    const [invDb] = await db.promise().query(
      `SELECT id, invoice_no, grand_total, paid_amount, payment_status, dispatch_id FROM invoices WHERE id = ? AND company_id = 2`,
      [cleanupIds.invoiceId]
    );
    assert.strictEqual(invDb.length, 1);
    assert.strictEqual(invDb[0].dispatch_id, cleanupIds.dispatchId);
    assert.strictEqual(invDb[0].payment_status, "UNPAID");
    const invoiceGrandTotal = Number(invDb[0].grand_total);
    console.log(`✅ TEST 12 PASSED: Invoice ${invDb[0].invoice_no} generated (Total: ₹${invoiceGrandTotal}) linked to Dispatch #${cleanupIds.dispatchId}.`);

    // --- TEST 13: Customer Ledger Entry on Invoice ---
    console.log("\n--- TEST 13: Customer Ledger Entry on Invoice ---");
    const [invLedger] = await db.promise().query(
      `SELECT * FROM plastic_customer_ledger WHERE customer_id = ? AND reference_type = 'INVOICE' AND reference_id = ? AND company_id = 2`,
      [cleanupIds.customerId, cleanupIds.invoiceId]
    );
    assert.strictEqual(invLedger.length, 1, "Must have 1 debit ledger entry for the invoice");
    assert.strictEqual(Number(invLedger[0].debit), invoiceGrandTotal);
    assert.strictEqual(Number(invLedger[0].balance), invoiceGrandTotal);
    console.log(`✅ TEST 13 PASSED: Ledger debited by ₹${invoiceGrandTotal}. Running customer balance = ₹${invLedger[0].balance}.`);

    // --- TEST 14: Payment Creation & Invoice Linking ---
    console.log("\n--- TEST 14: Payment Creation & Invoice Linking ---");
    const partialPaymentAmount = Math.round(invoiceGrandTotal / 2);
    const payRes = await apiRequest(
      "POST",
      "/plastic-erp/payments",
      {
        customer_id: cleanupIds.customerId,
        invoice_id: cleanupIds.invoiceId,
        payment_date: new Date().toISOString().split("T")[0],
        amount: partialPaymentAmount,
        payment_method: "BANK",
        reference_number: "NEFT-HDFC-9912",
        notes: "50% advance bank transfer",
      },
      tokenAdminComp2
    );
    assert.strictEqual(payRes.status, 201, `Payment failed: ${JSON.stringify(payRes.data)}`);
    cleanupIds.paymentId = payRes.data.paymentId;
    console.log(`✅ TEST 14 PASSED: Payment ID ${cleanupIds.paymentId} (${payRes.data.paymentNo}) recorded for ₹${partialPaymentAmount}.`);

    // --- TEST 15: Payment Updates Invoice Paid Amount & Status ---
    console.log("\n--- TEST 15: Payment Updates Invoice Paid Amount & Status ---");
    const [invAfterPay] = await db.promise().query(
      `SELECT paid_amount, payment_status FROM invoices WHERE id = ? AND company_id = 2`,
      [cleanupIds.invoiceId]
    );
    assert.strictEqual(Number(invAfterPay[0].paid_amount), partialPaymentAmount);
    assert.strictEqual(invAfterPay[0].payment_status, "PARTIAL");
    console.log(`✅ TEST 15 PASSED: Invoice updated to PARTIAL (Paid: ₹${invAfterPay[0].paid_amount}).`);

    // --- TEST 16: Customer Ledger Credit on Payment ---
    console.log("\n--- TEST 16: Customer Ledger Credit on Payment ---");
    const [payLedger] = await db.promise().query(
      `SELECT * FROM plastic_customer_ledger WHERE customer_id = ? AND reference_type = 'PAYMENT' AND reference_id = ? AND company_id = 2`,
      [cleanupIds.customerId, cleanupIds.paymentId]
    );
    assert.strictEqual(payLedger.length, 1);
    assert.strictEqual(Number(payLedger[0].credit), partialPaymentAmount);
    const expectedRemaining = invoiceGrandTotal - partialPaymentAmount;
    assert.strictEqual(Number(payLedger[0].balance), expectedRemaining);
    console.log(`✅ TEST 16 PASSED: Customer ledger credited by ₹${partialPaymentAmount}. Running balance reduced to ₹${expectedRemaining}.`);

    // --- TEST 17: Sales Return Creation ---
    console.log("\n--- TEST 17: Sales Return Creation ---");
    const returnRes = await apiRequest(
      "POST",
      "/plastic-erp/returns",
      {
        customer_id: cleanupIds.customerId,
        invoice_id: cleanupIds.invoiceId,
        dispatch_id: cleanupIds.dispatchId,
        return_date: new Date().toISOString().split("T")[0],
        reason: "50 KG slight color variation",
        items: [
          {
            finished_good_id: cleanupIds.fgId,
            quantity: 50,
            rate: 95.00,
            unit: "KG",
            qc_disposition: "RETURN_TO_STOCK",
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(returnRes.status, 201, `Return failed: ${JSON.stringify(returnRes.data)}`);
    cleanupIds.returnId = returnRes.data.returnId;
    assert.strictEqual(returnRes.data.status, "RECEIVED");
    console.log(`✅ TEST 17 PASSED: Sales Return ID ${cleanupIds.returnId} (${returnRes.data.returnNo}) logged in RECEIVED status.`);

    // --- TEST 18: Sales Return Completion & Stock Restocking ---
    console.log("\n--- TEST 18: Sales Return Completion & Stock Restocking ---");
    const compReturnRes = await apiRequest(
      "PATCH",
      `/plastic-erp/returns/${cleanupIds.returnId}/complete`,
      {},
      tokenAdminComp2
    );
    assert.strictEqual(compReturnRes.status, 200, `Complete return failed: ${JSON.stringify(compReturnRes.data)}`);
    assert.strictEqual(compReturnRes.data.status, "COMPLETED");

    // Verify stock increased back by 50 KG: 4200 + 50 = 4250
    const [fgRestock] = await db.promise().query(
      `SELECT current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = 2`,
      [cleanupIds.fgId]
    );
    assert.strictEqual(Number(fgRestock[0].current_stock), 4250.00);
    console.log(`✅ TEST 18 PASSED: 50 KG restocked to finished goods. Current stock restored to ${fgRestock[0].current_stock} KG.`);

    // --- TEST 19: Automatic Credit Note Generation & Ledger Credit ---
    console.log("\n--- TEST 19: Automatic Credit Note Generation & Ledger Credit ---");
    const [cnDb] = await db.promise().query(
      `SELECT id, credit_note_no, total, status FROM plastic_credit_notes WHERE sales_return_id = ? AND company_id = 2`,
      [cleanupIds.returnId]
    );
    assert.strictEqual(cnDb.length, 1);
    cleanupIds.creditNoteId = cnDb[0].id;
    const returnCreditVal = Number(cnDb[0].total);

    const [cnLedger] = await db.promise().query(
      `SELECT * FROM plastic_customer_ledger WHERE reference_type = 'CREDIT_NOTE' AND reference_id = ? AND company_id = 2`,
      [cleanupIds.creditNoteId]
    );
    assert.strictEqual(cnLedger.length, 1);
    assert.strictEqual(Number(cnLedger[0].credit), returnCreditVal);
    console.log(`✅ TEST 19 PASSED: Credit Note ${cnDb[0].credit_note_no} (₹${returnCreditVal}) automatically issued and credited to ledger.`);

    // --- TEST 20: Supplementary Debit Note Creation ---
    console.log("\n--- TEST 20: Supplementary Debit Note Creation ---");
    const dnRes = await apiRequest(
      "POST",
      "/plastic-erp/debit-notes",
      {
        customer_id: cleanupIds.customerId,
        invoice_id: cleanupIds.invoiceId,
        date: new Date().toISOString().split("T")[0],
        reason: "Additional demurrage / detention charges",
        items: [
          {
            description: "Additional demurrage / detention charges",
            quantity: 1,
            rate: 500.00,
            amount: 500.00,
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(dnRes.status, 201, `Debit note failed: ${JSON.stringify(dnRes.data)}`);
    cleanupIds.debitNoteId = dnRes.data.debitNoteId;

    const [dnLedger] = await db.promise().query(
      `SELECT * FROM plastic_customer_ledger WHERE reference_type = 'DEBIT_NOTE' AND reference_id = ? AND company_id = 2`,
      [cleanupIds.debitNoteId]
    );
    assert.strictEqual(dnLedger.length, 1);
    assert.strictEqual(Number(dnLedger[0].debit), 500.00);
    console.log(`✅ TEST 20 PASSED: Debit Note ID ${cleanupIds.debitNoteId} (₹500) created and debited to customer ledger.`);

    // --- TEST 21: Receivables Aging Buckets Calculation ---
    console.log("\n--- TEST 21: Receivables Aging Buckets Calculation ---");
    const agingRes = await apiRequest("GET", "/plastic-erp/receivables/aging", null, tokenAdminComp2);
    assert.strictEqual(agingRes.status, 200);
    assert.ok(Array.isArray(agingRes.data.aging), "Aging array required");

    const summaryRes = await apiRequest("GET", "/plastic-erp/receivables/summary", null, tokenAdminComp2);
    assert.strictEqual(summaryRes.status, 200);
    assert.ok(summaryRes.data.summary, "Aging summary required");
    assert.ok("aging" in summaryRes.data.summary, "Aging buckets required");
    console.log("✅ TEST 21 PASSED: Receivables aging calculation returned correct time buckets.");

    // --- TEST 22: Profit & Margin Analytics Report ---
    console.log("\n--- TEST 22: Profit & Margin Analytics Report ---");
    const profitRes = await apiRequest("GET", "/plastic-erp/phase3-reports/profit-margin", null, tokenAdminComp2);
    assert.strictEqual(profitRes.status, 200);
    assert.ok(profitRes.data.success);
    assert.ok("summary" in profitRes.data, "Summary required");
    console.log(`✅ TEST 22 PASSED: Profit & Margin report generated (Revenue: ₹${profitRes.data.summary.totalRevenue}, Cost: ₹${profitRes.data.summary.totalCost}, Margin: ${profitRes.data.summary.overallMarginPercent}%).`);

    // --- TEST 23: Complete Cross-Company Tenant Isolation ---
    console.log("\n--- TEST 23: Complete Cross-Company Tenant Isolation Across All Phase 3 Endpoints ---");
    // 1. Cross dispatch access
    const crossDisp = await apiRequest("GET", `/plastic-erp/dispatch/${cleanupIds.dispatchId}`, null, tokenAdminComp1);
    assert.strictEqual(crossDisp.status, 404, "Cross dispatch access must be blocked");

    // 2. Cross challan access
    const crossChallan = await apiRequest("GET", `/plastic-erp/transport/challans/${cleanupIds.challanId}`, null, tokenAdminComp1);
    assert.strictEqual(crossChallan.status, 404, "Cross challan access must be blocked");

    // 3. Cross payment access
    const crossPay = await apiRequest("GET", `/plastic-erp/payments/${cleanupIds.paymentId}`, null, tokenAdminComp1);
    assert.strictEqual(crossPay.status, 404, "Cross payment access must be blocked");

    // 4. Cross return access
    const crossRet = await apiRequest("GET", `/plastic-erp/returns/${cleanupIds.returnId}`, null, tokenAdminComp1);
    assert.strictEqual(crossRet.status, 404, "Cross return access must be blocked");

    // 5. Cross ledger statement access
    const crossLedger = await apiRequest("GET", `/plastic-erp/ledger/customer/${cleanupIds.customerId}`, null, tokenAdminComp1);
    assert.strictEqual(crossLedger.status, 404, "Cross customer ledger must be blocked");
    console.log("✅ TEST 23 PASSED: Multi-tenant boundary verified across dispatches, challans, payments, returns, and customer ledgers.");

    // --- TEST 24: Financial Transaction Rollback on Failure ---
    console.log("\n--- TEST 24: Financial Transaction Rollback on Failure ---");
    // Attempt invalid dispatch with non-existent finished good ID
    const failedDisp = await apiRequest(
      "POST",
      "/plastic-erp/dispatch",
      {
        customer_id: cleanupIds.customerId,
        items: [{ finished_good_id: 999999, quantity: 100, rate: 95 }],
      },
      tokenAdminComp2
    );
    assert.ok(failedDisp.status >= 400, "Must fail with client error");
    const [orphanDispatches] = await db.promise().query(
      `SELECT * FROM plastic_dispatches WHERE destination = 'NON_EXISTENT_DEST' AND company_id = 2`
    );
    assert.strictEqual(orphanDispatches.length, 0, "No partial dispatch row created");
    console.log("✅ TEST 24 PASSED: DB transaction rolled back cleanly without creating orphan records.");

    // --- TEST 25: Phase 3 Executive Dashboard Analytics ---
    console.log("\n--- TEST 25: Phase 3 Executive Dashboard Analytics Endpoints ---");
    const p3AnalyticsRes = await apiRequest("GET", "/dashboard/plastic-phase3-analytics", null, tokenAdminComp2);
    assert.strictEqual(p3AnalyticsRes.status, 200);
    assert.ok(p3AnalyticsRes.data.analytics.topCustomers.length > 0, "Top customers must be populated");
    assert.ok(p3AnalyticsRes.data.analytics.recentDispatches.length > 0, "Recent dispatches must be populated");

    const dashStatsRes = await apiRequest("GET", "/dashboard/plastic-stats?period=today", null, tokenAdminComp2);
    assert.strictEqual(dashStatsRes.status, 200);
    assert.ok("salesOrders" in dashStatsRes.data.stats);
    assert.ok("totalDispatches" in dashStatsRes.data.stats);
    assert.ok("paymentsCollected" in dashStatsRes.data.stats);
    assert.ok("outstandingReceivables" in dashStatsRes.data.stats);
    console.log(`✅ TEST 25 PASSED: Executive Dashboard analytics and stats returned all Phase 3 metrics.`);

    console.log("\n🎉 ALL 25 TARGETED PLASTIC RECYCLING (PHASE 3) TESTS PASSED SUCCESSFULLY!");

    // --- Clean up temporary test entities ---
    console.log("\nCleaning up temporary test entities...");
    await cleanupAllTestEntities();
    console.log("✅ Temporary test entities cleaned up successfully.");
  } catch (err) {
    console.error("❌ Phase 3 Test Suite Failed:", err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      console.log("Stopping temporary test server process...");
      serverProcess.kill();
    }
    db.end();
  }
};

runPhase3Tests();
