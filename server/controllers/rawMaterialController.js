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
      sql += ` AND (rm.material_name LIKE ? OR rm.material_code LIKE ? OR rm.category LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
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
  try {
    const companyId = req.user.company_id;
    const {
      material_name,
      category,
      plastic_type,
      grade,
      color,
      unit = "KG",
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

    const normalizedType = plastic_type.trim().toUpperCase();
    const normalizedUnit = unit ? unit.trim().toUpperCase() : "KG";

    let materialCode = req.body.material_code ? String(req.body.material_code).trim() : "";
    if (!materialCode) {
      materialCode = await generateNextMaterialCode(companyId);
    } else {
      const [existing] = await db.promise().query(
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

    const [result] = await db.promise().query(
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
          minimum_stock,
          maximum_stock,
          default_purchase_rate,
          default_selling_rate,
          description,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        materialCode,
        material_name.trim(),
        category ? category.trim() : null,
        normalizedType,
        grade ? grade.trim() : null,
        color ? color.trim() : null,
        normalizedUnit,
        Number(minimum_stock) || 0,
        Number(maximum_stock) || 0,
        Number(default_purchase_rate) || 0,
        Number(default_selling_rate) || 0,
        description ? description.trim() : null,
        validatedStatus,
      ]
    );

    const materialId = result.insertId;

    // Initialize raw_material_stock record for easy tracking
    await db.promise().query(
      `INSERT INTO raw_material_stock (company_id, raw_material_id, quantity, average_rate, stock_value)
       VALUES (?, ?, 0, 0, 0)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [companyId, materialId]
    );

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
        status: validatedStatus,
      },
    });
  } catch (error) {
    console.error("Create Raw Material Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create raw material",
    });
  }
};

exports.updateRawMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [existing] = await db.promise().query(
      `SELECT * FROM raw_materials WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found",
      });
    }

    const {
      material_name,
      category,
      plastic_type,
      grade,
      color,
      unit,
      minimum_stock,
      maximum_stock,
      default_purchase_rate,
      default_selling_rate,
      description,
      status,
    } = req.body;

    const current = existing[0];
    const updatedType = plastic_type ? plastic_type.trim().toUpperCase() : current.plastic_type;
    const updatedUnit = unit ? unit.trim().toUpperCase() : current.unit;
    const updatedStatus = status ? status.toUpperCase() : current.status;

    await db.promise().query(
      `UPDATE raw_materials
       SET
         material_name = ?,
         category = ?,
         plastic_type = ?,
         grade = ?,
         color = ?,
         unit = ?,
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

    res.status(200).json({
      success: true,
      message: "Raw material updated successfully",
    });
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
