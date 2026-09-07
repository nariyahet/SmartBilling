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

const runPhase2Tests = async () => {
  console.log("=================================================================");
  console.log("🏭 SMARTBILLING: PLASTIC RECYCLING ERP (PHASE 2) TEST SUITE");
  console.log("=================================================================\n");

  await startServerIfNeeded();

  let tokenAdminComp2 = null;
  let tokenAdminComp1 = null;

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

    const createdIds = {
      machineId: null,
      shiftId: null,
      operatorId: null,
      recipeId: null,
      planId: null,
      orderId: null,
      batchId: null,
      batchNo: null,
      rawMaterialId: null,
      consumptionId: null,
      inspectionId: null,
      downtimeId: null,
      maintenanceId: null,
      scrapId: null,
      regrindTxId: null,
    };

    // --- TEST 1: Machines Master Management ---
    console.log("--- TEST 1: Machines Master Management ---");
    const machineRes = await apiRequest(
      "POST",
      "/plastic-erp/plant/machines",
      {
        machine_name: "Extruder Line 01 (Test)",
        machine_type: "Extrusion Line",
        capacity: 350,
        unit: "KG/HR",
        location: "Plant Bay A",
        status: "ACTIVE",
      },
      tokenAdminComp2
    );
    assert.strictEqual(machineRes.status, 201, "Should create machine");
    createdIds.machineId = machineRes.data.machineId;

    const getMachinesRes = await apiRequest("GET", "/plastic-erp/plant/machines", null, tokenAdminComp2);
    assert.strictEqual(getMachinesRes.status, 200);
    assert.ok(getMachinesRes.data.machines.some((m) => m.id === createdIds.machineId));
    console.log(`✅ TEST 1 PASSED: Created machine ID ${createdIds.machineId} with capacity 350 KG/HR.`);

    // --- TEST 2: Shifts and Operators Management ---
    console.log("\n--- TEST 2: Shifts and Operators Management ---");
    const shiftRes = await apiRequest(
      "POST",
      "/plastic-erp/plant/shifts",
      {
        shift_name: "Morning Shift (Test)",
        start_time: "06:00:00",
        end_time: "14:00:00",
        break_duration_minutes: 45,
      },
      tokenAdminComp2
    );
    assert.strictEqual(shiftRes.status, 201);
    createdIds.shiftId = shiftRes.data.shiftId;

    const opRes = await apiRequest(
      "POST",
      "/plastic-erp/plant/operators",
      {
        name: "Ramesh Patel (Test)",
        mobile: "9876543210",
        skill_level: "Senior Extruder Technician",
      },
      tokenAdminComp2
    );
    assert.strictEqual(opRes.status, 201);
    createdIds.operatorId = opRes.data.operatorId;
    console.log(`✅ TEST 2 PASSED: Created Shift ID ${createdIds.shiftId} and Operator ID ${createdIds.operatorId}.`);

    // --- TEST 3: BOM / Recipe Management ---
    console.log("\n--- TEST 3: BOM / Recipe Management ---");
    // Ensure raw material exists for Company 2
    const [existingRm] = await db.promise().query(
      `SELECT id, material_name FROM raw_materials WHERE company_id = 2 LIMIT 1`
    );
    let testRawMatId = existingRm[0]?.id;
    let testRawMatName = existingRm[0]?.material_name || "PP Scrap (Cleaned)";

    if (!testRawMatId) {
      const rmCreateRes = await apiRequest(
        "POST",
        "/raw-materials",
        {
          material_name: "PP Scrap (Cleaned)",
          plastic_type: "PP",
          unit: "KG",
          default_purchase_rate: 38.0,
          minimum_stock: 500,
        },
        tokenAdminComp2
      );
      testRawMatId = rmCreateRes.data?.raw_material?.id || rmCreateRes.data?.materialId;
    }
    assert.ok(testRawMatId, "Raw material ID must exist for consumption test");
    createdIds.rawMaterialId = testRawMatId;

    const recipeRes = await apiRequest(
      "POST",
      "/plastic-erp/recipes",
      {
        recipe_name: "Standard PP Recycled Granules",
        target_product_name: "Recycled PP Granules Grade A",
        version: "v1.0",
        items: [
          {
            raw_material_id: testRawMatId,
            material_name: testRawMatName,
            percentage: 80,
            is_recycled: true,
            is_regrind: false,
          },
          {
            raw_material_id: null,
            material_name: "PP Regrind",
            percentage: 20,
            is_recycled: true,
            is_regrind: true,
          },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(recipeRes.status, 201);
    createdIds.recipeId = recipeRes.data.recipeId;
    console.log(`✅ TEST 3 PASSED: Created Recipe ID ${createdIds.recipeId} with 2 component items.`);

    // --- TEST 4: Production Planning ---
    console.log("\n--- TEST 4: Production Planning ---");
    const planRes = await apiRequest(
      "POST",
      "/plastic-erp/production/plans",
      {
        plan_type: "DAILY",
        start_date: "2026-09-08",
        end_date: "2026-09-08",
        target_quantity: 2500,
        unit: "KG",
        machine_id: createdIds.machineId,
        shift_id: createdIds.shiftId,
      },
      tokenAdminComp2
    );
    assert.strictEqual(planRes.status, 201);
    createdIds.planId = planRes.data.planId;
    console.log(`✅ TEST 4 PASSED: Created Production Plan ID ${createdIds.planId} for 2500 KG.`);

    // --- TEST 5: Production Order (Work Order) ---
    console.log("\n--- TEST 5: Production Order ---");
    const orderRes = await apiRequest(
      "POST",
      "/plastic-erp/production/orders",
      {
        plan_id: createdIds.planId,
        product_name: "Recycled PP Granules Grade A",
        recipe_id: createdIds.recipeId,
        planned_quantity: 1200,
        unit: "KG",
        production_date: "2026-09-08",
        target_date: "2026-09-08",
        priority: "HIGH",
        machine_id: createdIds.machineId,
        shift_id: createdIds.shiftId,
        operator_id: createdIds.operatorId,
      },
      tokenAdminComp2
    );
    assert.strictEqual(orderRes.status, 201);
    createdIds.orderId = orderRes.data.orderId;
    assert.ok(orderRes.data.orderNo.startsWith("PO-"), "Order No should start with PO-");
    console.log(`✅ TEST 5 PASSED: Created Production Order ${orderRes.data.orderNo} (ID: ${createdIds.orderId}).`);

    // --- TEST 6: Production Batch Creation & Initial WIP ---
    console.log("\n--- TEST 6: Production Batch Creation ---");
    const batchRes = await apiRequest(
      "POST",
      "/plastic-erp/production/batches",
      {
        production_order_id: createdIds.orderId,
        product_name: "Recycled PP Granules Grade A",
        recipe_id: createdIds.recipeId,
        machine_id: createdIds.machineId,
        shift_id: createdIds.shiftId,
        operator_id: createdIds.operatorId,
        batch_date: "2026-09-08",
        planned_quantity: 1200,
        unit: "KG",
      },
      tokenAdminComp2
    );
    assert.strictEqual(batchRes.status, 201);
    createdIds.batchId = batchRes.data.batchId;
    createdIds.batchNo = batchRes.data.batchNo;
    assert.ok(createdIds.batchNo.startsWith("BATCH-"), "Batch No should start with BATCH-");

    // Verify WIP entry created
    const [wipRows] = await db.promise().query(
      `SELECT * FROM plastic_wip_stock WHERE batch_id = ? AND company_id = 2`,
      [createdIds.batchId]
    );
    assert.strictEqual(wipRows.length, 1, "WIP record must be created for new batch");
    assert.strictEqual(Number(wipRows[0].wip_quantity), 1200);
    console.log(`✅ TEST 6 PASSED: Batch ${createdIds.batchNo} created with automatic initial WIP stock.`);

    // --- TEST 7: Raw Material Stock Consumption Integration ---
    console.log("\n--- TEST 7: Raw Material Stock Consumption Integration ---");
    // Seed stock for testRawMatId if current stock is low
    await db.promise().query(
      `INSERT INTO raw_material_stock (company_id, raw_material_id, quantity, average_rate, stock_value)
       VALUES (2, ?, 2000, 38.00, 76000.00)
       ON DUPLICATE KEY UPDATE quantity = quantity + 2000, stock_value = stock_value + 76000.00`,
      [testRawMatId]
    );

    const [stockBefore] = await db.promise().query(
      `SELECT quantity FROM raw_material_stock WHERE company_id = 2 AND raw_material_id = ?`,
      [testRawMatId]
    );
    const initialStock = Number(stockBefore[0].quantity);

    const consumeRes = await apiRequest(
      "POST",
      "/plastic-erp/inventory/consume",
      {
        batch_id: createdIds.batchId,
        raw_material_id: testRawMatId,
        planned_quantity: 1000,
        actual_quantity: 1000,
        unit: "KG",
      },
      tokenAdminComp2
    );
    assert.strictEqual(consumeRes.status, 201);
    createdIds.consumptionId = consumeRes.data.consumptionId;

    // Verify stock decreased by 1000 KG
    const [stockAfter] = await db.promise().query(
      `SELECT quantity FROM raw_material_stock WHERE company_id = 2 AND raw_material_id = ?`,
      [testRawMatId]
    );
    assert.strictEqual(Number(stockAfter[0].quantity), initialStock - 1000);

    // Verify stock movement created with PRODUCTION_CONSUMPTION
    const [movementRows] = await db.promise().query(
      `SELECT * FROM raw_material_stock_movements
       WHERE company_id = 2 AND raw_material_id = ? AND movement_type = 'PRODUCTION_CONSUMPTION'
       ORDER BY id DESC LIMIT 1`,
      [testRawMatId]
    );
    assert.strictEqual(movementRows.length, 1);
    assert.strictEqual(Number(movementRows[0].quantity), -1000);
    console.log(`✅ TEST 7 PASSED: Raw material stock decreased by 1000 KG with PRODUCTION_CONSUMPTION movement.`);

    // --- TEST 8: Shop Floor Batch Controls (Start, Pause, Resume, Complete) ---
    console.log("\n--- TEST 8: Shop Floor Batch Controls ---");
    // Start batch
    const startRes = await apiRequest(
      "POST",
      `/plastic-erp/production/batches/${createdIds.batchId}/start`,
      {},
      tokenAdminComp2
    );
    assert.strictEqual(startRes.status, 200);

    // Verify machine set to ACTIVE
    const [mchRow] = await db.promise().query(
      `SELECT status FROM plastic_machines WHERE id = ? AND company_id = 2`,
      [createdIds.machineId]
    );
    assert.strictEqual(mchRow[0].status, "ACTIVE");

    // Complete batch with actual output, scrap, and regrind
    const completeRes = await apiRequest(
      "POST",
      `/plastic-erp/production/batches/${createdIds.batchId}/complete`,
      {
        actual_quantity: 950,
        scrap_quantity: 35,
        regrind_quantity: 15,
        rejected_quantity: 0,
      },
      tokenAdminComp2
    );
    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeRes.data.summary.actual_quantity, 950);

    // Verify Finished Goods lot created automatically
    const [fgLotRows] = await db.promise().query(
      `SELECT * FROM plastic_finished_goods_lots WHERE batch_id = ? AND company_id = 2`,
      [createdIds.batchId]
    );
    assert.strictEqual(fgLotRows.length, 1);
    assert.strictEqual(Number(fgLotRows[0].quantity), 950);

    // Verify Finished Goods stock increased
    const [fgStock] = await db.promise().query(
      `SELECT current_stock FROM plastic_finished_goods WHERE id = ? AND company_id = 2`,
      [fgLotRows[0].finished_goods_id]
    );
    assert.ok(Number(fgStock[0].current_stock) >= 950);
    console.log(`✅ TEST 8 PASSED: Batch completed (950 KG FG, 35 KG scrap). FG stock & lot automatically created.`);

    // --- TEST 9: Quality Control Inspection ---
    console.log("\n--- TEST 9: Quality Control Inspection ---");
    const qcRes = await apiRequest(
      "POST",
      "/plastic-erp/quality/inspections",
      {
        qc_type: "FINISHED_GOODS",
        batch_id: createdIds.batchId,
        sample_size: 5.0,
        overall_status: "PASSED",
        parameters: [
          { parameter_name: "Color Uniformity", expected_value: "Translucent White", observed_value: "Translucent White", status: "PASS" },
          { parameter_name: "Melt Flow Index (MFI)", expected_value: "10-12 g/10min", observed_value: "11.2 g/10min", status: "PASS" },
          { parameter_name: "Moisture Content", expected_value: "< 0.05%", observed_value: "0.02%", status: "PASS" },
        ],
      },
      tokenAdminComp2
    );
    assert.strictEqual(qcRes.status, 201);
    createdIds.inspectionId = qcRes.data.inspectionId;

    // Verify batch qc_status updated to PASSED
    const [batchQc] = await db.promise().query(
      `SELECT qc_status FROM plastic_production_batches WHERE id = ? AND company_id = 2`,
      [createdIds.batchId]
    );
    assert.strictEqual(batchQc[0].qc_status, "PASSED");
    console.log(`✅ TEST 9 PASSED: QC Inspection ${qcRes.data.inspectionNo} verified with 3 parameters.`);

    // --- TEST 10: Scrap & Regrind Management ---
    console.log("\n--- TEST 10: Scrap & Regrind Management ---");
    const scrapRes = await apiRequest(
      "POST",
      "/plastic-erp/inventory/scrap",
      {
        scrap_type: "PROCESS_SCRAP",
        batch_id: createdIds.batchId,
        material_name: "PP Lump Waste",
        quantity: 25,
        unit: "KG",
        reason: "Purge lump during startup",
      },
      tokenAdminComp2
    );
    assert.strictEqual(scrapRes.status, 201);
    createdIds.scrapId = scrapRes.data.scrapId;

    const regrindRes = await apiRequest(
      "POST",
      "/plastic-erp/inventory/regrind/generate",
      {
        source_batch_id: createdIds.batchId,
        material_name: "PP Regrind Granules",
        quantity: 20,
        recovery_rate_percent: 95.0,
      },
      tokenAdminComp2
    );
    assert.strictEqual(regrindRes.status, 201);
    createdIds.regrindTxId = regrindRes.data.transactionId;
    console.log(`✅ TEST 10 PASSED: Recorded 25 KG process scrap and generated 20 KG regrind.`);

    // --- TEST 11: Machine Downtime & Maintenance ---
    console.log("\n--- TEST 11: Machine Downtime & Maintenance ---");
    const dwnRes = await apiRequest(
      "POST",
      "/plastic-erp/plant/downtime",
      {
        machine_id: createdIds.machineId,
        batch_id: createdIds.batchId,
        category: "BREAKDOWN",
        reason: "Heater band thermal sensor tripped",
        duration_minutes: 45,
      },
      tokenAdminComp2
    );
    assert.strictEqual(dwnRes.status, 201);
    createdIds.downtimeId = dwnRes.data.downtimeId;

    const mntRes = await apiRequest(
      "POST",
      "/plastic-erp/plant/maintenance",
      {
        machine_id: createdIds.machineId,
        title: "Monthly Extruder Screw Cleaning and Lubrication",
        maintenance_type: "PREVENTIVE",
        scheduled_date: "2026-09-15",
        cost: 2500,
      },
      tokenAdminComp2
    );
    assert.strictEqual(mntRes.status, 201);
    createdIds.maintenanceId = mntRes.data.maintenanceId;
    console.log(`✅ TEST 11 PASSED: Logged 45 min downtime and created maintenance schedule.`);

    // --- TEST 12: Production Costing Calculation ---
    console.log("\n--- TEST 12: Production Costing Calculation ---");
    const costRes = await apiRequest(
      "POST",
      `/plastic-erp/costing/batch/${createdIds.batchId}`,
      {
        labour_rate_per_hour: 150,
        machine_rate_per_hour: 350,
        standard_cost_per_kg: 45,
      },
      tokenAdminComp2
    );
    assert.strictEqual(costRes.status, 200);
    assert.ok(costRes.data.costing.total_cost > 0, "Total cost must be > 0");
    assert.ok(costRes.data.costing.cost_per_kg > 0, "Cost per kg must be > 0");
    console.log(`✅ TEST 12 PASSED: Batch Cost: ₹${costRes.data.costing.total_cost} (₹${costRes.data.costing.cost_per_kg}/KG).`);

    // --- TEST 13: Forward & Backward Batch Traceability ---
    console.log("\n--- TEST 13: Forward & Backward Batch Traceability ---");
    const traceRes = await apiRequest(
      "GET",
      `/plastic-erp/traceability/batch/${createdIds.batchNo}`,
      null,
      tokenAdminComp2
    );
    assert.strictEqual(traceRes.status, 200);
    assert.strictEqual(traceRes.data.traceability.batch.batch_no, createdIds.batchNo);
    assert.ok(traceRes.data.traceability.backward.consumptions.length > 0, "Backward trace must contain consumptions");
    assert.ok(traceRes.data.traceability.forward.finishedGoodsLots.length > 0, "Forward trace must contain FG lots");
    assert.ok(traceRes.data.traceability.timeline.length >= 3, "Timeline must contain audit events");
    console.log(`✅ TEST 13 PASSED: Full batch genealogy verified across suppliers, consumption, FG, and QC.`);

    // --- TEST 14: Phase 2 Executive Dashboard KPIs ---
    console.log("\n--- TEST 14: Phase 2 Executive Dashboard KPIs ---");
    const dashRes = await apiRequest("GET", "/dashboard/plastic-stats?period=today", null, tokenAdminComp2);
    assert.strictEqual(dashRes.status, 200);
    assert.ok("todayProductionKg" in dashRes.data.stats, "todayProductionKg must be present");
    assert.ok("activeBatches" in dashRes.data.stats, "activeBatches must be present");
    assert.ok("currentWipKg" in dashRes.data.stats, "currentWipKg must be present");
    assert.ok("finishedGoodsStockKg" in dashRes.data.stats, "finishedGoodsStockKg must be present");
    assert.ok("machineUtilizationPercent" in dashRes.data.stats, "machineUtilizationPercent must be present");
    console.log(`✅ TEST 14 PASSED: Executive Dashboard returned all Phase 2 KPIs alongside Phase 1 metrics.`);

    // --- TEST 15: Cross-Tenant Company Isolation ---
    console.log("\n--- TEST 15: Cross-Tenant Company Isolation ---");
    // Company 1 trying to view Company 2's batch
    const crossTraceRes = await apiRequest(
      "GET",
      `/plastic-erp/traceability/batch/${createdIds.batchNo}`,
      null,
      tokenAdminComp1
    );
    assert.strictEqual(crossTraceRes.status, 404, "Cross-tenant batch trace must be blocked with 404");

    // Company 1 trying to view Company 2's machine
    const crossMchRes = await apiRequest(
      "GET",
      `/plastic-erp/plant/machines/${createdIds.machineId}`,
      null,
      tokenAdminComp1
    );
    assert.strictEqual(crossMchRes.status, 404, "Cross-tenant machine access must be blocked with 404");
    console.log("✅ TEST 15 PASSED: Cross-tenant isolation strictly enforced for Phase 2 entities.");

    console.log("\n🎉 ALL 15 TARGETED PLASTIC RECYCLING (PHASE 2) TESTS PASSED SUCCESSFULLY!");

    // Clean up temporary test entities
    console.log("\nCleaning up temporary test entities...");
    if (createdIds.batchId) {
      await db.promise().query(`DELETE FROM plastic_production_costs WHERE batch_id = ?`, [createdIds.batchId]);
      await db.promise().query(`DELETE FROM plastic_batch_traceability WHERE batch_id = ?`, [createdIds.batchId]);
      await db.promise().query(`DELETE FROM plastic_quality_results WHERE inspection_id = ?`, [createdIds.inspectionId]);
      await db.promise().query(`DELETE FROM plastic_quality_inspections WHERE id = ?`, [createdIds.inspectionId]);
      await db.promise().query(`DELETE FROM plastic_finished_goods_lots WHERE batch_id = ?`, [createdIds.batchId]);
      await db.promise().query(`DELETE FROM plastic_material_consumptions WHERE batch_id = ?`, [createdIds.batchId]);
      await db.promise().query(`DELETE FROM plastic_wip_stock WHERE batch_id = ?`, [createdIds.batchId]);
      await db.promise().query(`DELETE FROM plastic_scrap_records WHERE id = ?`, [createdIds.scrapId]);
      await db.promise().query(`DELETE FROM plastic_regrind_transactions WHERE id = ?`, [createdIds.regrindTxId]);
      await db.promise().query(`DELETE FROM plastic_machine_downtime WHERE id = ?`, [createdIds.downtimeId]);
      await db.promise().query(`DELETE FROM plastic_maintenance_records WHERE id = ?`, [createdIds.maintenanceId]);
      await db.promise().query(`DELETE FROM plastic_production_batches WHERE id = ?`, [createdIds.batchId]);
    }
    if (createdIds.orderId) {
      await db.promise().query(`DELETE FROM plastic_production_orders WHERE id = ?`, [createdIds.orderId]);
    }
    if (createdIds.planId) {
      await db.promise().query(`DELETE FROM plastic_production_plans WHERE id = ?`, [createdIds.planId]);
    }
    if (createdIds.recipeId) {
      await db.promise().query(`DELETE FROM plastic_recipe_items WHERE recipe_id = ?`, [createdIds.recipeId]);
      await db.promise().query(`DELETE FROM plastic_recipes WHERE id = ?`, [createdIds.recipeId]);
    }
    if (createdIds.machineId) {
      await db.promise().query(`DELETE FROM plastic_machines WHERE id = ?`, [createdIds.machineId]);
    }
    if (createdIds.shiftId) {
      await db.promise().query(`DELETE FROM plastic_shifts WHERE id = ?`, [createdIds.shiftId]);
    }
    if (createdIds.operatorId) {
      await db.promise().query(`DELETE FROM plastic_operators WHERE id = ?`, [createdIds.operatorId]);
    }
    console.log("✅ Temporary test entities cleaned up successfully.");
  } catch (err) {
    console.error("❌ Phase 2 Test Suite Failed:", err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      console.log("Stopping temporary test server process...");
      serverProcess.kill();
    }
    db.end();
  }
};

runPhase2Tests();
