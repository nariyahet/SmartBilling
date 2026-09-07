const db = require("../config/db");

exports.getInspections = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { qc_type, overall_status, batch_id, supplier_id } = req.query;

    let sql = `
      SELECT
        qi.*,
        s.supplier_name,
        rm.material_name,
        rm.material_code,
        b.batch_no,
        m.machine_name
      FROM plastic_quality_inspections qi
      LEFT JOIN suppliers s ON qi.supplier_id = s.id AND qi.company_id = s.company_id
      LEFT JOIN raw_materials rm ON qi.raw_material_id = rm.id AND qi.company_id = rm.company_id
      LEFT JOIN plastic_production_batches b ON qi.batch_id = b.id AND qi.company_id = b.company_id
      LEFT JOIN plastic_machines m ON qi.machine_id = m.id AND qi.company_id = m.company_id
      WHERE qi.company_id = ?
    `;
    const params = [companyId];

    if (qc_type) {
      sql += ` AND qi.qc_type = ?`;
      params.push(qc_type);
    }
    if (overall_status) {
      sql += ` AND qi.overall_status = ?`;
      params.push(overall_status);
    }
    if (batch_id) {
      sql += ` AND qi.batch_id = ?`;
      params.push(batch_id);
    }
    if (supplier_id) {
      sql += ` AND qi.supplier_id = ?`;
      params.push(supplier_id);
    }

    sql += ` ORDER BY qi.inspection_date DESC`;

    const [inspections] = await db.promise().query(sql, params);

    res.status(200).json({
      success: true,
      inspections,
    });
  } catch (error) {
    console.error("Get QC Inspections Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch QC inspections",
    });
  }
};

exports.getInspectionById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [inspections] = await db.promise().query(
      `SELECT
        qi.*,
        s.supplier_name,
        rm.material_name,
        b.batch_no
       FROM plastic_quality_inspections qi
       LEFT JOIN suppliers s ON qi.supplier_id = s.id AND qi.company_id = s.company_id
       LEFT JOIN raw_materials rm ON qi.raw_material_id = rm.id AND qi.company_id = rm.company_id
       LEFT JOIN plastic_production_batches b ON qi.batch_id = b.id AND qi.company_id = b.company_id
       WHERE qi.id = ? AND qi.company_id = ?`,
      [id, companyId]
    );

    if (inspections.length === 0) {
      return res.status(404).json({
        success: false,
        message: "QC inspection not found",
      });
    }

    const [results] = await db.promise().query(
      `SELECT * FROM plastic_quality_results WHERE inspection_id = ? AND company_id = ? ORDER BY id ASC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      inspection: {
        ...inspections[0],
        results,
      },
    });
  } catch (error) {
    console.error("Get QC Inspection Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch QC inspection details",
    });
  }
};

exports.createInspection = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      inspection_no,
      qc_type = "INCOMING",
      supplier_id,
      raw_material_id,
      truck_inward_id,
      batch_id,
      product_id,
      machine_id,
      sample_size = 1.00,
      unit = "KG",
      inspector_name,
      overall_status = "PASSED",
      rejection_reason,
      remarks,
      parameters = [],
    } = req.body;

    let inspNo = inspection_no;
    if (!inspNo) {
      const [countRows] = await conn.query(
        `SELECT COUNT(id) AS count FROM plastic_quality_inspections WHERE company_id = ?`,
        [companyId]
      );
      inspNo = `QC-${1000 + (countRows[0]?.count || 0) + 1}`;
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO plastic_quality_inspections
        (company_id, inspection_no, qc_type, supplier_id, raw_material_id, truck_inward_id, batch_id, product_id, machine_id, sample_size, unit, inspector_name, overall_status, rejection_reason, remarks, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        inspNo.trim().toUpperCase(),
        qc_type,
        supplier_id || null,
        raw_material_id || null,
        truck_inward_id || null,
        batch_id || null,
        product_id || null,
        machine_id || null,
        Number(sample_size) || 1.00,
        unit,
        inspector_name || null,
        overall_status,
        rejection_reason || null,
        remarks || null,
        adminId,
      ]
    );

    const inspectionId = result.insertId;

    if (Array.isArray(parameters) && parameters.length > 0) {
      for (const param of parameters) {
        if (!param.parameter_name) continue;
        await conn.query(
          `INSERT INTO plastic_quality_results
            (company_id, inspection_id, parameter_name, expected_value, observed_value, status, remarks)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            inspectionId,
            param.parameter_name.trim(),
            param.expected_value || null,
            param.observed_value || "OK",
            param.status || "PASS",
            param.remarks || null,
          ]
        );
      }
    }

    // Update batch if batch_id provided
    if (batch_id) {
      await conn.query(
        `UPDATE plastic_production_batches SET qc_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
        [overall_status, batch_id, companyId]
      );

      await conn.query(
        `INSERT INTO plastic_batch_traceability
          (company_id, batch_id, event_type, event_description, entity_type, entity_id)
         VALUES (?, ?, 'QC_INSPECTION', ?, 'plastic_quality_inspections', ?)`,
        [
          companyId,
          batch_id,
          `QC inspection ${inspNo} completed: Overall Status = ${overall_status}`,
          inspectionId,
        ]
      );
    }

    // Update truck inward if truck_inward_id provided
    if (truck_inward_id) {
      await conn.query(
        `UPDATE truck_inwards SET quality_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND company_id = ?`,
        [overall_status, truck_inward_id, companyId]
      );
    }

    await conn.commit();

    res.status(201).json({
      success: true,
      message: "QC inspection recorded successfully",
      inspectionId,
      inspectionNo: inspNo,
    });
  } catch (error) {
    await conn.rollback();
    console.error("Create QC Inspection Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to record QC inspection",
    });
  }
};
