const db = require("../config/db");

const generateNextWeighmentNo = async (companyId) => {
  const [rows] = await db.promise().query(
    `SELECT weighment_no FROM weighments WHERE company_id = ? ORDER BY id DESC`,
    [companyId]
  );

  let maxNum = 1000;
  for (const row of rows) {
    const match = String(row.weighment_no || "").trim().match(/^WT-(\d+)$/i);
    if (match) {
      const num = Number(match[1]);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `WT-${maxNum + 1}`;
};

exports.getWeighments = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { truck_inward_id, search } = req.query;

    let sql = `
      SELECT
        w.id,
        w.company_id,
        w.weighment_no,
        w.truck_inward_id,
        ti.inward_no,
        w.truck_number,
        w.first_weight,
        w.second_weight,
        w.net_weight,
        w.weighing_date,
        w.operator_name,
        w.remarks,
        w.created_by,
        w.created_at
      FROM weighments w
      JOIN truck_inwards ti ON w.truck_inward_id = ti.id AND w.company_id = ti.company_id
      WHERE w.company_id = ?
    `;
    const params = [companyId];

    if (truck_inward_id) {
      sql += ` AND w.truck_inward_id = ?`;
      params.push(truck_inward_id);
    }

    if (search && search.trim()) {
      sql += ` AND (w.weighment_no LIKE ? OR w.truck_number LIKE ? OR w.operator_name LIKE ? OR ti.inward_no LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY w.id DESC`;

    const [weighments] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      weighments,
    });
  } catch (error) {
    console.error("Get Weighments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch weighments",
    });
  }
};

exports.getWeighmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user.company_id;

    const [rows] = await db.promise().query(
      `SELECT
        w.*,
        ti.inward_no,
        ti.supplier_id,
        ti.material_id
       FROM weighments w
       JOIN truck_inwards ti ON w.truck_inward_id = ti.id AND w.company_id = ti.company_id
       WHERE w.id = ? AND w.company_id = ?`,
      [id, companyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Weighment not found",
      });
    }

    res.status(200).json({
      success: true,
      weighment: rows[0],
    });
  } catch (error) {
    console.error("Get Weighment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch weighment details",
    });
  }
};

exports.createWeighment = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id || null;

    const {
      truck_inward_id,
      truck_number,
      first_weight = 0,
      second_weight = 0,
      weighing_date,
      operator_name,
      remarks,
    } = req.body;

    if (!truck_inward_id) {
      return res.status(400).json({
        success: false,
        message: "Truck inward ID is required",
      });
    }

    // Verify truck inward belongs to same company
    const [inwards] = await db.promise().query(
      `SELECT id, truck_number FROM truck_inwards WHERE id = ? AND company_id = ?`,
      [truck_inward_id, companyId]
    );
    if (inwards.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Truck inward not found or belongs to another company",
      });
    }

    const assignedTruckNumber = (truck_number && truck_number.trim()) || inwards[0].truck_number;

    const w1 = Number(first_weight) || 0;
    const w2 = Number(second_weight) || 0;

    if (w1 < 0 || w2 < 0) {
      return res.status(400).json({
        success: false,
        message: "Weighment values cannot be negative",
      });
    }

    // Net weight: Gross (w1) - Tare (w2)
    const netWeight = Math.abs(w1 - w2);

    let weighmentNo = req.body.weighment_no ? String(req.body.weighment_no).trim() : "";
    if (!weighmentNo) {
      weighmentNo = await generateNextWeighmentNo(companyId);
    } else {
      const [existing] = await db.promise().query(
        `SELECT id FROM weighments WHERE company_id = ? AND weighment_no = ? LIMIT 1`,
        [companyId, weighmentNo]
      );
      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Weighment number already exists for this company",
        });
      }
    }

    const [result] = await db.promise().query(
      `INSERT INTO weighments
        (
          company_id,
          weighment_no,
          truck_inward_id,
          truck_number,
          first_weight,
          second_weight,
          net_weight,
          weighing_date,
          operator_name,
          remarks,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        weighmentNo,
        truck_inward_id,
        assignedTruckNumber,
        w1,
        w2,
        netWeight,
        weighing_date ? new Date(weighing_date) : new Date(),
        operator_name ? operator_name.trim() : null,
        remarks ? remarks.trim() : null,
        adminId,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Weighment recorded successfully",
      weighment: {
        id: result.insertId,
        company_id: companyId,
        weighment_no: weighmentNo,
        truck_number: assignedTruckNumber,
        net_weight: netWeight,
      },
    });
  } catch (error) {
    console.error("Create Weighment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record weighment",
    });
  }
};
