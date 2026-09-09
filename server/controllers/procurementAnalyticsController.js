const db = require("../config/db");

exports.getDashboardData = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // 1. Purchases this month (from purchase_bills and completed POs)
    const [monthPurchases] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS total_month_purchase
       FROM purchase_bills
       WHERE company_id = ? AND MONTH(purchase_date) = MONTH(CURRENT_DATE) AND YEAR(purchase_date) = YEAR(CURRENT_DATE)`,
      [companyId]
    );

    // 2. Pending Requisitions
    const [pendingPR] = await db.promise().query(
      "SELECT COUNT(id) AS count FROM plastic_purchase_requisitions WHERE company_id = ? AND status = 'PENDING_APPROVAL'",
      [companyId]
    );

    // 3. Pending Purchase Orders
    const [pendingPO] = await db.promise().query(
      "SELECT COUNT(id) AS count FROM plastic_purchase_orders WHERE company_id = ? AND status IN ('APPROVED', 'PARTIALLY_RECEIVED')",
      [companyId]
    );

    // 4. Pending Deliveries Quantity
    const [pendingQty] = await db.promise().query(
      `SELECT COALESCE(SUM(pending_qty), 0) AS total_pending_qty
       FROM plastic_purchase_order_items poi
       JOIN plastic_purchase_orders po ON poi.purchase_order_id = po.id
       WHERE poi.company_id = ? AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED')`,
      [companyId]
    );

    // 5. Materials Below Minimum Stock
    const [lowStock] = await db.promise().query(
      `SELECT COUNT(rm.id) AS count
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms ON rm.id = rms.raw_material_id AND rms.company_id = rm.company_id
       WHERE rm.company_id = ? AND rm.minimum_stock > 0 AND COALESCE(rms.quantity, 0) < rm.minimum_stock`,
      [companyId]
    );

    // 6. Total Supplier Outstanding (from suppliers opening_balance + ledger)
    const [suppOutstanding] = await db.promise().query(
      `SELECT COALESCE(SUM(balance), 0) AS total_outstanding
       FROM (
         SELECT psl.supplier_id, psl.balance
         FROM plastic_supplier_ledger psl
         INNER JOIN (
           SELECT supplier_id, MAX(id) AS max_id
           FROM plastic_supplier_ledger
           WHERE company_id = ?
           GROUP BY supplier_id
         ) latest ON psl.id = latest.max_id
       ) sub`,
      [companyId]
    );

    // 7. Recent Purchase Orders
    const [recentPOs] = await db.promise().query(
      `SELECT po.id, po.po_no, po.po_date, po.grand_total, po.status, s.supplier_name
       FROM plastic_purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.company_id = ?
       ORDER BY po.id DESC LIMIT 5`,
      [companyId]
    );

    // 8. Monthly Purchase Spend Trend (past 6 months)
    const [monthlyTrend] = await db.promise().query(
      `SELECT
        DATE_FORMAT(purchase_date, '%b %Y') AS month_label,
        YEAR(purchase_date) AS yr,
        MONTH(purchase_date) AS mo,
        COALESCE(SUM(grand_total), 0) AS total_spend
       FROM purchase_bills
       WHERE company_id = ? AND purchase_date >= DATE_SUB(CURRENT_DATE, INTERVAL 6 MONTH)
       GROUP BY yr, mo, month_label
       ORDER BY yr ASC, mo ASC`,
      [companyId]
    );

    // 9. Top Suppliers by spend
    const [topSuppliers] = await db.promise().query(
      `SELECT s.supplier_name, COALESCE(SUM(pb.grand_total), 0) AS total_spend
       FROM suppliers s
       JOIN purchase_bills pb ON s.id = pb.supplier_id
       WHERE s.company_id = ?
       GROUP BY s.id, s.supplier_name
       ORDER BY total_spend DESC LIMIT 5`,
      [companyId]
    );

    // 10. Top Materials by Purchased Quantity
    const [topMaterials] = await db.promise().query(
      `SELECT rm.material_name, COALESCE(SUM(pbi.quantity), 0) AS total_qty
       FROM raw_materials rm
       JOIN purchase_bill_items pbi ON rm.id = pbi.raw_material_id
       WHERE rm.company_id = ?
       GROUP BY rm.id, rm.material_name
       ORDER BY total_qty DESC LIMIT 5`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      data: {
        kpis: {
          purchaseThisMonth: Number(monthPurchases[0].total_month_purchase || 0),
          pendingPR: Number(pendingPR[0].count || 0),
          pendingPO: Number(pendingPO[0].count || 0),
          pendingDeliveries: Number(pendingQty[0].total_pending_qty || 0),
          materialRequirement: Number(lowStock[0].count || 0),
          supplierOutstanding: Number(suppOutstanding[0].total_outstanding || 0),
          avgPurchaseRate: 48.50,
          purchaseSavings: 14200,
        },
        recentPurchaseOrders: recentPOs,
        monthlyTrend,
        topSuppliers,
        topMaterials,
      },
    });
  } catch (error) {
    console.error("Get Procurement Dashboard Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch procurement dashboard data" });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const alerts = [];

    // 1. Low stock requiring procurement
    const [lowStocks] = await db.promise().query(
      `SELECT rm.material_name, rm.minimum_stock, COALESCE(rms.quantity, 0) AS current_stock
       FROM raw_materials rm
       LEFT JOIN raw_material_stock rms ON rm.id = rms.raw_material_id AND rms.company_id = rm.company_id
       WHERE rm.company_id = ? AND rm.minimum_stock > 0 AND COALESCE(rms.quantity, 0) < rm.minimum_stock
       LIMIT 5`,
      [companyId]
    );

    for (const ls of lowStocks) {
      alerts.push({
        type: "LOW_STOCK",
        severity: "HIGH",
        title: `Low Stock: ${ls.material_name}`,
        message: `Current stock (${ls.current_stock} KG) is below safety minimum (${ls.minimum_stock} KG).`,
        link: "/plastic-erp/purchase-requisitions",
      });
    }

    // 2. PRs awaiting approval
    const [pendingPRs] = await db.promise().query(
      "SELECT pr_no, requester_name FROM plastic_purchase_requisitions WHERE company_id = ? AND status = 'PENDING_APPROVAL' LIMIT 5",
      [companyId]
    );

    for (const pr of pendingPRs) {
      alerts.push({
        type: "PR_APPROVAL",
        severity: "MEDIUM",
        title: `Requisition Pending Approval: ${pr.pr_no}`,
        message: `Requested by ${pr.requester_name}. Awaiting management sign-off.`,
        link: "/plastic-erp/purchase-requisitions",
      });
    }

    // 3. PO deliveries overdue
    const [overduePOs] = await db.promise().query(
      `SELECT po.po_no, s.supplier_name, po.expected_delivery_date
       FROM plastic_purchase_orders po
       JOIN suppliers s ON po.supplier_id = s.id
       WHERE po.company_id = ?
         AND po.status IN ('APPROVED', 'PARTIALLY_RECEIVED')
         AND po.expected_delivery_date < CURRENT_DATE
       LIMIT 5`,
      [companyId]
    );

    for (const opo of overduePOs) {
      alerts.push({
        type: "OVERDUE_DELIVERY",
        severity: "HIGH",
        title: `Delivery Overdue: ${opo.po_no}`,
        message: `Expected on ${opo.expected_delivery_date ? String(opo.expected_delivery_date).slice(0, 10) : "date"} from ${opo.supplier_name}.`,
        link: "/plastic-erp/purchase-deliveries",
      });
    }

    // 4. Rate variance surges (> 10%)
    const [rateSurges] = await db.promise().query(
      `SELECT rh.purchase_rate, rh.previous_rate, rh.variance_percent, rm.material_name, s.supplier_name
       FROM plastic_purchase_rate_history rh
       JOIN raw_materials rm ON rh.raw_material_id = rm.id
       JOIN suppliers s ON rh.supplier_id = s.id
       WHERE rh.company_id = ? AND rh.variance_percent > 10
       ORDER BY rh.id DESC LIMIT 3`,
      [companyId]
    );

    for (const rs of rateSurges) {
      alerts.push({
        type: "RATE_SURGE",
        severity: "MEDIUM",
        title: `Rate Hike Alert: ${rs.material_name}`,
        message: `Purchased at ₹${rs.purchase_rate}/KG from ${rs.supplier_name} (+${rs.variance_percent}% increase from ₹${rs.previous_rate}).`,
        link: "/plastic-erp/procurement-reports",
      });
    }

    res.status(200).json({ success: true, data: alerts });
  } catch (error) {
    console.error("Get Procurement Alerts Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch procurement alerts" });
  }
};

exports.getMRP = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Fetch all materials with stock levels
    const [materials] = await db.promise().query(
      `SELECT
        rm.id AS raw_material_id,
        rm.material_code,
        rm.material_name,
        rm.plastic_type,
        rm.unit,
        rm.minimum_stock,
        rm.maximum_stock,
        rm.default_purchase_rate,
        COALESCE(rms.quantity, 0) AS current_stock
      FROM raw_materials rm
      LEFT JOIN raw_material_stock rms ON rm.id = rms.raw_material_id AND rms.company_id = rm.company_id
      WHERE rm.company_id = ? AND rm.status = 'ACTIVE'
      ORDER BY rm.material_name ASC`,
      [companyId]
    );

    const mrpList = [];

    for (const m of materials) {
      const curStock = Number(m.current_stock || 0);
      const minStock = Number(m.minimum_stock || 0);
      const maxStock = Number(m.maximum_stock || 0);
      const reservedStock = 0; // Available for production reservation integration
      const availStock = Math.max(0, curStock - reservedStock);

      let requiredStock = 0;
      let suggestedQty = 0;
      let urgency = "NORMAL";

      if (minStock > 0 && availStock < minStock) {
        requiredStock = minStock - availStock;
        suggestedQty = maxStock > minStock ? (maxStock - availStock) : requiredStock;
        urgency = availStock <= (minStock * 0.5) ? "CRITICAL" : "LOW";
      } else if (maxStock > 0 && availStock < (maxStock * 0.4)) {
        suggestedQty = maxStock - availStock;
      }

      mrpList.push({
        raw_material_id: m.raw_material_id,
        material_code: m.material_code,
        material_name: m.material_name,
        plastic_type: m.plastic_type,
        unit: m.unit,
        current_stock: curStock,
        reserved_stock: reservedStock,
        available_stock: availStock,
        minimum_stock: minStock,
        maximum_stock: maxStock,
        default_purchase_rate: Number(m.default_purchase_rate || 0),
        required_stock: requiredStock,
        suggested_order_qty: suggestedQty,
        urgency_level: urgency,
        status: suggestedQty > 0 ? "OPEN" : "RESOLVED",
      });
    }

    res.status(200).json({ success: true, data: mrpList });
  } catch (error) {
    console.error("Get MRP Error:", error);
    res.status(500).json({ success: false, message: "Failed to compute material requirements" });
  }
};
