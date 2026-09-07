const db = require("../config/db");

exports.getStockSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { low_stock_only, plastic_type } = req.query;

    let sql = `
      SELECT
        rm.id AS raw_material_id,
        rm.material_code,
        rm.material_name,
        rm.plastic_type,
        rm.grade,
        rm.color,
        rm.unit,
        rm.minimum_stock,
        rm.maximum_stock,
        COALESCE(rms.quantity, 0) AS current_stock,
        COALESCE(rms.average_rate, 0) AS average_rate,
        COALESCE(rms.stock_value, 0) AS stock_value,
        CASE
          WHEN COALESCE(rms.quantity, 0) <= rm.minimum_stock THEN 1
          ELSE 0
        END AS is_low_stock,
        rms.updated_at
      FROM raw_materials rm
      LEFT JOIN raw_material_stock rms
        ON rm.id = rms.raw_material_id AND rm.company_id = rms.company_id
      WHERE rm.company_id = ?
    `;
    const params = [companyId];

    if (plastic_type) {
      sql += ` AND rm.plastic_type = ?`;
      params.push(plastic_type.toUpperCase());
    }

    if (low_stock_only === "true" || low_stock_only === "1") {
      sql += ` AND COALESCE(rms.quantity, 0) <= rm.minimum_stock`;
    }

    sql += ` ORDER BY is_low_stock DESC, rm.material_name ASC`;

    const [stock] = await db.promise().query(sql, params);

    // Compute aggregate stock value and total volume
    let totalStockVolumeKg = 0;
    let totalStockValue = 0;

    for (const item of stock) {
      totalStockVolumeKg += Number(item.current_stock) || 0;
      totalStockValue += Number(item.stock_value) || 0;
    }

    res.status(200).json({
      success: true,
      stock,
      summary: {
        totalMaterials: stock.length,
        totalStockVolumeKg,
        totalStockValue,
      },
    });
  } catch (error) {
    console.error("Get Stock Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch raw material stock summary",
    });
  }
};

exports.getStockMovements = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { material_id } = req.params;
    const { movement_type, limit = 50 } = req.query;

    let sql = `
      SELECT
        sm.id,
        sm.company_id,
        sm.raw_material_id,
        rm.material_name,
        rm.material_code,
        rm.unit,
        sm.movement_type,
        sm.reference_type,
        sm.reference_id,
        sm.quantity,
        sm.rate,
        sm.total_value,
        sm.balance_quantity,
        sm.movement_date,
        sm.remarks,
        sm.created_at
      FROM raw_material_stock_movements sm
      JOIN raw_materials rm ON sm.raw_material_id = rm.id AND sm.company_id = rm.company_id
      WHERE sm.company_id = ?
    `;
    const params = [companyId];

    if (material_id) {
      sql += ` AND sm.raw_material_id = ?`;
      params.push(material_id);
    }

    if (movement_type) {
      sql += ` AND sm.movement_type = ?`;
      params.push(movement_type.toUpperCase());
    }

    sql += ` ORDER BY sm.id DESC LIMIT ?`;
    params.push(Number(limit) || 50);

    const [movements] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      movements,
    });
  } catch (error) {
    console.error("Get Stock Movements Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stock movements",
    });
  }
};

exports.recordStockAdjustment = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;

    const {
      raw_material_id,
      quantity_change,
      rate,
      remarks,
    } = req.body;

    if (!raw_material_id) {
      return res.status(400).json({
        success: false,
        message: "Raw material ID is required",
      });
    }

    const change = Number(quantity_change);
    if (isNaN(change) || change === 0) {
      return res.status(400).json({
        success: false,
        message: "Quantity change must be a non-zero number (positive for increase, negative for decrease)",
      });
    }

    // Verify material ownership
    const [materials] = await db.promise().query(
      `SELECT id, material_name, default_purchase_rate FROM raw_materials WHERE id = ? AND company_id = ?`,
      [raw_material_id, companyId]
    );
    if (materials.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found or belongs to another company",
      });
    }

    const material = materials[0];
    const adjustmentRate = rate !== undefined ? Number(rate) : Number(material.default_purchase_rate) || 0;

    const conn = db.promise();
    await conn.beginTransaction();

    try {
      const [stockRows] = await conn.query(
        `SELECT id, quantity, average_rate, stock_value
         FROM raw_material_stock
         WHERE company_id = ? AND raw_material_id = ?
         FOR UPDATE`,
        [companyId, raw_material_id]
      );

      let currentQty = 0;
      let currentStockValue = 0;

      if (stockRows.length > 0) {
        currentQty = Number(stockRows[0].quantity) || 0;
        currentStockValue = Number(stockRows[0].stock_value) || 0;
      }

      const newQty = currentQty + change;
      if (newQty < 0) {
        await conn.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot reduce stock below 0. Current stock is ${currentQty}, attempted reduction is ${Math.abs(change)}.`,
        });
      }

      let newStockValue = currentStockValue + (change * adjustmentRate);
      if (newStockValue < 0) newStockValue = 0;
      const newAvgRate = newQty > 0 ? newStockValue / newQty : 0;

      await conn.query(
        `INSERT INTO raw_material_stock
          (company_id, raw_material_id, quantity, average_rate, stock_value)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           quantity = VALUES(quantity),
           average_rate = VALUES(average_rate),
           stock_value = VALUES(stock_value),
           updated_at = CURRENT_TIMESTAMP`,
        [companyId, raw_material_id, newQty, newAvgRate, newStockValue]
      );

      await conn.query(
        `INSERT INTO raw_material_stock_movements
          (
            company_id,
            raw_material_id,
            movement_type,
            reference_type,
            reference_id,
            quantity,
            rate,
            total_value,
            balance_quantity,
            remarks,
            created_by
          )
          VALUES (?, ?, 'ADJUSTMENT', 'MANUAL_ADJUSTMENT', NULL, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          raw_material_id,
          change,
          adjustmentRate,
          change * adjustmentRate,
          newQty,
          remarks ? remarks.trim() : "Manual stock adjustment",
          adminId,
        ]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Stock adjustment recorded successfully",
        current_stock: newQty,
        stock_value: newStockValue,
      });
    } catch (txnError) {
      await conn.rollback();
      throw txnError;
    }
  } catch (error) {
    console.error("Stock Adjustment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record stock adjustment",
    });
  }
};
