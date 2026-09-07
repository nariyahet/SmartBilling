const db = require("../config/db");

const generateNextInwardNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT inward_no FROM truck_inwards WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    const match = String(row.inward_no || "").trim().match(/^TI-(\d+)$/i);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `TI-${maxNum + 1}`;
};

const ALLOWED_QUALITY_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "PARTIAL"];

exports.getTruckInwards = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { quality_status, supplier_id, material_id, search } = req.query;

    let sql = `
      SELECT
        ti.id,
        ti.company_id,
        ti.inward_no,
        ti.supplier_id,
        s.supplier_name,
        s.supplier_code,
        ti.truck_number,
        ti.driver_name,
        ti.driver_mobile,
        ti.material_id,
        rm.material_name,
        rm.material_code,
        rm.plastic_type,
        ti.gross_weight,
        ti.tare_weight,
        ti.net_weight,
        ti.rate_per_unit,
        ti.total_amount,
        ti.inward_date,
        ti.quality_status,
        ti.remarks,
        ti.created_by,
        ti.created_at,
        ti.updated_at
      FROM truck_inwards ti
      JOIN suppliers s ON ti.supplier_id = s.id AND ti.company_id = s.company_id
      JOIN raw_materials rm ON ti.material_id = rm.id AND ti.company_id = rm.company_id
      WHERE ti.company_id = ?
    `;
    const params = [companyId];

    if (quality_status) {
      sql += ` AND ti.quality_status = ?`;
      params.push(quality_status.toUpperCase());
    }

    if (supplier_id) {
      sql += ` AND ti.supplier_id = ?`;
      params.push(supplier_id);
    }

    if (material_id) {
      sql += ` AND ti.material_id = ?`;
      params.push(material_id);
    }

    if (search && search.trim()) {
      sql += ` AND (ti.inward_no LIKE ? OR ti.truck_number LIKE ? OR s.supplier_name LIKE ? OR rm.material_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY ti.id DESC`;

    const [inwards] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      truck_inwards: inwards,
    });
  } catch (error) {
    console.error("Get Truck Inwards Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch truck inwards",
    });
  }
};

exports.getTruckInwardById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [rows] = await db.promise().query(
      `SELECT
        ti.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        rm.material_name,
        rm.material_code,
        rm.plastic_type,
        rm.unit
       FROM truck_inwards ti
       JOIN suppliers s ON ti.supplier_id = s.id AND ti.company_id = s.company_id
       JOIN raw_materials rm ON ti.material_id = rm.id AND ti.company_id = rm.company_id
       WHERE ti.id = ? AND ti.company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Truck inward record not found",
      });
    }

    res.status(200).json({
      success: true,
      truck_inward: rows[0],
    });
  } catch (error) {
    console.error("Get Truck Inward Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch truck inward details",
    });
  }
};

exports.createTruckInward = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;

    const {
      supplier_id,
      truck_number,
      driver_name,
      driver_mobile,
      material_id,
      gross_weight = 0,
      tare_weight = 0,
      rate_per_unit = 0,
      inward_date,
      quality_status = "PENDING",
      remarks,
    } = req.body;

    if (!supplier_id) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    if (!material_id) {
      return res.status(400).json({
        success: false,
        message: "Raw material is required",
      });
    }

    if (!truck_number || !truck_number.trim()) {
      return res.status(400).json({
        success: false,
        message: "Truck number is required",
      });
    }

    // Validate supplier ownership
    const [suppliers] = await db.promise().query(
      `SELECT id, supplier_name FROM suppliers WHERE id = ? AND company_id = ?`,
      [supplier_id, companyId]
    );
    if (suppliers.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found or does not belong to this company",
      });
    }

    // Validate raw material ownership
    const [materials] = await db.promise().query(
      `SELECT id, material_name FROM raw_materials WHERE id = ? AND company_id = ?`,
      [material_id, companyId]
    );
    if (materials.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Raw material not found or does not belong to this company",
      });
    }

    const gross = Number(gross_weight) || 0;
    const tare = Number(tare_weight) || 0;
    const rate = Number(rate_per_unit) || 0;

    if (gross < 0 || tare < 0) {
      return res.status(400).json({
        success: false,
        message: "Gross weight and tare weight cannot be negative",
      });
    }

    if (gross < tare) {
      return res.status(400).json({
        success: false,
        message: "Gross weight must be greater than or equal to tare weight",
      });
    }

    if (rate < 0) {
      return res.status(400).json({
        success: false,
        message: "Rate per unit cannot be negative",
      });
    }

    const netWeight = gross - tare;
    const totalAmount = netWeight * rate;

    let inwardNo = req.body.inward_no ? String(req.body.inward_no).trim() : "";
    if (!inwardNo) {
      inwardNo = await generateNextInwardNo(companyId);
    } else {
      const [existing] = await db.promise().query(
        `SELECT id FROM truck_inwards WHERE company_id = ? AND inward_no = ? LIMIT 1`,
        [companyId, inwardNo]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Inward number already exists for this company",
        });
      }
    }

    const validatedQuality = ALLOWED_QUALITY_STATUSES.includes(String(quality_status).toUpperCase())
      ? String(quality_status).toUpperCase()
      : "PENDING";

    const [result] = await db.promise().query(
      `INSERT INTO truck_inwards
        (
          company_id,
          inward_no,
          supplier_id,
          truck_number,
          driver_name,
          driver_mobile,
          material_id,
          gross_weight,
          tare_weight,
          net_weight,
          rate_per_unit,
          total_amount,
          inward_date,
          quality_status,
          remarks,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        inwardNo,
        supplier_id,
        truck_number.trim(),
        driver_name ? driver_name.trim() : null,
        driver_mobile ? driver_mobile.trim() : null,
        material_id,
        gross,
        tare,
        netWeight,
        rate,
        totalAmount,
        inward_date ? new Date(inward_date) : new Date(),
        validatedQuality,
        remarks ? remarks.trim() : null,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Truck inward created successfully",
      truck_inward: {
        id: result.insertId,
        company_id: companyId,
        inward_no: inwardNo,
        truck_number: truck_number.trim(),
        net_weight: netWeight,
        total_amount: totalAmount,
        quality_status: validatedQuality,
      },
    });
  } catch (error) {
    console.error("Create Truck Inward Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create truck inward",
    });
  }
};

exports.updateTruckInward = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [existing] = await db.promise().query(
      `SELECT * FROM truck_inwards WHERE id = ? AND company_id = ?`,
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Truck inward not found",
      });
    }

    const current = existing[0];
    const {
      supplier_id = current.supplier_id,
      truck_number = current.truck_number,
      driver_name = current.driver_name,
      driver_mobile = current.driver_mobile,
      material_id = current.material_id,
      gross_weight = current.gross_weight,
      tare_weight = current.tare_weight,
      rate_per_unit = current.rate_per_unit,
      quality_status = current.quality_status,
      remarks = current.remarks,
    } = req.body;

    const gross = Number(gross_weight) || 0;
    const tare = Number(tare_weight) || 0;
    const rate = Number(rate_per_unit) || 0;

    if (gross < 0 || tare < 0) {
      return res.status(400).json({
        success: false,
        message: "Gross weight and tare weight cannot be negative",
      });
    }

    if (gross < tare) {
      return res.status(400).json({
        success: false,
        message: "Gross weight must be greater than or equal to tare weight",
      });
    }

    if (rate < 0) {
      return res.status(400).json({
        success: false,
        message: "Rate per unit cannot be negative",
      });
    }

    const netWeight = gross - tare;
    const totalAmount = netWeight * rate;

    const validatedQuality = ALLOWED_QUALITY_STATUSES.includes(String(quality_status).toUpperCase())
      ? String(quality_status).toUpperCase()
      : current.quality_status;

    await db.promise().query(
      `UPDATE truck_inwards
       SET
         supplier_id = ?,
         truck_number = ?,
         driver_name = ?,
         driver_mobile = ?,
         material_id = ?,
         gross_weight = ?,
         tare_weight = ?,
         net_weight = ?,
         rate_per_unit = ?,
         total_amount = ?,
         quality_status = ?,
         remarks = ?
       WHERE id = ? AND company_id = ?`,
      [
        supplier_id,
        truck_number.trim(),
        driver_name ? driver_name.trim() : null,
        driver_mobile ? driver_mobile.trim() : null,
        material_id,
        gross,
        tare,
        netWeight,
        rate,
        totalAmount,
        validatedQuality,
        remarks ? remarks.trim() : null,
        id,
        companyId,
      ]
    );

    res.status(200).json({
      success: true,
      message: "Truck inward updated successfully",
    });
  } catch (error) {
    console.error("Update Truck Inward Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update truck inward",
    });
  }
};
