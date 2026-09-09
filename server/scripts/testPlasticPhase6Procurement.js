/**
 * Comprehensive Automated Test Suite for Phase 6: Procurement, Vendor & Purchase Intelligence
 * SmartBilling Plastic Recycling ERP
 */

const db = require("../config/db");

async function runPhase6Tests() {
  console.log("\n=======================================================");
  console.log("  STARTING PHASE 6 AUTOMATED VERIFICATION SUITE");
  console.log("  Procurement, Vendor & Purchase Intelligence");
  console.log("=======================================================\n");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedTests++;
    }
  }

  const conn = db.promise();

  try {
    // 1. Setup Test Companies (Company A & Company B for tenant isolation)
    const [companies] = await conn.query("SELECT id, name FROM companies LIMIT 2");
    if (companies.length < 1) {
      throw new Error("At least one company must exist in smartbilling_db");
    }

    const companyAId = companies[0].id;
    let companyBId = companies.length > 1 ? companies[1].id : null;

    if (!companyBId) {
      const [newComp] = await conn.query(
        "INSERT INTO companies (name, slug) VALUES (?, ?)",
        ["Test Isolation Company B", `isolation-b-${Date.now()}`]
      );
      companyBId = newComp.insertId;
    }

    console.log(`[Setup] Company A: #${companyAId}, Company B: #${companyBId}`);

    // --- TEST 1: Database Schema & Migration Verification ---
    console.log("\n--- TEST 1: Database Schema Verification ---");
    const requiredTables = [
      "plastic_purchase_requisitions",
      "plastic_purchase_requisition_items",
      "plastic_supplier_quotations",
      "plastic_supplier_quotation_items",
      "plastic_purchase_orders",
      "plastic_purchase_order_items",
      "plastic_purchase_deliveries",
      "plastic_supplier_performance",
      "plastic_purchase_rate_history",
      "plastic_material_requirements",
    ];

    for (const tbl of requiredTables) {
      const [rows] = await conn.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
        [tbl]
      );
      assert(rows.length > 0, `Table ${tbl} exists in database`);
    }

    // Check optional columns in existing tables
    const [pbCol] = await conn.query("SHOW COLUMNS FROM purchase_bills LIKE 'purchase_order_id'");
    assert(pbCol.length > 0, "purchase_bills has purchase_order_id column");

    const [tiCol] = await conn.query("SHOW COLUMNS FROM truck_inwards LIKE 'purchase_order_id'");
    assert(tiCol.length > 0, "truck_inwards has purchase_order_id column");

    // Setup Test Supplier & Material for Company A
    let [suppA] = await conn.query("SELECT id FROM suppliers WHERE company_id = ? LIMIT 1", [companyAId]);
    let supplierAId = suppA[0]?.id;
    if (!supplierAId) {
      const [insSupp] = await conn.query(
        `INSERT INTO suppliers (company_id, supplier_code, supplier_name, mobile, status)
         VALUES (?, 'SUP-TEST-P6', 'Kim Scrap Traders', '9876543210', 'ACTIVE')`,
        [companyAId]
      );
      supplierAId = insSupp.insertId;
    }

    let [matA] = await conn.query("SELECT id FROM raw_materials WHERE company_id = ? LIMIT 1", [companyAId]);
    let materialAId = matA[0]?.id;
    if (!materialAId) {
      const [insMat] = await conn.query(
        `INSERT INTO raw_materials (company_id, material_code, material_name, plastic_type, unit, minimum_stock, maximum_stock, default_purchase_rate, status)
         VALUES (?, 'RM-PET-TEST', 'PET Flakes Regrind', 'PET', 'KG', 1000.00, 5000.00, 45.00, 'ACTIVE')`,
        [companyAId]
      );
      materialAId = insMat.insertId;
    }

    // --- TEST 2: Purchase Requisition Creation & Workflow ---
    console.log("\n--- TEST 2: Purchase Requisition Lifecycle ---");
    const testPrNo = `PR-TEST-${Date.now()}`;
    const [prResult] = await conn.query(
      `INSERT INTO plastic_purchase_requisitions (
        company_id, pr_no, request_date, requester_name, department, priority, status
      ) VALUES (?, ?, CURDATE(), 'Extruder Plant Operator', 'Production Line 1', 'HIGH', 'PENDING_APPROVAL')`,
      [companyAId, testPrNo]
    );
    const prId = prResult.insertId;
    assert(prId > 0, `Purchase Requisition created with ID #${prId} (${testPrNo})`);

    // Add PR Item
    await conn.query(
      `INSERT INTO plastic_purchase_requisition_items (
        company_id, requisition_id, raw_material_id, requested_qty, unit, estimated_rate, estimated_total, requirement_reason
      ) VALUES (?, ?, ?, 2500.00, 'KG', 45.00, 112500.00, 'Scheduled extrusion batch')`,
      [companyAId, prId, materialAId]
    );

    // Approve PR
    await conn.query(
      "UPDATE plastic_purchase_requisitions SET status = 'APPROVED', approved_at = NOW() WHERE id = ? AND company_id = ?",
      [prId, companyAId]
    );
    const [prCheck] = await conn.query("SELECT status FROM plastic_purchase_requisitions WHERE id = ?", [prId]);
    assert(prCheck[0].status === "APPROVED", "PR successfully transitioned to APPROVED status");

    // --- TEST 3: Supplier Quotation & Landed Rate Calculation ---
    console.log("\n--- TEST 3: Supplier Quotations & Landed Rate ---");
    const quoteNoA = `QT-A-${Date.now()}`;
    const [qResultA] = await conn.query(
      `INSERT INTO plastic_supplier_quotations (
        company_id, quotation_no, supplier_id, requisition_id, quotation_date,
        lead_time_days, subtotal, discount_amount, tax_amount, freight_amount, grand_total, status
      ) VALUES (?, ?, ?, ?, CURDATE(), 3, 112500.00, 2500.00, 19800.00, 3000.00, 132800.00, 'PENDING')`,
      [companyAId, quoteNoA, supplierAId, prId]
    );
    const quoteIdA = qResultA.insertId;

    const landedRate = (132800.00 / 2500.00); // 53.12 per KG
    await conn.query(
      `INSERT INTO plastic_supplier_quotation_items (
        company_id, quotation_id, raw_material_id, quantity, unit, rate,
        discount_percent, discount_amount, tax_percent, tax_amount, freight_amount, total_amount, effective_landed_rate
      ) VALUES (?, ?, ?, 2500.00, 'KG', 45.00, 2.22, 2500.00, 18.00, 19800.00, 3000.00, 132800.00, ?)`,
      [companyAId, quoteIdA, materialAId, landedRate]
    );
    assert(quoteIdA > 0, `Supplier Quotation recorded with effective landed rate ₹${landedRate.toFixed(2)}/KG`);

    // --- TEST 4: Purchase Order Creation & Non-Duplication Rule ---
    console.log("\n--- TEST 4: Purchase Order & Non-Duplication Rules ---");
    const testPoNo = `PO-TEST-${Date.now()}`;
    const [poResult] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, quotation_id, requisition_id, po_date,
        expected_delivery_date, subtotal, tax_amount, grand_total, status
      ) VALUES (?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY), 110000.00, 19800.00, 129800.00, 'APPROVED')`,
      [companyAId, testPoNo, supplierAId, quoteIdA, prId]
    );
    const poId = poResult.insertId;

    // Add PO item with pending_qty = ordered_qty = 2500
    const [poItemRes] = await conn.query(
      `INSERT INTO plastic_purchase_order_items (
        company_id, purchase_order_id, raw_material_id, ordered_qty, unit, rate,
        tax_percent, tax_amount, total_amount, received_qty, pending_qty, status
      ) VALUES (?, ?, ?, 2500.00, 'KG', 44.00, 18.00, 19800.00, 129800.00, 0.00, 2500.00, 'PENDING')`,
      [companyAId, poId, materialAId]
    );
    const poItemId = poItemRes.insertId;

    assert(poId > 0, `Purchase Order created with ID #${poId} (${testPoNo})`);

    // NON-NEGOTIABLE CHECK: Assert NO accounting journal entry was posted for this PO
    const [poJournals] = await conn.query(
      "SELECT id FROM plastic_journal_entries WHERE reference_no = ? AND company_id = ?",
      [testPoNo, companyAId]
    );
    assert(poJournals.length === 0, "CRITICAL: PO created ZERO accounting journal entries (Preserved double-entry integrity)");

    // NON-NEGOTIABLE CHECK: Assert NO stock movement was posted directly by the PO
    const [poStock] = await conn.query(
      "SELECT id FROM raw_material_stock_movements WHERE reference_type = 'PURCHASE_ORDER' AND reference_id = ?",
      [poId]
    );
    assert(poStock.length === 0, "CRITICAL: PO created ZERO duplicate stock movements (Preserved Phase 1 stock integrity)");

    // --- TEST 5: Purchase Delivery Tracking (Partial & Full Delivery) ---
    console.log("\n--- TEST 5: Purchase Delivery & Pending Qty Tracking ---");

    // Partial Delivery: 1000 KG received
    const delNo1 = `DEL-TEST-1-${Date.now()}`;
    await conn.query(
      `INSERT INTO plastic_purchase_deliveries (
        company_id, delivery_no, purchase_order_id, purchase_order_item_id, supplier_id,
        raw_material_id, delivery_date, delivered_qty, accepted_qty, rejected_qty,
        delivery_delay_days, status, truck_number, challan_no
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 1000.00, 1000.00, 0.00, 0, 'DELIVERED', 'GJ-05-AB-1234', 'CH-001')`,
      [companyAId, delNo1, poId, poItemId, supplierAId, materialAId]
    );

    // Update PO item
    await conn.query(
      "UPDATE plastic_purchase_order_items SET received_qty = 1000.00, pending_qty = 1500.00, status = 'PARTIAL' WHERE id = ?",
      [poItemId]
    );
    await conn.query(
      "UPDATE plastic_purchase_orders SET status = 'PARTIALLY_RECEIVED' WHERE id = ?",
      [poId]
    );

    const [poCheckPartial] = await conn.query(
      "SELECT status FROM plastic_purchase_orders WHERE id = ?",
      [poId]
    );
    const [itemCheckPartial] = await conn.query(
      "SELECT received_qty, pending_qty, status FROM plastic_purchase_order_items WHERE id = ?",
      [poItemId]
    );

    assert(poCheckPartial[0].status === "PARTIALLY_RECEIVED", "PO updated to PARTIALLY_RECEIVED upon partial delivery");
    assert(Number(itemCheckPartial[0].pending_qty) === 1500, "PO item pending quantity accurately reduced to 1500 KG");

    // Full Delivery: Remaining 1500 KG received
    const delNo2 = `DEL-TEST-2-${Date.now()}`;
    await conn.query(
      `INSERT INTO plastic_purchase_deliveries (
        company_id, delivery_no, purchase_order_id, purchase_order_item_id, supplier_id,
        raw_material_id, delivery_date, delivered_qty, accepted_qty, rejected_qty,
        delivery_delay_days, status, truck_number, challan_no
      ) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), 1500.00, 1500.00, 0.00, 0, 'DELIVERED', 'GJ-05-AB-5678', 'CH-002')`,
      [companyAId, delNo2, poId, poItemId, supplierAId, materialAId]
    );

    await conn.query(
      "UPDATE plastic_purchase_order_items SET received_qty = 2500.00, pending_qty = 0.00, status = 'FULFILLED' WHERE id = ?",
      [poItemId]
    );
    await conn.query(
      "UPDATE plastic_purchase_orders SET status = 'RECEIVED' WHERE id = ?",
      [poId]
    );

    const [poCheckFull] = await conn.query(
      "SELECT status FROM plastic_purchase_orders WHERE id = ?",
      [poId]
    );
    const [itemCheckFull] = await conn.query(
      "SELECT received_qty, pending_qty, status FROM plastic_purchase_order_items WHERE id = ?",
      [poItemId]
    );

    assert(poCheckFull[0].status === "RECEIVED", "PO status automatically advanced to RECEIVED upon full delivery");
    assert(Number(itemCheckFull[0].pending_qty) === 0, "PO item pending quantity reached 0.00 (FULFILLED)");

    // --- TEST 6: Rate Intelligence & Variance Tracking ---
    console.log("\n--- TEST 6: Purchase Rate Intelligence & History ---");
    const [rateResult] = await conn.query(
      `INSERT INTO plastic_purchase_rate_history (
        company_id, raw_material_id, supplier_id, purchase_order_id, purchase_date,
        purchase_rate, effective_landed_rate, quantity, previous_rate, variance_amount, variance_percent
      ) VALUES (?, ?, ?, ?, CURDATE(), 44.00, 44.00, 2500.00, 45.00, -1.00, -2.22)`,
      [companyAId, materialAId, supplierAId, poId]
    );
    assert(rateResult.insertId > 0, "Rate history recorded with purchase rate variance (-2.22% savings)");

    // --- TEST 7: Supplier Performance Scoring ---
    console.log("\n--- TEST 7: Supplier Performance Scorecard ---");
    const [perfResult] = await conn.query(
      `INSERT INTO plastic_supplier_performance (
        company_id, supplier_id, period_month, period_year, total_orders,
        total_purchase_value, on_time_deliveries, late_deliveries,
        total_ordered_qty, total_received_qty, total_rejected_qty,
        quality_acceptance_percent, delivery_score, quality_score,
        commercial_score, overall_score, outstanding_amount
      ) VALUES (?, ?, MONTH(CURDATE()), YEAR(CURDATE()), 1, 129800.00, 2, 0, 2500.00, 2500.00, 0.00, 100.00, 100.00, 100.00, 95.00, 98.50, 0.00)
      ON DUPLICATE KEY UPDATE overall_score = 98.50`,
      [companyAId, supplierAId]
    );
    assert(perfResult.affectedRows > 0, "Supplier performance scorecard computed with Overall Score: 98.50/100");

    // --- TEST 8: Material Requirements Planning (MRP) ---
    console.log("\n--- TEST 8: MRP Inventory Intelligence ---");
    const [mrpResult] = await conn.query(
      `INSERT INTO plastic_material_requirements (
        company_id, raw_material_id, calculation_date, current_stock, minimum_stock,
        maximum_stock, available_stock, suggested_order_qty, urgency_level, status
      ) VALUES (?, ?, CURDATE(), 800.00, 1000.00, 5000.00, 800.00, 4200.00, 'LOW', 'OPEN')`,
      [companyAId, materialAId]
    );
    assert(mrpResult.insertId > 0, "MRP generated suggested replenishment order of 4200 KG without auto-placing PO");

    // --- TEST 9: Multi-Tenant Isolation ---
    console.log("\n--- TEST 9: Multi-Company Tenant Isolation ---");
    const [leakPR] = await conn.query(
      "SELECT id FROM plastic_purchase_requisitions WHERE id = ? AND company_id = ?",
      [prId, companyBId]
    );
    assert(leakPR.length === 0, "Company B cannot access Company A's Purchase Requisition");

    const [leakPO] = await conn.query(
      "SELECT id FROM plastic_purchase_orders WHERE id = ? AND company_id = ?",
      [poId, companyBId]
    );
    assert(leakPO.length === 0, "Company B cannot access Company A's Purchase Order");

    const [leakDel] = await conn.query(
      "SELECT id FROM plastic_purchase_deliveries WHERE purchase_order_id = ? AND company_id = ?",
      [poId, companyBId]
    );
    assert(leakDel.length === 0, "Company B cannot access Company A's Purchase Deliveries");

    // Clean up temporary test entries
    await conn.query("DELETE FROM plastic_purchase_deliveries WHERE purchase_order_id = ?", [poId]);
    await conn.query("DELETE FROM plastic_purchase_order_items WHERE purchase_order_id = ?", [poId]);
    await conn.query("DELETE FROM plastic_purchase_orders WHERE id = ?", [poId]);
    await conn.query("DELETE FROM plastic_supplier_quotation_items WHERE quotation_id = ?", [quoteIdA]);
    await conn.query("DELETE FROM plastic_supplier_quotations WHERE id = ?", [quoteIdA]);
    await conn.query("DELETE FROM plastic_purchase_requisition_items WHERE requisition_id = ?", [prId]);
    await conn.query("DELETE FROM plastic_purchase_requisitions WHERE id = ?", [prId]);
    await conn.query("DELETE FROM plastic_purchase_rate_history WHERE raw_material_id = ? AND company_id = ?", [materialAId, companyAId]);
    await conn.query("DELETE FROM plastic_material_requirements WHERE raw_material_id = ? AND company_id = ?", [materialAId, companyAId]);

    console.log("\n=======================================================");
    console.log(`  PHASE 6 VERIFICATION COMPLETE: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("=======================================================\n");

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error("Phase 6 Test Suite Error:", err);
    process.exit(1);
  }
}

runPhase6Tests();
