const db = require("../config/db");

const generateNextMaterialCode = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT material_code FROM raw_materials WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    const match = String(row.material_code || "").trim().match(/^MAT-(\d+)$/i);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `MAT-${maxNum + 1}`;
};

const ALLOWED_PLASTIC_TYPES = ["PET", "PP", "HDPE", "LDPE", "OTHER"];
const ALLOWED_UNITS = ["KG", "TON"];

exports.getRawMaterials = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { plastic_type, status, search } = req.query;

    let sql = `
      SELECT
        rm.id,
        rm.company_id,
        rm.material_code,
        rm.material_name,
        rm.category,
        rm.plastic_type,
        rm.grade,
        rm.color,
        rm.unit,
        rm.opening_stock,
        rm.opening_stock_rate,
        DATE_FORMAT(rm.opening_stock_date, '%Y-%m-%d') AS opening_stock_date,
        rm.minimum_stock,
        rm.maximum_stock,
        rm.default_purchase_rate,
        rm.default_selling_rate,
        rm.description,
        rm.status,
        rm.created_at,
        rm.updated_at,
        COALESCE(rms.quantity, 0) AS current_stock,
        COALESCE(rms.average_rate, 0) AS average_rate,
        COALESCE(rms.stock_value, 0) AS stock_value
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

    if (status) {
      sql += ` AND rm.status = ?`;
      params.push(status.toUpperCase());
    }

    if (search && search.trim()) {
      sql += ` AND (
        rm.material_name LIKE ? OR
        rm.material_code LIKE ? OR
        rm.category LIKE ? OR
        rm.grade LIKE ? OR
        rm.color LIKE ? OR
        rm.plastic_type LIKE ?
      )`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term, term, term);
    }

    sql += ` ORDER BY rm.id DESC`;

    const [materials] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      raw_materials: materials,
    });
  } catch (error) {
    console.error("Get Raw Materials Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch raw materials",
    });
  }
};

exports.getRawMaterialById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [rows] = await db.promise().query(
      `SELECT
        rm.*,
        DATE_FORMAT(rm.opening_stock_date, '%Y-%m-%d') AS opening_stock_date,
        COALESCE(rms.quantity, 0) AS current_stock,
        COALESCE(rms.average_rate, 0) AS average_rate,
        COALESCE(rms.stock_value, 0) AS stock_value
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms
         ON rm.id = rms.raw_material_id AND rm.company_id = rms.company_id
       WHERE rm.id = ? AND rm.company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found",
      });
    }

    res.status(200).json({
      success: true,
      raw_material: rows[0],
    });
  } catch (error) {
    console.error("Get Raw Material Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch raw material",
    });
  }
};

exports.createRawMaterial = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;
    const {
      material_name,
      category,
      plastic_type,
      grade,
      color,
      unit = "KG",
      opening_stock = 0,
      opening_stock_rate = 0,
      opening_stock_date,
      minimum_stock = 0,
      maximum_stock = 0,
      default_purchase_rate = 0,
      default_selling_rate = 0,
      description,
      status = "ACTIVE",
    } = req.body;

    if (!material_name || !material_name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Material name is required",
      });
    }

    if (!plastic_type || !plastic_type.trim()) {
      return res.status(400).json({
        success: false,
        message: "Plastic type is required (e.g. PET, PP, HDPE, LDPE, OTHER)",
      });
    }

    const openingStockQty = Number(opening_stock) || 0;
    if (openingStockQty < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening stock quantity cannot be negative",
      });
    }

    const openingStockRate = Number(opening_stock_rate) || 0;
    if (openingStockRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening stock rate cannot be negative",
      });
    }

    const openingStockDateVal = opening_stock_date
      ? String(opening_stock_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const normalizedType = plastic_type.trim().toUpperCase();
    const normalizedUnit = unit ? unit.trim().toUpperCase() : "KG";

    let materialCode = req.body.material_code ? String(req.body.material_code).trim() : "";
    if (!materialCode) {
      materialCode = await generateNextMaterialCode(companyId);
    } else {
      const [existing] = await conn.query(
        `SELECT id FROM raw_materials WHERE company_id = ? AND material_code = ? LIMIT 1`,
        [companyId, materialCode]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Material code already exists for this company",
        });
      }
    }

    const validatedStatus = status && status.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

    await conn.beginTransaction();

    try {
      const [result] = await conn.query(
        `INSERT INTO raw_materials
          (
            company_id,
            material_code,
            material_name,
            category,
            plastic_type,
            grade,
            color,
            unit,
            opening_stock,
            opening_stock_rate,
            opening_stock_date,
            minimum_stock,
            maximum_stock,
            default_purchase_rate,
            default_selling_rate,
            description,
            status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          materialCode,
          material_name.trim(),
          category ? category.trim() : null,
          normalizedType,
          grade ? grade.trim() : null,
          color ? color.trim() : null,
          normalizedUnit,
          openingStockQty,
          openingStockRate,
          openingStockQty > 0 || opening_stock_date ? openingStockDateVal : null,
          Number(minimum_stock) || 0,
          Number(maximum_stock) || 0,
          Number(default_purchase_rate) || 0,
          Number(default_selling_rate) || 0,
          description ? description.trim() : null,
          validatedStatus,
        ]
      );

      const materialId = result.insertId;
      const initialStockValue = openingStockQty * openingStockRate;

      // Initialize raw_material_stock record
      await conn.query(
        `INSERT INTO raw_material_stock (company_id, raw_material_id, quantity, average_rate, stock_value)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           quantity = VALUES(quantity),
           average_rate = VALUES(average_rate),
           stock_value = VALUES(stock_value),
           updated_at = CURRENT_TIMESTAMP`,
        [companyId, materialId, openingStockQty, openingStockRate, initialStockValue]
      );

      // If opening stock > 0, post opening movement record
      if (openingStockQty > 0) {
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
              movement_date,
              remarks,
              created_by
            )
            VALUES (?, ?, 'OPENING_STOCK', 'OPENING_STOCK', ?, ?, ?, ?, ?, ?, 'Initial opening stock balance', ?)`,
          [
            companyId,
            materialId,
            materialId,
            openingStockQty,
            openingStockRate,
            initialStockValue,
            openingStockQty,
            openingStockDateVal,
            adminId,
          ]
        );
      }

      await conn.commit();

      res.status(201).json({
        success: true,
        message: "Raw material created successfully",
        raw_material: {
          id: materialId,
          company_id: companyId,
          material_code: materialCode,
          material_name: material_name.trim(),
          plastic_type: normalizedType,
          unit: normalizedUnit,
          opening_stock: openingStockQty,
          opening_stock_rate: openingStockRate,
          opening_stock_date: openingStockDateVal,
          current_stock: openingStockQty,
          stock_value: initialStockValue,
          status: validatedStatus,
        },
      });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error("Create Raw Material Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create raw material",
    });
  }
};

exports.updateRawMaterial = async (req, res) => {
  const conn = db.promise();
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;

    const [existing] = await conn.query(
      `SELECT * FROM raw_materials WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found",
      });
    }

    const current = existing[0];
    const {
      material_name,
      category,
      plastic_type,
      grade,
      color,
      unit,
      opening_stock,
      opening_stock_rate,
      opening_stock_date,
      minimum_stock,
      maximum_stock,
      default_purchase_rate,
      default_selling_rate,
      description,
      status,
    } = req.body;

    const updatedType = plastic_type ? plastic_type.trim().toUpperCase() : current.plastic_type;
    const updatedUnit = unit ? unit.trim().toUpperCase() : current.unit;
    const updatedStatus = status ? status.toUpperCase() : current.status;

    const oldOpening = Number(current.opening_stock) || 0;
    const newOpening = opening_stock !== undefined ? Number(opening_stock) : oldOpening;
    if (isNaN(newOpening) || newOpening < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening stock quantity cannot be negative",
      });
    }

    const oldOpeningRate = Number(current.opening_stock_rate) || 0;
    const newOpeningRate = opening_stock_rate !== undefined ? Number(opening_stock_rate) : oldOpeningRate;
    if (isNaN(newOpeningRate) || newOpeningRate < 0) {
      return res.status(400).json({
        success: false,
        message: "Opening stock rate cannot be negative",
      });
    }

    const newOpeningDate = opening_stock_date !== undefined
      ? (opening_stock_date ? String(opening_stock_date).slice(0, 10) : null)
      : (current.opening_stock_date ? new Date(current.opening_stock_date).toISOString().slice(0, 10) : null);

    await conn.beginTransaction();

    try {
      // Check if opening stock quantity actually changed
      const openingStockChanged = Math.abs(newOpening - oldOpening) > 0.0001;

      if (openingStockChanged) {
        const delta = newOpening - oldOpening;

        // Fetch current stock row FOR UPDATE to lock
        const [stockRows] = await conn.query(
          `SELECT id, quantity, average_rate, stock_value 
           FROM raw_material_stock 
           WHERE company_id = ? AND raw_material_id = ? 
           FOR UPDATE`,
          [companyId, id]
        );

        let currentStockQty = 0;
        let currentStockVal = 0;
        if (stockRows.length > 0) {
          currentStockQty = Number(stockRows[0].quantity) || 0;
          currentStockVal = Number(stockRows[0].stock_value) || 0;
        }

        const newStockQty = currentStockQty + delta;
        if (newStockQty < 0) {
          await conn.rollback();
          return res.status(400).json({
            success: false,
            message: `Adjusting opening stock by ${delta > 0 ? "+" : ""}${delta} would cause current stock to drop below zero (Current: ${currentStockQty}).`,
          });
        }

        let newStockVal = currentStockVal + (delta * newOpeningRate);
        if (newStockVal < 0) newStockVal = 0;
        const newAvgRate = newStockQty > 0 ? newStockVal / newStockQty : (newOpeningRate || 0);

        // Update raw_material_stock
        await conn.query(
          `INSERT INTO raw_material_stock
            (company_id, raw_material_id, quantity, average_rate, stock_value)
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             quantity = VALUES(quantity),
             average_rate = VALUES(average_rate),
             stock_value = VALUES(stock_value),
             updated_at = CURRENT_TIMESTAMP`,
          [companyId, id, newStockQty, newAvgRate, newStockVal]
        );

        // Check if there was any prior opening stock movement
        const [priorMovements] = await conn.query(
          `SELECT id FROM raw_material_stock_movements 
           WHERE company_id = ? AND raw_material_id = ? AND movement_type = 'OPENING_STOCK' LIMIT 1`,
          [companyId, id]
        );

        const movementType = (priorMovements.length === 0 && oldOpening === 0) ? "OPENING_STOCK" : "ADJUSTMENT";
        const referenceType = (priorMovements.length === 0 && oldOpening === 0) ? "OPENING_STOCK" : "OPENING_STOCK_ADJUSTMENT";
        const movementRemarks = (priorMovements.length === 0 && oldOpening === 0)
          ? "Initial opening stock balance"
          : `Opening stock adjusted from ${oldOpening} to ${newOpening}`;

        // Record stock movement (audit trail)
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
              movement_date,
              remarks,
              created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            id,
            movementType,
            referenceType,
            id,
            delta,
            newOpeningRate,
            delta * newOpeningRate,
            newStockQty,
            newOpeningDate || new Date().toISOString().slice(0, 10),
            movementRemarks,
            adminId,
          ]
        );
      }

      // Update raw_materials master fields
      await conn.query(
        `UPDATE raw_materials
         SET
           material_name = ?,
           category = ?,
           plastic_type = ?,
           grade = ?,
           color = ?,
           unit = ?,
           opening_stock = ?,
           opening_stock_rate = ?,
           opening_stock_date = ?,
           minimum_stock = ?,
           maximum_stock = ?,
           default_purchase_rate = ?,
           default_selling_rate = ?,
           description = ?,
           status = ?
         WHERE id = ? AND company_id = ?`,
        [
          material_name !== undefined ? material_name.trim() : current.material_name,
          category !== undefined ? (category ? category.trim() : null) : current.category,
          updatedType,
          grade !== undefined ? (grade ? grade.trim() : null) : current.grade,
          color !== undefined ? (color ? color.trim() : null) : current.color,
          updatedUnit,
          newOpening,
          newOpeningRate,
          newOpeningDate,
          minimum_stock !== undefined ? Number(minimum_stock) || 0 : current.minimum_stock,
          maximum_stock !== undefined ? Number(maximum_stock) || 0 : current.maximum_stock,
          default_purchase_rate !== undefined ? Number(default_purchase_rate) || 0 : current.default_purchase_rate,
          default_selling_rate !== undefined ? Number(default_selling_rate) || 0 : current.default_selling_rate,
          description !== undefined ? (description ? description.trim() : null) : current.description,
          updatedStatus,
          id,
          companyId,
        ]
      );

      await conn.commit();

      res.status(200).json({
        success: true,
        message: "Raw material updated successfully",
      });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    }
  } catch (error) {
    console.error("Update Raw Material Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update raw material",
    });
  }
};

exports.deleteRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    // Check if material is referenced in truck inwards or purchase bills
    const [inwards] = await db.promise().query(
      `SELECT id FROM truck_inwards WHERE material_id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );
    if (inwards.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete raw material: linked to existing truck inwards.",
      });
    }

    const [bills] = await db.promise().query(
      `SELECT id FROM purchase_bill_items WHERE raw_material_id = ? AND company_id = ? LIMIT 1`,
      [id, companyId]
    );
    if (bills.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete raw material: linked to existing purchase bills.",
      });
    }

    const [stock] = await db.promise().query(
      `SELECT quantity FROM raw_material_stock WHERE raw_material_id = ? AND company_id = ?`,
      [id, companyId]
    );
    if (stock.length > 0 && Number(stock[0].quantity) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete raw material: current inventory quantity is greater than zero.",
      });
    }

    const [result] = await db.promise().query(
      `DELETE FROM raw_materials WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Raw material deleted successfully",
    });
  } catch (error) {
    console.error("Delete Raw Material Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete raw material",
    });
  }
};
