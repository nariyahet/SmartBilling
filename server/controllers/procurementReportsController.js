const db = require("../config/db");

// 1. Purchase Requisition Report
exports.getPurchaseRequisitionReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, status, priority } = req.query;

    let sql = `
      SELECT
        pr.pr_no,
        pr.request_date,
        pr.requester_name,
        pr.department,
        pr.priority,
        pr.required_date,
        pr.status,
        COUNT(pri.id) AS items_count,
        COALESCE(SUM(pri.requested_qty), 0) AS total_qty,
        COALESCE(SUM(pri.estimated_total), 0) AS total_estimated_value
      FROM plastic_purchase_requisitions pr
      LEFT JOIN plastic_purchase_requisition_items pri ON pr.id = pri.requisition_id AND pr.company_id = pri.company_id
      WHERE pr.company_id = ?
    `;
    const params = [companyId];

    if (from_date) { sql += " AND pr.request_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND pr.request_date <= ?"; params.push(to_date); }
    if (status && status !== "ALL") { sql += " AND pr.status = ?"; params.push(status); }
    if (priority && priority !== "ALL") { sql += " AND pr.priority = ?"; params.push(priority); }

    sql += " GROUP BY pr.id ORDER BY pr.request_date DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("PR Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate PR report" });
  }
};

// 2. Purchase Order Report
exports.getPurchaseOrderReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, supplier_id, status } = req.query;

    let sql = `
      SELECT
        po.po_no,
        po.po_date,
        po.expected_delivery_date,
        po.subtotal,
        po.tax_amount,
        po.freight_amount,
        po.grand_total,
        po.status,
        s.supplier_name,
        s.supplier_code,
        COUNT(poi.id) AS items_count,
        COALESCE(SUM(poi.ordered_qty), 0) AS total_ordered_qty,
        COALESCE(SUM(poi.received_qty), 0) AS total_received_qty,
        COALESCE(SUM(poi.pending_qty), 0) AS total_pending_qty
      FROM plastic_purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id AND po.company_id = s.company_id
      LEFT JOIN plastic_purchase_order_items poi ON po.id = poi.purchase_order_id AND po.company_id = poi.company_id
      WHERE po.company_id = ?
    `;
    const params = [companyId];

    if (from_date) { sql += " AND po.po_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND po.po_date <= ?"; params.push(to_date); }
    if (supplier_id && supplier_id !== "ALL") { sql += " AND po.supplier_id = ?"; params.push(supplier_id); }
    if (status && status !== "ALL") { sql += " AND po.status = ?"; params.push(status); }

    sql += " GROUP BY po.id ORDER BY po.po_date DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("PO Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate PO report" });
  }
};

// 3. Pending PO Report
exports.getPendingPOReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id } = req.query;

    let sql = `
      SELECT
        po.po_no,
        po.po_date,
        po.expected_delivery_date,
        s.supplier_name,
        rm.material_name,
        poi.ordered_qty,
        poi.received_qty,
        poi.pending_qty,
        poi.rate,
        (poi.pending_qty * poi.rate) AS pending_value,
        CASE
          WHEN po.expected_delivery_date < CURRENT_DATE THEN DATEDIFF(CURRENT_DATE, po.expected_delivery_date)
          ELSE 0
        END AS overdue_days
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

    sql += " ORDER BY po.expected_delivery_date ASC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Pending PO Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate Pending PO report" });
  }
};

// 4. Supplier Purchase Report
exports.getSupplierPurchaseReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    let sql = `
      SELECT
        s.supplier_code,
        s.supplier_name,
        s.mobile,
        s.city,
        COUNT(DISTINCT pb.id) AS total_bills,
        COALESCE(SUM(pbi.quantity), 0) AS total_purchased_qty,
        COALESCE(SUM(pb.grand_total), 0) AS total_spend,
        CASE
          WHEN SUM(pbi.quantity) > 0 THEN (SUM(pb.subtotal) / SUM(pbi.quantity))
          ELSE 0
        END AS weighted_avg_rate
      FROM suppliers s
      LEFT JOIN purchase_bills pb ON s.id = pb.supplier_id AND s.company_id = pb.company_id
      LEFT JOIN purchase_bill_items pbi ON pb.id = pbi.purchase_bill_id AND pb.company_id = pbi.company_id
      WHERE s.company_id = ?
    `;
    const params = [companyId];

    if (from_date) { sql += " AND pb.purchase_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND pb.purchase_date <= ?"; params.push(to_date); }

    sql += " GROUP BY s.id ORDER BY total_spend DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Supplier Purchase Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate supplier purchase report" });
  }
};

// 5. Material Purchase Report
exports.getMaterialPurchaseReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, plastic_type } = req.query;

    let sql = `
      SELECT
        rm.material_code,
        rm.material_name,
        rm.plastic_type,
        rm.unit,
        COUNT(DISTINCT pb.id) AS purchase_count,
        COALESCE(SUM(pbi.quantity), 0) AS total_purchased_qty,
        COALESCE(SUM(pbi.total), 0) AS total_spend,
        MIN(pbi.rate) AS lowest_rate,
        MAX(pbi.rate) AS highest_rate,
        CASE
          WHEN SUM(pbi.quantity) > 0 THEN (SUM(pbi.total) / SUM(pbi.quantity))
          ELSE 0
        END AS average_rate
      FROM raw_materials rm
      LEFT JOIN purchase_bill_items pbi ON rm.id = pbi.raw_material_id AND rm.company_id = pbi.company_id
      LEFT JOIN purchase_bills pb ON pbi.purchase_bill_id = pb.id AND pbi.company_id = pb.company_id
      WHERE rm.company_id = ?
    `;
    const params = [companyId];

    if (from_date) { sql += " AND pb.purchase_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND pb.purchase_date <= ?"; params.push(to_date); }
    if (plastic_type && plastic_type !== "ALL") { sql += " AND rm.plastic_type = ?"; params.push(plastic_type); }

    sql += " GROUP BY rm.id ORDER BY total_spend DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Material Purchase Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate material purchase report" });
  }
};

// 6. Purchase Rate History Report
exports.getPurchaseRateHistoryReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { raw_material_id, supplier_id, from_date, to_date } = req.query;

    let sql = `
      SELECT
        rh.*,
        rm.material_name,
        rm.material_code,
        rm.plastic_type,
        s.supplier_name,
        s.supplier_code
      FROM plastic_purchase_rate_history rh
      JOIN raw_materials rm ON rh.raw_material_id = rm.id AND rh.company_id = rm.company_id
      JOIN suppliers s ON rh.supplier_id = s.id AND rh.company_id = s.company_id
      WHERE rh.company_id = ?
    `;
    const params = [companyId];

    if (raw_material_id) { sql += " AND rh.raw_material_id = ?"; params.push(raw_material_id); }
    if (supplier_id && supplier_id !== "ALL") { sql += " AND rh.supplier_id = ?"; params.push(supplier_id); }
    if (from_date) { sql += " AND rh.purchase_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND rh.purchase_date <= ?"; params.push(to_date); }

    sql += " ORDER BY rh.purchase_date DESC, rh.id DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Rate History Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate rate history report" });
  }
};

// 7. Supplier Performance Report
exports.getSupplierPerformanceReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
        sp.*,
        s.supplier_name,
        s.supplier_code,
        s.mobile
      FROM plastic_supplier_performance sp
      JOIN suppliers s ON sp.supplier_id = s.id AND sp.company_id = s.company_id
      WHERE sp.company_id = ?
      ORDER BY sp.overall_score DESC`,
      [companyId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Supplier Performance Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate supplier performance report" });
  }
};

// 8. Delivery Performance Report
exports.getDeliveryPerformanceReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, supplier_id } = req.query;

    let sql = `
      SELECT
        del.delivery_no,
        del.delivery_date,
        del.expected_date,
        del.delivery_delay_days,
        del.challan_no,
        del.truck_number,
        del.delivered_qty,
        del.accepted_qty,
        del.rejected_qty,
        del.status,
        po.po_no,
        s.supplier_name,
        rm.material_name,
        CASE
          WHEN del.delivery_delay_days <= 0 THEN 'ON_TIME'
          ELSE 'DELAYED'
        END AS timeliness_status
      FROM plastic_purchase_deliveries del
      JOIN plastic_purchase_orders po ON del.purchase_order_id = po.id AND del.company_id = po.company_id
      JOIN suppliers s ON del.supplier_id = s.id AND del.company_id = s.company_id
      JOIN raw_materials rm ON del.raw_material_id = rm.id AND del.company_id = rm.company_id
      WHERE del.company_id = ?
    `;
    const params = [companyId];

    if (from_date) { sql += " AND del.delivery_date >= ?"; params.push(from_date); }
    if (to_date) { sql += " AND del.delivery_date <= ?"; params.push(to_date); }
    if (supplier_id && supplier_id !== "ALL") { sql += " AND del.supplier_id = ?"; params.push(supplier_id); }

    sql += " ORDER BY del.delivery_date DESC";
    const [rows] = await db.promise().query(sql, params);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Delivery Performance Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate delivery performance report" });
  }
};

// 9. Purchase Variance Report
exports.getPurchaseVarianceReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
        rm.material_code,
        rm.material_name,
        rm.default_purchase_rate AS standard_rate,
        COALESCE(AVG(pbi.rate), rm.default_purchase_rate) AS actual_avg_rate,
        (COALESCE(AVG(pbi.rate), rm.default_purchase_rate) - rm.default_purchase_rate) AS variance_amount,
        CASE
          WHEN rm.default_purchase_rate > 0 THEN
            ((COALESCE(AVG(pbi.rate), rm.default_purchase_rate) - rm.default_purchase_rate) / rm.default_purchase_rate * 100)
          ELSE 0
        END AS variance_percentage,
        SUM(COALESCE(pbi.quantity, 0)) AS total_qty
      FROM raw_materials rm
      LEFT JOIN purchase_bill_items pbi ON rm.id = pbi.raw_material_id AND rm.company_id = pbi.company_id
      WHERE rm.company_id = ? AND rm.status = 'ACTIVE'
      GROUP BY rm.id
      ORDER BY variance_percentage DESC`,
      [companyId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Purchase Variance Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate purchase variance report" });
  }
};

// 10. Purchase Trend Report
exports.getPurchaseTrendReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
        DATE_FORMAT(purchase_date, '%Y-%m') AS period,
        COUNT(DISTINCT id) AS total_bills,
        COALESCE(SUM(subtotal), 0) AS total_taxable,
        COALESCE(SUM(tax_amount), 0) AS total_tax,
        COALESCE(SUM(grand_total), 0) AS total_spend
      FROM purchase_bills
      WHERE company_id = ?
      GROUP BY period
      ORDER BY period DESC LIMIT 12`,
      [companyId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Purchase Trend Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate purchase trend report" });
  }
};

// 11. Material Requirement Report
exports.getMaterialRequirementReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
        rm.material_code,
        rm.material_name,
        rm.plastic_type,
        rm.unit,
        rm.minimum_stock,
        rm.maximum_stock,
        COALESCE(rms.quantity, 0) AS current_stock,
        GREATEST(0, rm.minimum_stock - COALESCE(rms.quantity, 0)) AS deficit_quantity,
        GREATEST(0, rm.maximum_stock - COALESCE(rms.quantity, 0)) AS suggested_reorder_qty,
        CASE
          WHEN COALESCE(rms.quantity, 0) <= (rm.minimum_stock * 0.5) THEN 'CRITICAL'
          WHEN COALESCE(rms.quantity, 0) < rm.minimum_stock THEN 'LOW'
          ELSE 'NORMAL'
        END AS urgency_level
      FROM raw_materials rm
      LEFT JOIN raw_material_stock rms ON rm.id = rms.raw_material_id AND rm.company_id = rms.company_id
      WHERE rm.company_id = ? AND rm.status = 'ACTIVE'
      ORDER BY deficit_quantity DESC, rm.material_name ASC`,
      [companyId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Material Requirement Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate material requirement report" });
  }
};

// 12. Procurement Savings Report
exports.getProcurementSavingsReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const [rows] = await db.promise().query(
      `SELECT
        po.po_no,
        po.po_date,
        s.supplier_name,
        rm.material_name,
        poi.ordered_qty,
        poi.rate AS agreed_po_rate,
        rm.default_purchase_rate AS standard_baseline_rate,
        (rm.default_purchase_rate - poi.rate) AS unit_savings,
        ((rm.default_purchase_rate - poi.rate) * poi.ordered_qty) AS total_savings
      FROM plastic_purchase_order_items poi
      JOIN plastic_purchase_orders po ON poi.purchase_order_id = po.id AND poi.company_id = po.company_id
      JOIN suppliers s ON po.supplier_id = s.id AND po.company_id = s.company_id
      JOIN raw_materials rm ON poi.raw_material_id = rm.id AND poi.company_id = rm.company_id
      WHERE poi.company_id = ? AND po.status != 'CANCELLED'
      ORDER BY po.po_date DESC`,
      [companyId]
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Procurement Savings Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate procurement savings report" });
  }
};
