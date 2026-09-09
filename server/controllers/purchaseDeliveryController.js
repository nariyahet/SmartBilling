const db = require("../config/db");

// Helper: Generate next Delivery Number DEL-YYYYMMDD-XXXX
async function generateNextDeliveryNo(conn, companyId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `DEL-${dateStr}-`;

  const [rows] = await conn.query(
    "SELECT delivery_no FROM plastic_purchase_deliveries WHERE company_id = ? AND delivery_no LIKE ? ORDER BY id DESC LIMIT 1",
    [companyId, `${prefix}%`]
  );

  let seq = 1;
  if (rows.length > 0) {
    const parts = rows[0].delivery_no.split("-");
    if (parts.length === 3) {
      const parsed = parseInt(parts[2], 10);
      if (!isNaN(parsed)) seq = parsed + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

exports.getNextDeliveryNo = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const nextNo = await generateNextDeliveryNo(db.promise(), companyId);
    res.status(200).json({ success: true, nextNo });
  } catch (error) {
    console.error("Get Next Delivery No Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate delivery number" });
  }
};

exports.getDeliveries = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { purchase_order_id, supplier_id, from_date, to_date, status, search } = req.query;

    let sql = `
      SELECT
        del.*,
        po.po_no,
        po.expected_delivery_date,
        s.supplier_name,
        s.supplier_code,
        rm.material_name,
        rm.material_code,
        rm.plastic_type,
        ti.inward_no AS truck_inward_no,
        pb.purchase_bill_no
      FROM plastic_purchase_deliveries del
      JOIN plastic_purchase_orders po ON del.purchase_order_id = po.id AND del.company_id = po.company_id
      JOIN suppliers s ON del.supplier_id = s.id AND del.company_id = s.company_id
      JOIN raw_materials rm ON del.raw_material_id = rm.id AND del.company_id = rm.company_id
      LEFT JOIN truck_inwards ti ON del.truck_inward_id = ti.id AND del.company_id = ti.company_id
      LEFT JOIN purchase_bills pb ON del.purchase_bill_id = pb.id AND del.company_id = pb.company_id
      WHERE del.company_id = ?
    `;
    const params = [companyId];

    if (purchase_order_id) {
      sql += " AND del.purchase_order_id = ?";
      params.push(purchase_order_id);
    }
    if (supplier_id && supplier_id !== "ALL") {
      sql += " AND del.supplier_id = ?";
      params.push(supplier_id);
    }
    if (status && status !== "ALL") {
      sql += " AND del.status = ?";
      params.push(status);
    }
    if (from_date) {
      sql += " AND del.delivery_date >= ?";
      params.push(from_date);
    }
    if (to_date) {
      sql += " AND del.delivery_date <= ?";
      params.push(to_date);
    }
    if (search) {
      sql += " AND (del.delivery_no LIKE ? OR po.po_no LIKE ? OR s.supplier_name LIKE ? OR del.truck_number LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += " ORDER BY del.id DESC";

    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Deliveries Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch deliveries" });
  }
};

exports.getPendingItems = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, search } = req.query;

    let sql = `
      SELECT
        poi.*,
        po.po_no,
        po.po_date,
        po.expected_delivery_date,
        po.status AS po_status,
        s.id AS supplier_id,
        s.supplier_name,
        s.supplier_code,
        rm.material_name,
        rm.material_code,
        rm.plastic_type
      FROM plastic_purchase_order_items poi
      JOIN plastic_purchase_orders po ON poi.purchase_order_id = po.id AND poi.company_id = po.company_id
      JOIN suppliers s ON po.supplier_id = s.id AND po.company_id = s.company_id
      JOIN raw_materials rm ON poi.raw_material_id = rm.id AND poi.company_id = rm.company_id
      WHERE poi.company_id = ?
        AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED')
        AND poi.pending_qty > 0
    `;
    const params = [companyId];

    if (supplier_id && supplier_id !== "ALL") {
      sql += " AND s.id = ?";
      params.push(supplier_id);
    }
    if (search) {
      sql += " AND (po.po_no LIKE ? OR s.supplier_name LIKE ? OR rm.material_name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY po.expected_delivery_date ASC, po.id DESC";

    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get Pending Items Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch pending delivery items" });
  }
};

exports.recordDelivery = async (req, res) => {
  const conn = db.promise();
  try {
    const companyId = req.user.company_id;
    const adminId = req.user.id;
    const {
      purchase_order_id,
      purchase_order_item_id,
      delivered_qty,
      accepted_qty,
      rejected_qty,
      delivery_date,
      challan_no,
      truck_number,
      truck_inward_id,
      purchase_bill_id,
      notes,
    } = req.body;

    const delQty = Number(delivered_qty);
    const accQty = Number(accepted_qty);
    const rejQty = Number(rejected_qty || 0);

    if (isNaN(accQty) || accQty <= 0) {
      return res.status(400).json({ success: false, message: "Accepted quantity must be greater than zero" });
    }

    await conn.query("START TRANSACTION");

    // Fetch PO Header
    const [pos] = await conn.query(
      "SELECT * FROM plastic_purchase_orders WHERE id = ? AND company_id = ? FOR UPDATE",
      [purchase_order_id, companyId]
    );

    if (pos.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Purchase order not found" });
    }
    const po = pos[0];

    // Fetch PO Item
    let itemQuery = "SELECT * FROM plastic_purchase_order_items WHERE id = ? AND purchase_order_id = ? AND company_id = ? FOR UPDATE";
    let itemParams = [purchase_order_item_id, purchase_order_id, companyId];

    if (!purchase_order_item_id) {
      itemQuery = "SELECT * FROM plastic_purchase_order_items WHERE purchase_order_id = ? AND company_id = ? AND pending_qty > 0 LIMIT 1 FOR UPDATE";
      itemParams = [purchase_order_id, companyId];
    }

    const [poItems] = await conn.query(itemQuery, itemParams);
    if (poItems.length === 0) {
      await conn.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "No active PO item found for delivery" });
    }

    const poItem = poItems[0];
    const deliveryNo = await generateNextDeliveryNo(conn, companyId);

    // Calculate delay days
    let delayDays = 0;
    const delivDate = new Date(delivery_date || new Date());
    if (po.expected_delivery_date) {
      const expDate = new Date(po.expected_delivery_date);
      const diffTime = delivDate - expDate;
      delayDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // Insert Delivery Record
    const [delResult] = await conn.query(
      `INSERT INTO plastic_purchase_deliveries (
        company_id, delivery_no, purchase_order_id, purchase_order_item_id,
        truck_inward_id, purchase_bill_id, supplier_id, raw_material_id,
        delivery_date, expected_date, challan_no, truck_number,
        delivered_qty, accepted_qty, rejected_qty, delivery_delay_days,
        status, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DELIVERED', ?, ?)`,
      [
        companyId,
        deliveryNo,
        po.id,
        poItem.id,
        truck_inward_id || null,
        purchase_bill_id || null,
        po.supplier_id,
        poItem.raw_material_id,
        delivery_date || new Date().toISOString().slice(0, 10),
        po.expected_delivery_date || null,
        challan_no || null,
        truck_number || null,
        delQty || (accQty + rejQty),
        accQty,
        rejQty,
        delayDays,
        notes || null,
        adminId || null,
      ]
    );

    // Update PO Item quantities
    const newReceivedQty = Number(poItem.received_qty) + accQty;
    const newPendingQty = Math.max(0, Number(poItem.ordered_qty) - newReceivedQty);
    const itemStatus = newPendingQty <= 0 ? "FULFILLED" : "PARTIAL";

    await conn.query(
      "UPDATE plastic_purchase_order_items SET received_qty = ?, pending_qty = ?, status = ? WHERE id = ?",
      [newReceivedQty, newPendingQty, itemStatus, poItem.id]
    );

    // Update PO Header Status
    const [allItems] = await conn.query(
      "SELECT SUM(ordered_qty) AS tot_ord, SUM(received_qty) AS tot_rec, SUM(pending_qty) AS tot_pend FROM plastic_purchase_order_items WHERE purchase_order_id = ?",
      [po.id]
    );

    const totPend = Number(allItems[0].tot_pend || 0);
    const totRec = Number(allItems[0].tot_rec || 0);
    const newPOStatus = totPend <= 0 ? "RECEIVED" : (totRec > 0 ? "PARTIALLY_RECEIVED" : po.status);

    await conn.query(
      "UPDATE plastic_purchase_orders SET status = ? WHERE id = ?",
      [newPOStatus, po.id]
    );

    // Rate Intelligence: Record in Rate History
    const [prevRates] = await conn.query(
      "SELECT purchase_rate FROM plastic_purchase_rate_history WHERE raw_material_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1",
      [poItem.raw_material_id, companyId]
    );

    const currentRate = Number(poItem.rate);
    const previousRate = prevRates.length > 0 ? Number(prevRates[0].purchase_rate) : currentRate;
    const varianceAmt = currentRate - previousRate;
    const variancePct = previousRate > 0 ? ((varianceAmt / previousRate) * 100) : 0;

    await conn.query(
      `INSERT INTO plastic_purchase_rate_history (
        company_id, raw_material_id, supplier_id, purchase_order_id,
        purchase_bill_id, purchase_date, purchase_rate, effective_landed_rate,
        quantity, previous_rate, variance_amount, variance_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        poItem.raw_material_id,
        po.supplier_id,
        po.id,
        purchase_bill_id || null,
        delivery_date || new Date().toISOString().slice(0, 10),
        currentRate,
        currentRate,
        accQty,
        previousRate,
        varianceAmt,
        variancePct,
      ]
    );

    await conn.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `Delivery ${deliveryNo} recorded against PO ${po.po_no}. Accepted: ${accQty} KG, Pending: ${newPendingQty} KG`,
      data: {
        deliveryId: delResult.insertId,
        delivery_no: deliveryNo,
        received_qty: newReceivedQty,
        pending_qty: newPendingQty,
        po_status: newPOStatus,
      },
    });
  } catch (error) {
    await conn.query("ROLLBACK");
    console.error("Record Delivery Error:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to record delivery" });
  }
};
