const db = require("../config/db");

// ==========================================
// 1. RAW MATERIAL CONSUMPTION (PHASE 1 STOCK INTEGRATION)
// ==========================================

exports.getMaterialConsumptions = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { batch_id, material_id } = req.query;

    let sql = `
      SELECT
        c.*,
        b.batch_no,
        rm.material_code,
        rm.plastic_type
      FROM plastic_material_consumptions c
      JOIN plastic_production_batches b ON c.batch_id = b.id AND c.company_id = b.company_id
      JOIN raw_materials rm ON c.raw_material_id = rm.id AND c.company_id = rm.company_id
      WHERE c.company_id = ?
    `;
    const params = [companyId];

    if (batch_id) {
      sql += ` AND c.batch_id = ?`;
      params.push(batch_id);
    }
    if (material_id) {
      sql += ` AND c.raw_material_id = ?`;
      params.push(material_id);
    }

    sql += ` ORDER BY c.consumed_at DESC`;

    const [consumptions] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      consumptions,
    });
  } catch (error) {
    console.error("Get Material Consumptions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch material consumptions",
    });
  }
};

exports.recordMaterialConsumption = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      batch_id,
      raw_material_id,
      planned_quantity = 0,
      actual_quantity,
      unit = "KG",
      lot_number,
      truck_inward_id,
    } = req.body;

    if (!batch_id || !raw_material_id || !actual_quantity || Number(actual_quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Batch ID, raw material ID, and valid actual quantity consumed are required",
      });
    }

    const qtyToDeduct = Number(actual_quantity);

    // Verify batch ownership
    const [batches] = await conn.query(
      `SELECT id, batch_no, product_name FROM plastic_production_batches WHERE id = ? AND company_id = ?`,
      [batch_id, companyId]
    );
    if (batches.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Batch not found or belongs to another company",
      });
    }
    const batch = batches[0];

    // Verify raw material ownership
    const [materials] = await conn.query(
      `SELECT id, material_name, material_code, default_purchase_rate FROM raw_materials WHERE id = ? AND company_id = ?`,
      [raw_material_id, companyId]
    );
    if (materials.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found or belongs to another company",
      });
    }
    const material = materials[0];

    await conn.beginTransaction();

    // 1. Fetch current stock with FOR UPDATE lock
    const [stockRows] = await conn.query(
      `SELECT id, quantity, average_rate, stock_value
       FROM raw_material_stock
       WHERE company_id = ? AND raw_material_id = ?
       FOR UPDATE`,
      [companyId, raw_material_id]
    );

    let currentStockQty = 0;
    let avgRate = Number(material.default_purchase_rate) || 0;
    let stockVal = 0;

    if (stockRows.length > 0) {
      currentStockQty = Number(stockRows[0].quantity) || 0;
      avgRate = Number(stockRows[0].average_rate) || avgRate;
      stockVal = Number(stockRows[0].stock_value) || 0;
    }

    if (currentStockQty < qtyToDeduct) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${material.material_name}. Available: ${currentStockQty} ${unit}, Requested: ${qtyToDeduct} ${unit}.`,
      });
    }

    const newStockQty = currentStockQty - qtyToDeduct;
    const deductionValue = qtyToDeduct * avgRate;
    const newStockVal = Math.max(0, stockVal - deductionValue);

    // 2. Deduct from raw_material_stock
    await conn.query(
      `UPDATE raw_material_stock
       SET quantity = ?, stock_value = ?, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = ? AND raw_material_id = ?`,
      [newStockQty, newStockVal, companyId, raw_material_id]
    );

    // 3. Create stock movement record (PRODUCTION_CONSUMPTION)
    await conn.query(
      `INSERT INTO raw_material_stock_movements
        (company_id, raw_material_id, movement_type, reference_type, reference_id, quantity, rate, total_value, balance_quantity, remarks, created_by)
       VALUES (?, ?, 'PRODUCTION_CONSUMPTION', 'plastic_production_batches', ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        raw_material_id,
        batch_id,
        -qtyToDeduct, // negative indicates reduction
        avgRate,
        deductionValue,
        newStockQty,
        `Consumed in Production Batch ${batch.batch_no}`,
        adminId,
      ]
    );

    // 4. Record in plastic_material_consumptions
    const plannedQty = Number(planned_quantity) || qtyToDeduct;
    const varianceQty = qtyToDeduct - plannedQty;

    const [consumptionResult] = await conn.query(
      `INSERT INTO plastic_material_consumptions
        (company_id, batch_id, raw_material_id, material_name, planned_quantity, actual_quantity, unit, rate, total_cost, variance_quantity, lot_number, truck_inward_id, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        batch_id,
        raw_material_id,
        material.material_name,
        plannedQty,
        qtyToDeduct,
        unit,
        avgRate,
        deductionValue,
        varianceQty,
        lot_number || null,
        truck_inward_id || null,
        adminId,
      ]
    );

    // 5. Record traceability event
    await conn.query(
      `INSERT INTO plastic_batch_traceability
        (company_id, batch_id, event_type, event_description, entity_type, entity_id, metadata)
       VALUES (?, ?, 'MATERIAL_CONSUMED', ?, 'plastic_material_consumptions', ?, ?)`,
      [
        companyId,
        batch_id,
        `Consumed ${qtyToDeduct} ${unit} of ${material.material_name} (${material.material_code}) at ₹${avgRate}/kg`,
        consumptionResult.insertId,
        JSON.stringify({
          raw_material_id,
          material_name: material.material_name,
          quantity: qtyToDeduct,
          rate: avgRate,
          total_cost: deductionValue,
          lot_number: lot_number || null,
        }),
      ]
    );

    await conn.commit();

    res.status(201).json({
      success: true,
      message: `Successfully consumed ${qtyToDeduct} ${unit} of ${material.material_name}`,
      consumptionId: consumptionResult.insertId,
      remainingStock: newStockQty,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Record Material Consumption Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record material consumption",
    });
  }
};

// ==========================================
// 2. WIP MANAGEMENT
// ==========================================

exports.getWipStock = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { stage, status } = req.query;

    let sql = `
      SELECT
        w.*,
        b.batch_no,
        m.machine_name
      FROM plastic_wip_stock w
      JOIN plastic_production_batches b ON w.batch_id = b.id AND w.company_id = b.company_id
      LEFT JOIN plastic_machines m ON w.machine_id = m.id AND w.company_id = m.company_id
      WHERE w.company_id = ?
    `;
    const params = [companyId];

    if (stage) {
      sql += ` AND w.stage = ?`;
      params.push(stage);
    }
    if (status) {
      sql += ` AND w.status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY w.id DESC`;

    const [wipRows] = await db.promise().query(sql, params);

    const totalWipKg = wipRows.reduce((acc, row) => acc + (Number(row.wip_quantity) || 0), 0);

    res.status(200).json({
      success: true,
      wipStock: wipRows,
      summary: {
        totalBatchesInWip: wipRows.length,
        totalWipKg,
      },
    });
  } catch (error) {
    console.error("Get WIP Stock Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch WIP stock",
    });
  }
};

exports.updateWipStage = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const { stage, location, machine_id, status } = req.body;

    const [existing] = await db.promise().query(
      `SELECT * FROM plastic_wip_stock WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "WIP record not found",
      });
    }

    await db.promise().query(
      `UPDATE plastic_wip_stock
       SET stage = COALESCE(?, stage),
           location = COALESCE(?, location),
           machine_id = COALESCE(?, machine_id),
           status = COALESCE(?, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND company_id = ?`,
      [stage, location, machine_id, status, id, companyId]
    );

    res.status(200).json({
      success: true,
      message: "WIP stage updated successfully",
    });
  } catch (error) {
    console.error("Update WIP Stage Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update WIP stage",
    });
  }
};

// ==========================================
// 3. FINISHED GOODS MANAGEMENT
// ==========================================

exports.getFinishedGoods = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plastic_type } = req.query;

    let sql = `SELECT * FROM plastic_finished_goods WHERE company_id = ?`;
    const params = [companyId];

    if (plastic_type) {
      sql += ` AND plastic_type = ?`;
      params.push(plastic_type);
    }

    sql += ` ORDER BY fg_name ASC`;

    const [fgItems] = await db.promise().query(sql, params);

    let totalFgStockKg = 0;
    for (const item of fgItems) {
      totalFgStockKg += Number(item.current_stock) || 0;
    }

    res.status(200).json({
      success: true,
      finishedGoods: fgItems,
      summary: {
        totalProducts: fgItems.length,
        totalFgStockKg,
      },
    });
  } catch (error) {
    console.error("Get Finished Goods Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch finished goods",
    });
  }
};

exports.getFinishedGoodsLots = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { finished_goods_id, batch_id } = req.query;

    let sql = `
      SELECT
        fgl.*,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        b.batch_no
      FROM plastic_finished_goods_lots fgl
      JOIN plastic_finished_goods fg ON fgl.finished_goods_id = fg.id AND fgl.company_id = fg.company_id
      JOIN plastic_production_batches b ON fgl.batch_id = b.id AND fgl.company_id = b.company_id
      WHERE fgl.company_id = ?
    `;
    const params = [companyId];

    if (finished_goods_id) {
      sql += ` AND fgl.finished_goods_id = ?`;
      params.push(finished_goods_id);
    }
    if (batch_id) {
      sql += ` AND fgl.batch_id = ?`;
      params.push(batch_id);
    }

    sql += ` ORDER BY fgl.production_date DESC`;

    const [lots] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      lots,
    });
  } catch (error) {
    console.error("Get FG Lots Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch finished goods lots",
    });
  }
};

exports.createFinishedGood = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const {
      fg_code,
      fg_name,
      plastic_type = "PP",
      grade,
      color,
      unit = "KG",
      minimum_stock = 0,
      standard_cost = 0,
      selling_price = 0,
      warehouse_location = "Main Warehouse",
      packing_type = "25 KG Bags",
    } = req.body;

    if (!fg_name) {
      return res.status(400).json({
        success: false,
        message: "Finished good product name is required",
      });
    }

    let code = fg_code;
    if (!code) {
      const [countRows] = await db.promise().query(
        `SELECT COUNT(id) AS count FROM plastic_finished_goods WHERE company_id = ?`,
        [companyId]
      );
      code = `FG-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    const [result] = await db.promise().query(
      `INSERT INTO plastic_finished_goods
        (company_id, fg_code, fg_name, plastic_type, grade, color, unit, current_stock, minimum_stock, standard_cost, selling_price, warehouse_location, packing_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, ?, ?)`,
      [
        companyId,
        code.trim().toUpperCase(),
        fg_name.trim(),
        plastic_type,
        grade || null,
        color || null,
        unit,
        Number(minimum_stock) || 0,
        Number(standard_cost) || 0,
        Number(selling_price) || 0,
        warehouse_location,
        packing_type,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Finished good created successfully",
      fgId: result.insertId,
      fgCode: code,
    });
  } catch (error) {
    console.error("Create FG Error:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "A finished good with this code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create finished good",
    });
  }
};

// ==========================================
// 4. SCRAP & WASTE MANAGEMENT
// ==========================================

exports.getScrapRecords = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { scrap_type, batch_id } = req.query;

    let sql = `
      SELECT
        s.*,
        b.batch_no,
        m.machine_name
      FROM plastic_scrap_records s
      LEFT JOIN plastic_production_batches b ON s.batch_id = b.id AND s.company_id = b.company_id
      LEFT JOIN plastic_machines m ON s.machine_id = m.id AND s.company_id = m.company_id
      WHERE s.company_id = ?
    `;
    const params = [companyId];

    if (scrap_type) {
      sql += ` AND s.scrap_type = ?`;
      params.push(scrap_type);
    }
    if (batch_id) {
      sql += ` AND s.batch_id = ?`;
      params.push(batch_id);
    }

    sql += ` ORDER BY s.recorded_at DESC`;

    const [scraps] = await db.promise().query(sql, params);

    const totalScrapKg = scraps.reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);
    const reusableScrapKg = scraps
      .filter((r) => r.is_reusable === 1)
      .reduce((acc, row) => acc + (Number(row.quantity) || 0), 0);

    res.status(200).json({
      success: true,
      scrapRecords: scraps,
      summary: {
        totalScrapKg,
        reusableScrapKg,
        nonReusableScrapKg: totalScrapKg - reusableScrapKg,
      },
    });
  } catch (error) {
    console.error("Get Scrap Records Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch scrap records",
    });
  }
};

exports.recordScrap = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      scrap_type = "PROCESS_SCRAP",
      batch_id,
      machine_id,
      shift_id,
      material_id,
      material_name,
      quantity,
      unit = "KG",
      reason,
      is_reusable = 1,
    } = req.body;

    if (!material_name || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Material name and valid scrap quantity are required",
      });
    }

    const [countRows] = await db.promise().query(
      `SELECT COUNT(id) AS count FROM plastic_scrap_records WHERE company_id = ?`,
      [companyId]
    );
    const scrapNo = `SCRAP-${1000 + (countRows[0]?.count || 0) + 1}`;

    const [result] = await db.promise().query(
      `INSERT INTO plastic_scrap_records
        (company_id, scrap_no, scrap_type, batch_id, machine_id, shift_id, material_id, material_name, quantity, unit, reason, is_reusable, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED', ?)`,
      [
        companyId,
        scrapNo,
        scrap_type,
        batch_id || null,
        machine_id || null,
        shift_id || null,
        material_id || null,
        material_name.trim(),
        Number(quantity),
        unit,
        reason || null,
        is_reusable ? 1 : 0,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Scrap recorded successfully",
      scrapId: result.insertId,
      scrapNo,
    });
  } catch (error) {
    console.error("Record Scrap Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record scrap",
    });
  }
};

// ==========================================
// 5. REGRIND MANAGEMENT
// ==========================================

exports.getRegrindTransactions = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { type, material_id } = req.query;

    let sql = `SELECT * FROM plastic_regrind_transactions WHERE company_id = ?`;
    const params = [companyId];

    if (type) {
      sql += ` AND transaction_type = ?`;
      params.push(type);
    }
    if (material_id) {
      sql += ` AND material_id = ?`;
      params.push(material_id);
    }

    sql += ` ORDER BY transaction_date DESC`;

    const [transactions] = await db.promise().query(sql, params);

    let totalGenerated = 0;
    let totalConsumed = 0;

    for (const tx of transactions) {
      const q = Number(tx.quantity) || 0;
      if (tx.transaction_type === "GENERATION") totalGenerated += q;
      if (tx.transaction_type === "CONSUMPTION") totalConsumed += q;
    }

    res.status(200).json({
      success: true,
      transactions,
      summary: {
        totalGeneratedKg: totalGenerated,
        totalConsumedKg: totalConsumed,
        currentRegrindStockKg: Math.max(0, totalGenerated - totalConsumed),
      },
    });
  } catch (error) {
    console.error("Get Regrind Transactions Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch regrind transactions",
    });
  }
};

exports.recordRegrindGeneration = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      source_batch_id,
      material_id,
      material_name,
      quantity,
      unit = "KG",
      recovery_rate_percent = 100,
      notes,
    } = req.body;

    if (!material_name || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Material name and valid regrind quantity are required",
      });
    }

    const [countRows] = await db.promise().query(
      `SELECT COUNT(id) AS count FROM plastic_regrind_transactions WHERE company_id = ?`,
      [companyId]
    );
    const txNo = `RGN-${1000 + (countRows[0]?.count || 0) + 1}`;

    const [result] = await db.promise().query(
      `INSERT INTO plastic_regrind_transactions
        (company_id, transaction_no, transaction_type, source_batch_id, material_id, material_name, quantity, unit, recovery_rate_percent, notes, created_by)
       VALUES (?, ?, 'GENERATION', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        txNo,
        source_batch_id || null,
        material_id || null,
        material_name.trim(),
        Number(quantity),
        unit,
        Number(recovery_rate_percent) || 100,
        notes || null,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Regrind generation recorded successfully",
      transactionId: result.insertId,
      transactionNo: txNo,
    });
  } catch (error) {
    console.error("Record Regrind Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record regrind generation",
    });
  }
};
