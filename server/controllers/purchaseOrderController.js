const db = require("../config/db");

// Helper: Generate next PO Number PO-YYYYMMDD-XXXX
async function generateNextPONo(conn, companyId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `PO-${dateStr}-`;

  const [rows] = await conn.query(
    "SELECT po_no FROM plastic_purchase_orders WHERE company_id = ? AND po_no LIKE ? ORDER BY id DESC LIMIT 1",
    [companyId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const parts = rows[0].po_no.split("-");
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

exports.getNextPONo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextPONo(db.promise(), companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next PO No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate PO number" });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, status, from_date, to_date, search } = req.query;

    let sql = `
      SELECT
        po.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile AS supplier_mobile,
        adm_app.name AS approved_by_name,
        COUNT(poi.id) AS items_count,
        COALESCE(SUM(poi.ordered_qty), 0) AS total_ordered_qty,
        COALESCE(SUM(poi.received_qty), 0) AS total_received_qty,
        COALESCE(SUM(poi.pending_qty), 0) AS total_pending_qty
      FROM plastic_purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id AND po.company_id = s.company_id
      LEFT JOIN plastic_purchase_order_items poi ON po.id = poi.purchase_order_id AND poi.company_id = po.company_id
      LEFT JOIN admins adm_app ON po.approved_by = adm_app.id
      WHERE po.company_id = ?
    `;
    const params = [companyId];

    if (supplier_id && supplier_id !== "ALL") {
      sql += " AND po.supplier_id = ?";
      params.push(supplier_id);
    }
    if (status && status !== "ALL") {
      sql += " AND po.status = ?";
      params.push(status);
    }
    if (from_date) {
      sql += " AND po.po_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND po.po_date <= ?";
      params.push(to_date);
    }
    if (search) {
      sql += " AND (po.po_no LIKE ? OR s.supplier_name LIKE ? OR po.notes LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " GROUP BY po.id ORDER BY po.id DESC";

    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Purchase Orders Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch purchase orders" });
  }
};

exports.getPurchaseOrderById = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [pos] = await db.promise().query(
      `SELECT
        po.*,
        s.supplier_name,
        s.supplier_code,
        s.company_name AS supplier_business_name,
        s.mobile AS supplier_mobile,
        s.email AS supplier_email,
        s.gst_number AS supplier_gst,
        s.address AS supplier_address,
        s.city AS supplier_city,
        s.state AS supplier_state,
        adm_app.name AS approved_by_name,
        adm_cre.name AS created_by_name
      FROM plastic_purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id AND po.company_id = s.company_id
      LEFT JOIN admins adm_app ON po.approved_by = adm_app.id
      LEFT JOIN admins adm_cre ON po.created_by = adm_cre.id
      WHERE po.id = ? AND po.company_id = ?`,
      [id, companyId]
    );

    if (pos.length === 0) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    const po = pos[0];

    // Fetch Items
    const [items] = await db.promise().query(
      `SELECT
        poi.*,
        rm.material_code,
        rm.material_name,
        rm.plastic_type
      FROM plastic_purchase_order_items poi
      JOIN raw_materials rm ON poi.raw_material_id = rm.id AND poi.company_id = rm.company_id
      WHERE poi.purchase_order_id = ? AND poi.company_id = ?
      ORDER BY poi.id ASC`,
      [id, companyId]
    );

    // Fetch associated Deliveries
    const [deliveries] = await db.promise().query(
      `SELECT
        del.*,
        rm.material_name
      FROM plastic_purchase_deliveries del
      JOIN raw_materials rm ON del.raw_material_id = rm.id
      WHERE del.purchase_order_id = ? AND del.company_id = ?
      ORDER BY del.delivery_date DESC`,
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      data: {
        ...po,
        items,
        deliveries,
      },
    });
  } catch (error) {
    console.error("Get Purchase Order Details Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch purchase order details" });
  }
};

exports.createPurchaseOrder = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      supplier_id,
      quotation_id,
      requisition_id,
      po_date,
      expected_delivery_date,
      payment_terms,
      delivery_terms,
      shipping_address,
      notes,
      freight_amount,
      items,
    } = req.body;

    if (!supplier_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier and at least one order line item are required",
      });
    }

    await conn.query("START TRANSACTION");

    const poNo = await generateNextPONo(conn, companyId);

    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    const freight = Number(freight_amount || 0);

    const processedItems = [];

    for (const itm of items) {
      const qty = Number(itm.ordered_qty);
      const rate = Number(itm.rate);
      if (isNaN(qty) || qty <= 0 || isNaN(rate) || rate < 0) {
        throw new Error("Invalid ordered quantity or rate in PO items");
      }

      const lineBase = qty * rate;
      const discAmt = Number(itm.discount_amount || 0);
      const taxable = Math.max(0, lineBase - discAmt);
      const taxPct = Number(itm.tax_percent || 0);
      const taxAmt = Number(itm.tax_amount || (taxable * taxPct / 100));
      const lineTotal = taxable + taxAmt;

      subtotal += lineBase;
      totalDiscount += discAmt;
      totalTax += taxAmt;

      processedItems.push({
        raw_material_id: itm.raw_material_id,
        ordered_qty: qty,
        unit: itm.unit || "KG",
        rate,
        discount_amount: discAmt,
        tax_percent: taxPct,
        tax_amount: taxAmt,
        total_amount: lineTotal,
      });
    }

    const grandTotal = (subtotal - totalDiscount) + totalTax + freight;

    const [poResult] = await conn.query(
      `INSERT INTO plastic_purchase_orders (
        company_id, po_no, supplier_id, quotation_id, requisition_id,
        po_date, expected_delivery_date, payment_terms, delivery_terms,
        shipping_address, notes, subtotal, discount_amount, tax_amount,
        freight_amount, grand_total, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [
        companyId,
        poNo,
        supplier_id,
        quotation_id || null,
        requisition_id || null,
        po_date || new Date().toISOString().slice(0, 10),
        expected_delivery_date || null,
        payment_terms || "30 Days Net",
        delivery_terms || "Ex-Plant",
        shipping_address || "Kim Plant, Surat, Gujarat",
        notes || null,
        subtotal,
        totalDiscount,
        totalTax,
        freight,
        grandTotal,
        adminId || null,
      ]
    );

    const poId = poResult.insertId;

    for (const itm of processedItems) {
      await conn.query(
        `INSERT INTO plastic_purchase_order_items (
          company_id, purchase_order_id, raw_material_id, ordered_qty,
          unit, rate, discount_amount, tax_percent, tax_amount, total_amount,
          received_qty, pending_qty, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?, 'PENDING')`,
        [
          companyId,
          poId,
          itm.raw_material_id,
          itm.ordered_qty,
          itm.unit,
          itm.rate,
          itm.discount_amount,
          itm.tax_percent,
          itm.tax_amount,
          itm.total_amount,
          itm.ordered_qty,
        ]
      );
    }

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Purchase order created successfully",
      data: { id: poId, po_no: poNo, grand_total: grandTotal },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Create Purchase Order Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create purchase order" });
  }
};

exports.updatePurchaseOrderStatus = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "CANCELLED", "CLOSED"];
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
      `UPDATE plastic_purchase_orders SET
        status = ?,
        approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_at END
      WHERE id = ? AND company_id = ?`,
      [status, status, approvedBy, status, approvedAt, id, companyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }

    res.status(200).json({ success: true, message: `Purchase order status updated to ${status}` });
  } catch (error) {
    console.error("Update PO Status Error:", error);
    res.status(500).json({ success: false, message: "Failed to update purchase order status" });
  }
};
