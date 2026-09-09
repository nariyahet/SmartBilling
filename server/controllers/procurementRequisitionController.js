const db = require("../config/db");

// Helper: Generate next PR Number PR-YYYYMMDD-XXXX
async function generateNextPRNo(conn, companyId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PR-${dateStr}-`;

  const [rows] = await conn.query(
    "SELECT pr_no FROM plastic_purchase_requisitions WHERE company_id = ? AND pr_no LIKE ? ORDER BY id DESC LIMIT 1",
    [companyId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const lastNo = rows[0].pr_no;
    const parts = lastNo.split("-");
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

exports.getNextPRNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextPRNo(db.promise(), companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next PR No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate PR number" });
  }
};

exports.getRequisitions = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { status, priority, department, from_date, to_date, search } = req.query;

    let sql = `
      SELECT
        pr.*,
        adm_app.name AS approved_by_name,
        adm_cre.name AS created_by_name,
        COUNT(pri.id) AS items_count,
        COALESCE(SUM(pri.requested_qty), 0) AS total_requested_qty,
        COALESCE(SUM(pri.estimated_total), 0) AS total_estimated_value
      FROM plastic_purchase_requisitions pr
      LEFT JOIN plastic_purchase_requisition_items pri ON pr.id = pri.requisition_id AND pri.company_id = pr.company_id
      LEFT JOIN admins adm_app ON pr.approved_by = adm_app.id
      LEFT JOIN admins adm_cre ON pr.created_by = adm_cre.id
      WHERE pr.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "ALL") {
      sql += " AND pr.status = ?";
      params.push(status);
    }
    if (priority && priority !== "ALL") {
      sql += " AND pr.priority = ?";
      params.push(priority);
    }
    if (department && department !== "ALL") {
      sql += " AND pr.department = ?";
      params.push(department);
    }
    if (from_date) {
      sql += " AND pr.request_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND pr.request_date <= ?";
      params.push(to_date);
    }
    if (search) {
      sql += " AND (pr.pr_no LIKE ? OR pr.requester_name LIKE ? OR pr.notes LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " GROUP BY pr.id ORDER BY pr.id DESC";

    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Requisitions Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch purchase requisitions" });
  }
};

exports.getRequisitionById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [prs] = await db.promise().query(
      `SELECT
        pr.*,
        adm_app.name AS approved_by_name,
        adm_cre.name AS created_by_name
      FROM plastic_purchase_requisitions pr
      LEFT JOIN admins adm_app ON pr.approved_by = adm_app.id
      LEFT JOIN admins adm_cre ON pr.created_by = adm_cre.id
      WHERE pr.id = ? AND pr.company_id = ?`,
      [id, companyId]
    );

    if (prs.length === 0) {
      return res.status(404).json({ success: false, message: "Purchase requisition not found" });
    }

    const pr = prs[0];

    const [items] = await db.promise().query(
      `SELECT
        pri.*,
        rm.material_code,
        rm.material_name,
        rm.plastic_type,
        rm.default_purchase_rate
      FROM plastic_purchase_requisition_items pri
      JOIN raw_materials rm ON pri.raw_material_id = rm.id AND pri.company_id = rm.company_id
      WHERE pri.requisition_id = ? AND pri.company_id = ?
      ORDER BY pri.id ASC`,
      [id, companyId]
    );

    res.status(200).json({ success: true, data: { ...pr, items } });
  } catch (error) {
    console.error("Get Requisition Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch requisition details" });
  }
};

exports.createRequisition = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      request_date,
      requester_name,
      department,
      priority,
      required_date,
      notes,
      status,
      items,
    } = req.body;

    if (!requester_name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Requester name and at least one material item are required",
      });
    }

    await conn.query("START TRANSACTION");

    const prNo = await generateNextPRNo(conn, companyId);
    const initialStatus = status === "PENDING_APPROVAL" ? "PENDING_APPROVAL" : "DRAFT";

    const [prResult] = await conn.query(
      `INSERT INTO plastic_purchase_requisitions (
        company_id, pr_no, request_date, requester_name, department,
        priority, required_date, notes, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        prNo,
        request_date || new Date().toISOString().slice(0, 10),
        requester_name,
        department || "Procurement",
        priority || "MEDIUM",
        required_date || null,
        notes || null,
        initialStatus,
        adminId || null,
      ]
    );

    const requisitionId = prResult.insertId;

    for (const itm of items) {
      const qty = Number(itm.requested_qty);
      if (isNaN(qty) || qty <= 0) {
        throw new Error("Invalid requested quantity for item");
      }
      const rate = Number(itm.estimated_rate || 0);
      const estTotal = qty * rate;

      await conn.query(
        `INSERT INTO plastic_purchase_requisition_items (
          company_id, requisition_id, raw_material_id, requested_qty,
          unit, estimated_rate, estimated_total, requirement_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          requisitionId,
          itm.raw_material_id,
          qty,
          itm.unit || "KG",
          rate,
          estTotal,
          itm.requirement_reason || null,
        ]
      );
    }

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Purchase requisition created successfully",
      data: { id: requisitionId, pr_no: prNo, status: initialStatus },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Create Requisition Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create requisition" });
  }
};

exports.updateRequisition = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;
    const {
      request_date,
      requester_name,
      department,
      priority,
      required_date,
      notes,
      status,
      items,
    } = req.body;

    const [existing] = await conn.query(
      "SELECT status FROM plastic_purchase_requisitions WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Purchase requisition not found" });
    }

    if (!["DRAFT", "PENDING_APPROVAL"].includes(existing[0].status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot edit requisition in ${existing[0].status} status`,
      });
    }

    await conn.query("START TRANSACTION");

    await conn.query(
      `UPDATE plastic_purchase_requisitions SET
        request_date = ?,
        requester_name = ?,
        department = ?,
        priority = ?,
        required_date = ?,
        notes = ?,
        status = COALESCE(?, status)
      WHERE id = ? AND company_id = ?`,
      [
        request_date,
        requester_name,
        department,
        priority,
        required_date || null,
        notes || null,
        status || null,
        id,
        companyId,
      ]
    );

    if (items && Array.isArray(items) && items.length > 0) {
      await conn.query(
        "DELETE FROM plastic_purchase_requisition_items WHERE requisition_id = ? AND company_id = ?",
        [id, companyId]
      );

      for (const itm of items) {
        const qty = Number(itm.requested_qty);
        const rate = Number(itm.estimated_rate || 0);
        await conn.query(
          `INSERT INTO plastic_purchase_requisition_items (
            company_id, requisition_id, raw_material_id, requested_qty,
            unit, estimated_rate, estimated_total, requirement_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            id,
            itm.raw_material_id,
            qty,
            itm.unit || "KG",
            rate,
            qty * rate,
            itm.requirement_reason || null,
          ]
        );
      }
    }

    await conn.query("COMMIT");
    res.status(200).json({ success: true, message: "Purchase requisition updated successfully" });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Update Requisition Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to update requisition" });
  }
};

exports.updateRequisitionStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { status, rejection_reason } = req.body;

    const validStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    let approvedBy = null;
    let approvedAt = null;
    if (status === "APPROVED") {
      approvedBy = adminId || null;
      approvedAt = new Date();
    }

    const [result] = await db.promise().query(
      `UPDATE plastic_purchase_requisitions SET
        status = ?,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_at END,
        rejection_reason = CASE WHEN ? = 'REJECTED' THEN ? ELSE rejection_reason END
      WHERE id = ? AND company_id = ?`,
      [
        status,
        status, approvedBy,
        status, approvedAt,
        status, rejection_reason || null,
        id, companyId,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Purchase requisition not found" });
    }

    res.status(200).json({ success: true, message: `Requisition status updated to ${status}` });
  } catch (error) {
    console.error("Update Requisition Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update requisition status" });
  }
};

exports.convertToPO = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { supplier_id, expected_delivery_date, notes } = req.body;

    if (!supplier_id) {
      return res.status(400).json({ success: false, message: "Supplier is required to convert PR to PO" });
    }

    await conn.query("START TRANSACTION");

    const [prs] = await conn.query(
      "SELECT * FROM plastic_purchase_requisitions WHERE id = ? AND company_id = ? FOR UPDATE",
      [id, companyId]
    );

    if (prs.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Purchase requisition not found" });
    }

    const pr = prs[0];
    if (pr.status !== "APPROVED") {
      await conn.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Only APPROVED requisitions can be converted to PO (current: ${pr.status})`,
      });
    }

    const [items] = await conn.query(
      `SELECT pri.*, rm.default_purchase_rate
       FROM plastic_purchase_requisition_items pri
       JOIN raw_materials rm ON pri.raw_material_id = rm.id
       WHERE pri.requisition_id = ? AND pri.company_id = ?`,
      [id, companyId]
    );

    if (items.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Requisition has no items to convert" });
    }

    // Helper: Generate PO-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const poPrefix = `PO-${dateStr}-`;

    const [lastPO] = await conn.query(
      "SELECT po_no FROM plastic_purchase_orders WHERE company_id = ? AND po_no LIKE ? ORDER BY id DESC LIMIT 1",
      [companyId, `${poPrefix}%`]
    );

    let poSeq = 1;
    if (lastPO.length > 0) {
      const parts = lastPO[0].po_no.split("-");
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10);
        if (!isNaN(parsed)) poSeq = parsed + 1;
      }
    }
    const poNo = `${poPrefix}${String(poSeq).padStart(4, "0")}`;

    let subtotal = 0;
    for (const itm of items) {
      const rate = Number(itm.estimated_rate || itm.default_purchase_rate || 0);
      subtotal += Number(itm.requested_qty) * rate;
    }

    const [poResult] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, requisition_id, po_date,
        expected_delivery_date, notes, subtotal, grand_total, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [
        companyId,
        poNo,
        supplier_id,
        id,
        new Date().toISOString().slice(0, 10),
        expected_delivery_date || pr.required_date || null,
        notes || `Created from PR ${pr.pr_no}`,
        subtotal,
        subtotal,
        adminId || null,
      ]
    );

    const poId = poResult.insertId;

    for (const itm of items) {
      const qty = Number(itm.requested_qty);
      const rate = Number(itm.estimated_rate || itm.default_purchase_rate || 0);
      const lineTotal = qty * rate;

      await conn.query(
        `INSERT INTO plastic_purchase_order_items (
          company_id, purchase_order_id, raw_material_id, ordered_qty,
          unit, rate, total_amount, received_qty, pending_qty, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
        [
          companyId,
          poId,
          itm.raw_material_id,
          qty,
          itm.unit || "KG",
          rate,
          lineTotal,
          qty,
        ]
      );
    }

    // Advance PR status to CONVERTED_TO_PO
    await conn.query(
      "UPDATE plastic_purchase_requisitions SET status = 'CONVERTED_TO_PO' WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `Requisition ${pr.pr_no} converted to Purchase Order ${poNo}`,
      data: { purchaseOrderId: poId, po_no: poNo },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Convert PR to PO Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to convert PR to PO" });
  }
};
