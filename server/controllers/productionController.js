const db = require("../config/db");

// ==========================================
// 1. PRODUCTION PLANNING
// ==========================================

exports.getProductionPlans = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, type } = req.query;

    let sql = `
      SELECT
        p.*,
        m.machine_name,
        m.machine_code,
        s.shift_name
      FROM plastic_production_plans p
      LEFT JOIN plastic_machines m ON p.machine_id = m.id AND p.company_id = m.company_id
      LEFT JOIN plastic_shifts s ON p.shift_id = s.id AND p.company_id = s.company_id
      WHERE p.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND p.status = ?`;
      params.push(status);
    }
    if (type) {
      sql += ` AND p.plan_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY p.start_date DESC`;

    const [plans] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Get Production Plans Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production plans",
    });
  }
};

exports.createProductionPlan = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      plan_code,
      plan_type = "DAILY",
      start_date,
      end_date,
      target_quantity,
      unit = "KG",
      machine_id,
      shift_id,
      notes,
    } = req.body;

    if (!start_date || !end_date || !target_quantity) {
      return res.status(400).json({
        success: false,
        message: "Start date, end date, and target quantity are required",
      });
    }

    let code = plan_code;
    if (!code) {
      const [countRows] = await db.promise().query(
        `SELECT COUNT(id) AS count FROM plastic_production_plans WHERE company_id = ?`,
        [companyId]
      );
      code = `PLAN-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_production_plans
        (company_id, plan_code, plan_type, start_date, end_date, target_quantity, unit, machine_id, shift_id, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?)`,
      [
        companyId,
        code.trim().toUpperCase(),
        plan_type,
        start_date,
        end_date,
        Number(target_quantity) || 0,
        unit || "KG",
        machine_id || null,
        shift_id || null,
        notes || null,
        adminId || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Production plan created successfully",
      planId: result.insertId,
      planCode: code,
    });
  } catch (error) {
    console.error("Create Production Plan Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A production plan with this code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create production plan",
    });
  }
};

exports.updateProductionPlanStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const [result] = await db.promise().query(
      `UPDATE plastic_production_plans SET status = ? WHERE id = ? AND company_id = ?`,
      [status, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Production plan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Production plan status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update Plan Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update production plan status",
    });
  }
};

// ==========================================
// 2. PRODUCTION ORDERS (WORK ORDERS)
// ==========================================

exports.getProductionOrders = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, priority } = req.query;

    let sql = `
      SELECT
        po.*,
        m.machine_name,
        m.machine_code,
        s.shift_name,
        o.name AS operator_name,
        r.recipe_name,
        r.recipe_code,
        (SELECT COUNT(id) FROM plastic_production_batches WHERE production_order_id = po.id AND company_id = po.company_id) AS batch_count,
        COALESCE((SELECT SUM(actual_quantity) FROM plastic_production_batches WHERE production_order_id = po.id AND company_id = po.company_id), 0) AS completed_quantity
      FROM plastic_production_orders po
      LEFT JOIN plastic_machines m ON po.machine_id = m.id AND po.company_id = m.company_id
      LEFT JOIN plastic_shifts s ON po.shift_id = s.id AND po.company_id = s.company_id
      LEFT JOIN plastic_operators o ON po.operator_id = o.id AND po.company_id = o.company_id
      LEFT JOIN plastic_recipes r ON po.recipe_id = r.id AND po.company_id = r.company_id
      WHERE po.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND po.status = ?`;
      params.push(status);
    }
    if (priority) {
      sql += ` AND po.priority = ?`;
      params.push(priority);
    }

    sql += ` ORDER BY po.id DESC`;

    const [orders] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Get Production Orders Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production orders",
    });
  }
};

exports.getProductionOrderById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [orders] = await db.promise().query(
      `SELECT
        po.*,
        m.machine_name,
        m.machine_code,
        s.shift_name,
        o.name AS operator_name,
        r.recipe_name
       FROM plastic_production_orders po
       LEFT JOIN plastic_machines m ON po.machine_id = m.id AND po.company_id = m.company_id
       LEFT JOIN plastic_shifts s ON po.shift_id = s.id AND po.company_id = s.company_id
       LEFT JOIN plastic_operators o ON po.operator_id = o.id AND po.company_id = o.company_id
       LEFT JOIN plastic_recipes r ON po.recipe_id = r.id AND po.company_id = r.company_id
       WHERE po.id = ? AND po.company_id = ?`,
      [id, companyId]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Production order not found",
      });
    }

    // Fetch batches linked to this order
    const [batches] = await db.promise().query(
      `SELECT * FROM plastic_production_batches WHERE production_order_id = ? AND company_id = ? ORDER BY id DESC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      order: {
        ...orders[0],
        batches,
      },
    });
  } catch (error) {
    console.error("Get Production Order By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production order",
    });
  }
};

exports.createProductionOrder = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      production_order_no,
      plan_id,
      product_id,
      product_name,
      recipe_id,
      planned_quantity,
      unit = "KG",
      production_date,
      target_date,
      priority = "NORMAL",
      machine_id,
      shift_id,
      operator_id,
      notes,
    } = req.body;

    if (!product_name || !planned_quantity || !production_date || !target_date) {
      return res.status(400).json({
        success: false,
        message: "Product name, planned quantity, production date, and target date are required",
      });
    }

    let orderNo = production_order_no;
    if (!orderNo) {
      const [countRows] = await db.promise().query(
        `SELECT COUNT(id) AS count FROM plastic_production_orders WHERE company_id = ?`,
        [companyId]
      );
      orderNo = `PO-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_production_orders
        (company_id, production_order_no, plan_id, product_id, product_name, recipe_id, planned_quantity, unit, production_date, target_date, priority, machine_id, shift_id, operator_id, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', ?, ?)`,
      [
        companyId,
        orderNo.trim().toUpperCase(),
        plan_id || null,
        product_id || null,
        product_name.trim(),
        recipe_id || null,
        Number(planned_quantity) || 0,
        unit || "KG",
        production_date,
        target_date,
        priority || "NORMAL",
        machine_id || null,
        shift_id || null,
        operator_id || null,
        notes || null,
        adminId || null,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Production order created successfully",
      orderId: result.insertId,
      orderNo,
    });
  } catch (error) {
    console.error("Create Production Order Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A production order with this number already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create production order",
    });
  }
};

exports.updateProductionOrderStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required",
      });
    }

    const [result] = await db.promise().query(
      `UPDATE plastic_production_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
      [status, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Production order not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Production order status updated to ${status}`,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update production order status",
    });
  }
};

// ==========================================
// 3. PRODUCTION BATCHES & SHOP FLOOR CONTROLS
// ==========================================

exports.getProductionBatches = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, machine_id, shift_id, qc_status } = req.query;

    let sql = `
      SELECT
        b.*,
        po.production_order_no,
        m.machine_name,
        m.machine_code,
        s.shift_name,
        o.name AS operator_name,
        r.recipe_name
      FROM plastic_production_batches b
      LEFT JOIN plastic_production_orders po ON b.production_order_id = po.id AND b.company_id = po.company_id
      LEFT JOIN plastic_machines m ON b.machine_id = m.id AND b.company_id = m.company_id
      LEFT JOIN plastic_shifts s ON b.shift_id = s.id AND b.company_id = s.company_id
      LEFT JOIN plastic_operators o ON b.operator_id = o.id AND b.company_id = o.company_id
      LEFT JOIN plastic_recipes r ON b.recipe_id = r.id AND b.company_id = r.company_id
      WHERE b.company_id = ?
    `;
    const params = [companyId];

    if (status) {
      sql += ` AND b.status = ?`;
      params.push(status);
    }
    if (machine_id) {
      sql += ` AND b.machine_id = ?`;
      params.push(machine_id);
    }
    if (shift_id) {
      sql += ` AND b.shift_id = ?`;
      params.push(shift_id);
    }
    if (qc_status) {
      sql += ` AND b.qc_status = ?`;
      params.push(qc_status);
    }

    sql += ` ORDER BY b.id DESC`;

    const [batches] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      batches,
    });
  } catch (error) {
    console.error("Get Batches Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch production batches",
    });
  }
};

exports.getProductionBatchById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [batches] = await db.promise().query(
      `SELECT
        b.*,
        po.production_order_no,
        m.machine_name,
        m.machine_code,
        s.shift_name,
        o.name AS operator_name,
        r.recipe_name
       FROM plastic_production_batches b
       LEFT JOIN plastic_production_orders po ON b.production_order_id = po.id AND b.company_id = po.company_id
       LEFT JOIN plastic_machines m ON b.machine_id = m.id AND b.company_id = m.company_id
       LEFT JOIN plastic_shifts s ON b.shift_id = s.id AND b.company_id = s.company_id
       LEFT JOIN plastic_operators o ON b.operator_id = o.id AND b.company_id = o.company_id
       LEFT JOIN plastic_recipes r ON b.recipe_id = r.id AND b.company_id = r.company_id
       WHERE b.id = ? AND b.company_id = ?`,
      [id, companyId]
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const batch = batches[0];

    // Fetch material consumptions
    const [consumptions] = await db.promise().query(
      `SELECT * FROM plastic_material_consumptions WHERE batch_id = ? AND company_id = ? ORDER BY id ASC`,
      [id, companyId]
    );

    // Fetch scrap records
    const [scraps] = await db.promise().query(
      `SELECT * FROM plastic_scrap_records WHERE batch_id = ? AND company_id = ? ORDER BY id ASC`,
      [id, companyId]
    );

    // Fetch traceability events
    const [traceEvents] = await db.promise().query(
      `SELECT * FROM plastic_batch_traceability WHERE batch_id = ? AND company_id = ? ORDER BY created_at ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      batch: {
        ...batch,
        consumptions,
        scraps,
        traceEvents,
      },
    });
  } catch (error) {
    console.error("Get Batch By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch batch details",
    });
  }
};

exports.createProductionBatch = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      batch_no,
      production_order_id,
      product_id,
      product_name,
      recipe_id,
      machine_id,
      shift_id,
      operator_id,
      batch_date,
      planned_quantity,
      unit = "KG",
      notes,
    } = req.body;

    if (!product_name || !planned_quantity || !batch_date) {
      return res.status(400).json({
        success: false,
        message: "Product name, planned quantity, and batch date are required",
      });
    }

    let bNo = batch_no;
    if (!bNo) {
      const [countRows] = await conn.query(
        `SELECT COUNT(id) AS count FROM plastic_production_batches WHERE company_id = ?`,
        [companyId]
      );
      bNo = `BATCH-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO plastic_production_batches
        (company_id, batch_no, production_order_id, product_id, product_name, recipe_id, machine_id, shift_id, operator_id, batch_date, planned_quantity, unit, status, qc_status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNED', 'PENDING', ?, ?)`,
      [
        companyId,
        bNo.trim().toUpperCase(),
        production_order_id || null,
        product_id || null,
        product_name.trim(),
        recipe_id || null,
        machine_id || null,
        shift_id || null,
        operator_id || null,
        batch_date,
        Number(planned_quantity) || 0,
        unit || "KG",
        notes || null,
        adminId || null,
      ]
    );

    const batchId = result.insertId;

    // Log initial traceability event
    await conn.query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description, entity_type, entity_id)
       VALUES (?, ?, 'BATCH_CREATED', ?, 'plastic_production_batches', ?)`,
      [
        companyId,
        batchId,
        `Production batch ${bNo} created for ${product_name} (${planned_quantity} ${unit})`,
        batchId,
      ]
    );

    // Initial WIP entry
    await conn.query(
      `INSERT INTO plastic_wip_stock
        (company_id, batch_id, product_name, stage, machine_id, location, wip_quantity, unit, status)
       VALUES (?, ?, ?, 'SORTING', ?, 'Shop Floor 1', ?, ?, 'OPEN')`,
      [
        companyId,
        batchId,
        product_name.trim(),
        machine_id || null,
        Number(planned_quantity) || 0,
        unit || "KG",
      ]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "Production batch created successfully",
      batchId,
      batchNo: bNo,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Create Production Batch Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A batch with this number already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create production batch",
    });
  }
};

// ==========================================
// 4. SHOP FLOOR CONTROLS (START, PAUSE, COMPLETE)
// ==========================================

exports.startBatch = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [batches] = await conn.query(
      `SELECT * FROM plastic_production_batches WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const batch = batches[0];
    await conn.beginTransaction();

    await conn.query(
      `UPDATE plastic_production_batches
       SET status = 'RUNNING',
           start_time = COALESCE(start_time, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    // If machine attached, mark ACTIVE
    if (batch.machine_id) {
      await conn.query(
        `UPDATE plastic_machines SET status = 'ACTIVE' WHERE id = ? AND company_id = ?`,
        [batch.machine_id, companyId]
      );
    }

    // Update WIP status
    await conn.query(
      `UPDATE plastic_wip_stock SET status = 'PROCESSING' WHERE batch_id = ? AND company_id = ?`,
      [id, companyId]
    );

    // Traceability event
    await conn.query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description, entity_type, entity_id)
       VALUES (?, ?, 'BATCH_STARTED', ?, 'plastic_production_batches', ?)`,
      [
        companyId,
        id,
        `Batch ${batch.batch_no} started on shop floor machine ${batch.machine_id || "default"}`,
        id,
      ]
    );

    await conn.commit();

    res.status(200).json({
      success: true,
      message: `Batch ${batch.batch_no} is now RUNNING`,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Start Batch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start batch",
    });
  }
};

exports.pauseBatch = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { reason = "Temporary halt" } = req.body;

    const [result] = await db.promise().query(
      `UPDATE plastic_production_batches
       SET status = 'PAUSED', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    await db.promise().query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description)
       VALUES (?, ?, 'BATCH_PAUSED', ?)`,
      [companyId, id, `Batch paused. Reason: ${reason}`]
    );

    res.status(200).json({
      success: true,
      message: "Batch paused",
    });
  } catch (error) {
    console.error("Pause Batch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to pause batch",
    });
  }
};

exports.resumeBatch = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [result] = await db.promise().query(
      `UPDATE plastic_production_batches
       SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    await db.promise().query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description)
       VALUES (?, ?, 'BATCH_RESUMED', 'Batch resumed on shop floor')`,
      [companyId, id]
    );

    res.status(200).json({
      success: true,
      message: "Batch resumed and is now RUNNING",
    });
  } catch (error) {
    console.error("Resume Batch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resume batch",
    });
  }
};

exports.completeBatch = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      actual_quantity = 0,
      rejected_quantity = 0,
      scrap_quantity = 0,
      regrind_quantity = 0,
    } = req.body;

    const [batches] = await conn.query(
      `SELECT * FROM plastic_production_batches WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found",
      });
    }

    const batch = batches[0];
    const actualQty = Number(actual_quantity) || 0;
    const rejectedQty = Number(rejected_quantity) || 0;
    const scrapQty = Number(scrap_quantity) || 0;
    const regrindQty = Number(regrind_quantity) || 0;
    const plannedQty = Number(batch.planned_quantity) || 1;

    const totalOutput = actualQty + scrapQty + rejectedQty;
    const recoveryPercent = totalOutput > 0 ? ((actualQty / totalOutput) * 100).toFixed(2) : 100.00;
    const efficiencyPercent = plannedQty > 0 ? ((actualQty / plannedQty) * 100).toFixed(2) : 100.00;

    await conn.beginTransaction();

    // 1. Update batch record
    await conn.query(
      `UPDATE plastic_production_batches
       SET status = 'COMPLETED',
           actual_quantity = ?,
           rejected_quantity = ?,
           scrap_quantity = ?,
           regrind_quantity = ?,
           efficiency_percent = ?,
           end_time = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [actualQty, rejectedQty, scrapQty, regrindQty, efficiencyPercent, id, companyId]
    );

    // 2. Mark WIP as COMPLETED
    await conn.query(
      `UPDATE plastic_wip_stock
       SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP
       WHERE batch_id = ? AND company_id = ?`,
      [id, companyId]
    );

    // 3. Auto-create Finished Goods Lot if actualQty > 0
    if (actualQty > 0) {
      // Find or create Finished Goods catalog item
      let fgId = null;
      const [existingFg] = await conn.query(
        `SELECT id FROM plastic_finished_goods WHERE company_id = ? AND fg_name = ?`,
        [companyId, batch.product_name]
      );

      if (existingFg.length > 0) {
        fgId = existingFg[0].id;
        // Increase FG stock
        await conn.query(
          `UPDATE plastic_finished_goods
           SET current_stock = current_stock + ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND company_id = ?`,
          [actualQty, fgId, companyId]
        );
      } else {
        const [fgCount] = await conn.query(
          `SELECT COUNT(id) AS count FROM plastic_finished_goods WHERE company_id = ?`,
          [companyId]
        );
        const fgCode = `FG-${1000 + (fgCount[0]?.count || 0) + 1}`;
        const [newFg] = await conn.query(
          `INSERT INTO plastic_finished_goods
            (company_id, fg_code, fg_name, plastic_type, current_stock, standard_cost, selling_price, packing_type)
           VALUES (?, ?, ?, 'RECYCLED_POLYMER', ?, 0.00, 0.00, '25 KG Bags')`,
          [companyId, fgCode, batch.product_name, actualQty]
        );
        fgId = newFg.insertId;
      }

      // Create FG Lot record
      const lotNumber = `LOT-${batch.batch_no}`;
      await conn.query(
        `INSERT INTO plastic_finished_goods_lots
          (company_id, finished_goods_id, batch_id, lot_number, quantity, unit, qc_status, dispatch_status, production_date)
         VALUES (?, ?, ?, ?, ?, ?, 'PASSED', 'READY', CURDATE())`,
        [companyId, fgId, id, lotNumber, actualQty, batch.unit || "KG"]
      );
    }

    // 4. Auto-create Scrap Record if scrapQty > 0
    if (scrapQty > 0) {
      const [scrapCount] = await conn.query(
        `SELECT COUNT(id) AS count FROM plastic_scrap_records WHERE company_id = ?`,
        [companyId]
      );
      const scrapNo = `SCRAP-${1000 + (scrapCount[0]?.count || 0) + 1}`;
      await conn.query(
        `INSERT INTO plastic_scrap_records
          (company_id, scrap_no, scrap_type, batch_id, machine_id, shift_id, material_name, quantity, unit, reason, is_reusable, status)
         VALUES (?, ?, 'PROCESS_SCRAP', ?, ?, ?, ?, ?, ?, 'Generated during batch extrusion', 1, 'GENERATED')`,
        [
          companyId,
          scrapNo,
          id,
          batch.machine_id || null,
          batch.shift_id || null,
          batch.product_name,
          scrapQty,
          batch.unit || "KG",
        ]
      );
    }

    // 5. Traceability event
    await conn.query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description, metadata)
       VALUES (?, ?, 'BATCH_COMPLETED', ?, ?)`,
      [
        companyId,
        id,
        `Batch completed: ${actualQty} ${batch.unit} FG produced, ${scrapQty} scrap, ${rejectedQty} rejected. Efficiency: ${efficiencyPercent}%`,
        JSON.stringify({
          actual_quantity: actualQty,
          scrap_quantity: scrapQty,
          rejected_quantity: rejectedQty,
          efficiency_percent: efficiencyPercent,
          recovery_percent: recoveryPercent,
        }),
      ]
    );

    await conn.commit();

    res.status(200).json({
      success: true,
      message: `Batch ${batch.batch_no} completed successfully`,
      summary: {
        actual_quantity: actualQty,
        scrap_quantity: scrapQty,
        rejected_quantity: rejectedQty,
        regrind_quantity: regrindQty,
        efficiency_percent: Number(efficiencyPercent),
        recovery_percent: Number(recoveryPercent),
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error("Complete Batch Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete batch",
    });
  }
};
