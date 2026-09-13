/**
 * Automated Verification Test Script for the 4 Targeted Fixes
 * 1. PO Deletion Protection with downstream delivery check
 * 2. Safe PO deletion & line item cleanup
 * 3. PR status restoration workflow preservation
 * 4. Multi-tenant company isolation on PO deletion
 * 5. Raw Material search by Grade/Quality, Color, Category, and Polymer Type
 */

const db = require("../config/db");
const poController = require("../controllers/purchaseOrderController");
const rmController = require("../controllers/rawMaterialController");

async function runVerification() {
  console.log("\n=======================================================");
  console.log("  RUNNING TARGETED FIXES VERIFICATION TEST SUITE");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Mock res helper
  function createMockRes() {
    return {
      statusCode: 200,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
  }

  const conn = db.promise();

  try {
    // 1. Get test company & admin
    const [companies] = await conn.query("SELECT id FROM companies LIMIT 2");
    if (companies.length === 0) throw new Error("No company found");
    const companyAId = companies[0].id;
    let companyBId = companies.length > 1 ? companies[1].id : null;
    if (!companyBId) {
      const [compB] = await conn.query("INSERT INTO companies (name, slug) VALUES (?, ?)", [
        "Company B Test",
        `comp-b-${Date.now()}`,
      ]);
      companyBId = compB.insertId;
    }

    const [admins] = await conn.query("SELECT id FROM admins WHERE company_id = ? LIMIT 1", [companyAId]);
    const adminId = admins.length > 0 ? admins[0].id : null;

    // Ensure a test supplier and raw material exist for Company A
    let [suppliers] = await conn.query("SELECT id FROM suppliers WHERE company_id = ? LIMIT 1", [companyAId]);
    let supplierId;
    if (suppliers.length === 0) {
      const [newSupp] = await conn.query(
        "INSERT INTO suppliers (company_id, supplier_code, supplier_name, mobile) VALUES (?, ?, ?, ?)",
        [companyAId, `SUPP-TEST-${Date.now()}`, "Test Supplier", "9876543210"]
      );
      supplierId = newSupp.insertId;
    } else {
      supplierId = suppliers[0].id;
    }

    let [mats] = await conn.query("SELECT id FROM raw_materials WHERE company_id = ? LIMIT 1", [companyAId]);
    let materialId;
    if (mats.length === 0) {
      const [newMat] = await conn.query(
        "INSERT INTO raw_materials (company_id, material_code, material_name, plastic_type, category, grade, color) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [companyAId, `MAT-TEST-${Date.now()}`, "PP Test Flakes", "PP", "Flakes", "A Grade", "Natural"]
      );
      materialId = newMat.insertId;
    } else {
      materialId = mats[0].id;
    }

    // =========================================================================
    // TEST SECTION 1: PO DELETION WITH DOWNSTREAM DELIVERY BLOCK
    // =========================================================================
    console.log("--- TEST SECTION 1: PO Deletion with Downstream Delivery Block ---");

    // Create a Purchase Order
    const poNo = `PO-TEST-${Date.now()}`;
    const [poRes] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, po_date, subtotal, grand_total, status, created_by
      ) VALUES (?, ?, ?, ?, 1000.00, 1000.00, 'APPROVED', ?)`,
      [companyAId, poNo, supplierId, "2026-09-13", adminId]
    );
    const testPoId = poRes.insertId;

    // Insert PO item
    await conn.query(
      `INSERT INTO plastic_purchase_order_items (
        company_id, purchase_order_id, raw_material_id, ordered_qty, unit, rate, total_amount, received_qty, pending_qty, status
      ) VALUES (?, ?, ?, 100.00, 'KG', 10.00, 1000.00, 0.00, 100.00, 'PENDING')`,
      [companyAId, testPoId, materialId]
    );

    // Insert a downstream delivery attached to this PO
    const deliveryNo = `DEL-TEST-${Date.now()}`;
    const [delRes] = await conn.query(
      `INSERT INTO plastic_purchase_deliveries (
        company_id, delivery_no, purchase_order_id, supplier_id, raw_material_id, delivery_date, delivered_qty, accepted_qty, status
      ) VALUES (?, ?, ?, ?, ?, '2026-09-13', 100.00, 100.00, 'DELIVERED')`,
      [companyAId, deliveryNo, testPoId, supplierId, materialId]
    );
    const testDelId = delRes.insertId;

    // Attempt delete while downstream delivery exists
    let req = { user: { company_id: companyAId, id: adminId }, params: { id: testPoId } };
    let res = createMockRes();

    await poController.deletePurchaseOrder(req, res);

    assert(res.statusCode === 400, "PO deletion blocked with HTTP 400 when downstream delivery exists");
    assert(
      res.jsonData?.success === false && res.jsonData?.message?.includes("downstream Purchase Delivery"),
      `Clear error message returned: "${res.jsonData?.message}"`
    );

    // Verify PO and items still exist
    const [poStillThere] = await conn.query("SELECT id FROM plastic_purchase_orders WHERE id = ?", [testPoId]);
    assert(poStillThere.length === 1, "PO is preserved and NOT deleted when downstream delivery exists");

    // Clean up test delivery so we can test successful delete
    await conn.query("DELETE FROM plastic_purchase_deliveries WHERE id = ?", [testDelId]);

    // =========================================================================
    // TEST SECTION 2: SAFE PO DELETION & LINE ITEMS CLEANUP
    // =========================================================================
    console.log("\n--- TEST SECTION 2: Safe PO Deletion & Items Cleanup ---");

    res = createMockRes();
    await poController.deletePurchaseOrder(req, res);

    assert(res.statusCode === 200, "PO deletion succeeded with HTTP 200 when safe");
    assert(res.jsonData?.success === true, "Response reports success = true");

    // Verify PO is gone
    const [poDeleted] = await conn.query("SELECT id FROM plastic_purchase_orders WHERE id = ?", [testPoId]);
    assert(poDeleted.length === 0, "Purchase Order record successfully deleted from database");

    // Verify PO line items are gone
    const [itemsDeleted] = await conn.query(
      "SELECT id FROM plastic_purchase_order_items WHERE purchase_order_id = ?",
      [testPoId]
    );
    assert(itemsDeleted.length === 0, "Purchase Order line items successfully cleaned up");

    // =========================================================================
    // TEST SECTION 3: PURCHASE REQUISITION WORKFLOW PRESERVATION
    // =========================================================================
    console.log("\n--- TEST SECTION 3: Requisition Workflow Preservation ---");

    // Create a PR in APPROVED status
    const prNo = `PR-TEST-${Date.now()}`;
    const [prRes] = await conn.query(
      `INSERT INTO plastic_purchase_requisitions (
        company_id, pr_no, request_date, requester_name, priority, status
      ) VALUES (?, ?, '2026-09-13', 'Tester', 'MEDIUM', 'CONVERTED_TO_PO')`,
      [companyAId, prNo]
    );
    const testPrId = prRes.insertId;

    // Create a PO linked to this PR
    const poFromPrNo = `PO-FROM-PR-${Date.now()}`;
    const [poPrRes] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, requisition_id, po_date, subtotal, grand_total, status, created_by
      ) VALUES (?, ?, ?, ?, '2026-09-13', 500.00, 500.00, 'DRAFT', ?)`,
      [companyAId, poFromPrNo, supplierId, testPrId, adminId]
    );
    const poPrId = poPrRes.insertId;

    // Delete this PO
    req = { user: { company_id: companyAId, id: adminId }, params: { id: poPrId } };
    res = createMockRes();
    await poController.deletePurchaseOrder(req, res);

    assert(res.statusCode === 200, "PO created from PR deleted successfully");

    // Verify PR status was safely reverted to APPROVED so PR workflow is intact
    const [prReverted] = await conn.query(
      "SELECT status FROM plastic_purchase_requisitions WHERE id = ?",
      [testPrId]
    );
    assert(
      prReverted[0]?.status === "APPROVED",
      `PR status safely reverted from CONVERTED_TO_PO to 'APPROVED' (actual: ${prReverted[0]?.status})`
    );

    // Clean up test PR
    await conn.query("DELETE FROM plastic_purchase_requisitions WHERE id = ?", [testPrId]);

    // =========================================================================
    // TEST SECTION 4: MULTI-TENANT ISOLATION ON PO DELETION
    // =========================================================================
    console.log("\n--- TEST SECTION 4: Multi-tenant Company Isolation ---");

    // Create PO under Company A
    const [isoPo] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, po_date, subtotal, grand_total, status
      ) VALUES (?, ?, ?, '2026-09-13', 200.00, 200.00, 'DRAFT')`,
      [companyAId, `PO-ISO-${Date.now()}`, supplierId]
    );
    const isoPoId = isoPo.insertId;

    // Company B attempts to delete Company A's PO
    req = { user: { company_id: companyBId, id: 9999 }, params: { id: isoPoId } };
    res = createMockRes();
    await poController.deletePurchaseOrder(req, res);

    assert(res.statusCode === 404, "Tenant isolation enforced: Company B cannot delete Company A's PO (404)");

    // Clean up iso PO
    await conn.query("DELETE FROM plastic_purchase_orders WHERE id = ?", [isoPoId]);

    // =========================================================================
    // TEST SECTION 5: RAW MATERIAL MULTI-FIELD SEARCH
    // =========================================================================
    console.log("\n--- TEST SECTION 5: Raw Material Multi-field Search ---");

    const uniqueCode = `MAT-SEARCH-${Date.now()}`;
    const uniqueGrade = `Grade-Premium-Ultra-${Date.now()}`;
    const uniqueColor = `Fluorescent-Amber-${Date.now()}`;
    const uniqueCategory = `Drum-Rigid-Custom-${Date.now()}`;

    const [rmRes] = await conn.query(
      `INSERT INTO raw_materials (
        company_id, material_code, material_name, category, plastic_type, grade, color, unit, status
      ) VALUES (?, ?, ?, ?, 'HDPE', ?, ?, 'KG', 'ACTIVE')`,
      [companyAId, uniqueCode, "HDPE Blow Mold Resin", uniqueCategory, uniqueGrade, uniqueColor]
    );
    const testRmId = rmRes.insertId;

    // Test A: Search by Grade / Quality (exact and case-insensitive partial)
    req = { user: { company_id: companyAId }, query: { search: uniqueGrade } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    let found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Search by Grade/Quality ("${uniqueGrade}") returns the material`);

    req = { user: { company_id: companyAId }, query: { search: uniqueGrade.toLowerCase() } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Search by Grade/Quality is case-insensitive`);

    // Test B: Search by Color
    req = { user: { company_id: companyAId }, query: { search: uniqueColor } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Search by Color ("${uniqueColor}") returns the material`);

    // Test C: Search by Scrap Form / Category
    req = { user: { company_id: companyAId }, query: { search: uniqueCategory } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Search by Category ("${uniqueCategory}") returns the material`);

    // Test D: Search by Material Name
    req = { user: { company_id: companyAId }, query: { search: "Blow Mold Resin" } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Existing search by Material Name still works`);

    // Test E: Search by Material Code
    req = { user: { company_id: companyAId }, query: { search: uniqueCode } };
    res = createMockRes();
    await rmController.getRawMaterials(req, res);
    found = (res.jsonData?.raw_materials || []).some((m) => m.id === testRmId);
    assert(found, `Existing search by Material Code still works`);

    // Clean up test material
    await conn.query("DELETE FROM raw_materials WHERE id = ?", [testRmId]);

    console.log("\n=======================================================");
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("=======================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    db.end();
  }
}

runVerification();
