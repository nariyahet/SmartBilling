const db = require("../config/db");

exports.getScorecard = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { supplier_id, month, year } = req.query;

    const currentYear = parseInt(year, 10) || new Date().getFullYear();
    const currentMonth = parseInt(month, 10) || (new Date().getMonth() + 1);

    // Fetch all active suppliers for company
    let suppSql = "SELECT id, supplier_code, supplier_name, mobile, email, status FROM suppliers WHERE company_id = ?";
    const suppParams = [companyId];
    if (supplier_id && supplier_id !== "ALL") {
      suppSql += " AND id = ?";
      suppParams.push(supplier_id);
    }
    const [suppliers] = await db.promise().query(suppSql, suppParams);

    const scorecard = [];

    for (const supp of suppliers) {
      // 1. Orders and Purchase Values
      const [orderStats] = await db.promise().query(
        `SELECT
          COUNT(id) AS total_orders,
          COALESCE(SUM(grand_total), 0) AS total_purchase_value
        FROM plastic_purchase_orders
        WHERE supplier_id = ? AND company_id = ? AND status != 'CANCELLED'`,
        [supp.id, companyId]
      );

      // 2. Deliveries Stats
      const [delivStats] = await db.promise().query(
        `SELECT
          COUNT(id) AS total_deliveries,
          SUM(CASE WHEN delivery_delay_days <= 0 THEN 1 ELSE 0 END) AS on_time_deliveries,
          SUM(CASE WHEN delivery_delay_days > 0 THEN 1 ELSE 0 END) AS late_deliveries,
          COALESCE(SUM(delivered_qty), 0) AS total_delivered_qty,
          COALESCE(SUM(accepted_qty), 0) AS total_accepted_qty,
          COALESCE(SUM(rejected_qty), 0) AS total_rejected_qty
        FROM plastic_purchase_deliveries
        WHERE supplier_id = ? AND company_id = ?`,
        [supp.id, companyId]
      );

      const totOrders = Number(orderStats[0].total_orders || 0);
      const totValue = Number(orderStats[0].total_purchase_value || 0);
      const totDeliv = Number(delivStats[0].total_deliveries || 0);
      const onTime = Number(delivStats[0].on_time_deliveries || 0);
      const late = Number(delivStats[0].late_deliveries || 0);
      const deliveredQty = Number(delivStats[0].total_delivered_qty || 0);
      const acceptedQty = Number(delivStats[0].total_accepted_qty || 0);
      const rejectedQty = Number(delivStats[0].total_rejected_qty || 0);

      // 3. Outstanding Balance from Supplier Ledger
      const [ledgerRows] = await db.promise().query(
        "SELECT balance FROM plastic_supplier_ledger WHERE supplier_id = ? AND company_id = ? ORDER BY id DESC LIMIT 1",
        [supp.id, companyId]
      );
      const outstanding = ledgerRows.length > 0 ? Number(ledgerRows[0].balance) : 0;

      // Calculate Scores
      const deliveryScore = totDeliv > 0 ? Math.min(100, Math.round((onTime / totDeliv) * 100)) : 100;
      const qualityScore = deliveredQty > 0 ? Math.min(100, Math.round((acceptedQty / deliveredQty) * 100)) : 100;
      const qualityAcceptance = deliveredQty > 0 ? ((acceptedQty / deliveredQty) * 100).toFixed(1) : 100.0;
      const commercialScore = 95; // Baseline competitive scoring
      const overallScore = Math.round((deliveryScore * 0.35) + (qualityScore * 0.35) + (commercialScore * 0.30));

      // Upsert to plastic_supplier_performance
      await db.promise().query(
        `INSERT INTO plastic_supplier_performance (
          company_id, supplier_id, period_month, period_year, total_orders,
          total_purchase_value, on_time_deliveries, late_deliveries,
          total_ordered_qty, total_received_qty, total_rejected_qty,
          quality_acceptance_percent, delivery_score, quality_score,
          commercial_score, overall_score, outstanding_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_orders = VALUES(total_orders),
          total_purchase_value = VALUES(total_purchase_value),
          on_time_deliveries = VALUES(on_time_deliveries),
          late_deliveries = VALUES(late_deliveries),
          total_ordered_qty = VALUES(total_ordered_qty),
          total_received_qty = VALUES(total_received_qty),
          total_rejected_qty = VALUES(total_rejected_qty),
          quality_acceptance_percent = VALUES(quality_acceptance_percent),
          delivery_score = VALUES(delivery_score),
          quality_score = VALUES(quality_score),
          commercial_score = VALUES(commercial_score),
          overall_score = VALUES(overall_score),
          outstanding_amount = VALUES(outstanding_amount)`,
        [
          companyId,
          supp.id,
          currentMonth,
          currentYear,
          totOrders,
          totValue,
          onTime,
          late,
          deliveredQty,
          acceptedQty,
          rejectedQty,
          qualityAcceptance,
          deliveryScore,
          qualityScore,
          commercialScore,
          overallScore,
          outstanding,
        ]
      );

      scorecard.push({
        supplier_id: supp.id,
        supplier_code: supp.supplier_code,
        supplier_name: supp.supplier_name,
        mobile: supp.mobile,
        total_orders: totOrders,
        total_purchase_value: totValue,
        total_deliveries: totDeliv,
        on_time_deliveries: onTime,
        late_deliveries: late,
        delivered_qty: deliveredQty,
        accepted_qty: acceptedQty,
        rejected_qty: rejectedQty,
        quality_acceptance_percent: qualityAcceptance,
        delivery_score: deliveryScore,
        quality_score: qualityScore,
        commercial_score: commercialScore,
        overall_score: overallScore,
        outstanding_amount: outstanding,
      });
    }

    res.status(200).json({ success: true, data: scorecard });
  } catch (error) {
    console.error("Get Supplier Scorecard Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate supplier scorecard" });
  }
};

exports.getSupplierHistory = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { id } = req.params;

    const [supps] = await db.promise().query(
      "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
      [id, companyId]
    );

    if (supps.length === 0) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    // Deliveries
    const [deliveries] = await db.promise().query(
      `SELECT
        del.*,
        po.po_no,
        rm.material_name
      FROM plastic_purchase_deliveries del
      JOIN plastic_purchase_orders po ON del.purchase_order_id = po.id
      JOIN raw_materials rm ON del.raw_material_id = rm.id
      WHERE del.supplier_id = ? AND del.company_id = ?
      ORDER BY del.delivery_date DESC LIMIT 20`,
      [id, companyId]
    );

    // Rate History
    const [rates] = await db.promise().query(
      `SELECT
        rh.*,
        rm.material_name,
        rm.material_code
      FROM plastic_purchase_rate_history rh
      JOIN raw_materials rm ON rh.raw_material_id = rm.id
      WHERE rh.supplier_id = ? AND rh.company_id = ?
      ORDER BY rh.purchase_date DESC LIMIT 20`,
      [id, companyId]
    );

    // Ledger
    const [ledger] = await db.promise().query(
      "SELECT * FROM plastic_supplier_ledger WHERE supplier_id = ? AND company_id = ? ORDER BY id DESC LIMIT 20",
      [id, companyId]
    );

    res.status(200).json({
      success: true,
      data: {
        supplier: supps[0],
        deliveries,
        rates,
        ledger,
      },
    });
  } catch (error) {
    console.error("Get Supplier History Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch supplier history" });
  }
};
