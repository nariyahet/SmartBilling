const db = require("../config/db");

exports.getSalesSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date, customer_id } = req.query;

    let dateCond = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateCond += " AND DATE(created_at) >= ? AND DATE(created_at) <= ?";
      params.push(from_date, to_date);
    }
    if (customer_id) {
      dateCond += " AND customer_id = ?";
      params.push(customer_id);
    }

    // 1. Total Metrics
    const [totals] = await db.promise().query(
      `SELECT
        COUNT(id) AS total_invoices,
        COALESCE(SUM(subtotal), 0) AS total_subtotal,
        COALESCE(SUM(tax_amount), 0) AS total_tax,
        COALESCE(SUM(discount_amount), 0) AS total_discount,
        COALESCE(SUM(grand_total), 0) AS total_sales,
        COALESCE(SUM(paid_amount), 0) AS total_paid
       FROM invoices
       WHERE company_id = ? ${dateCond}`,
      params
    );

    // 2. Sales by Customer
    const [byCustomer] = await db.promise().query(
      `SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        COUNT(i.id) AS invoice_count,
        COALESCE(SUM(i.grand_total), 0) AS total_revenue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id AND i.company_id = c.company_id
       WHERE i.company_id = ? ${dateCond.replace(/customer_id/g, "i.customer_id")}
       GROUP BY c.id
       ORDER BY total_revenue DESC
       LIMIT 10`,
      params
    );

    // 3. Sales by Month
    const [byMonth] = await db.promise().query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(id) AS invoice_count,
        COALESCE(SUM(grand_total), 0) AS total_sales
       FROM invoices
       WHERE company_id = ? ${dateCond}
       GROUP BY month
       ORDER BY month ASC`,
      params
    );

    // 4. Sales Orders summary
    const [soTotals] = await db.promise().query(
      `SELECT
        COUNT(id) AS total_orders,
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) AS draft_orders,
        COUNT(CASE WHEN status IN ('CONFIRMED', 'RESERVED') THEN 1 END) AS pending_orders,
        COUNT(CASE WHEN status IN ('DISPATCHED', 'COMPLETED') THEN 1 END) AS completed_orders,
        COALESCE(SUM(grand_total), 0) AS total_order_value
       FROM plastic_sales_orders
       WHERE company_id = ?`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      totals: totals[0] || {},
      salesOrders: soTotals[0] || {},
      byCustomer,
      byMonth,
    });
  } catch (error) {
    console.error("Get Sales Summary Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate sales summary report" });
  }
};

exports.getDispatchSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    let dateCond = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateCond += " AND dispatch_date >= ? AND dispatch_date <= ?";
      params.push(from_date, to_date);
    }

    // 1. Overall counts
    const [counts] = await db.promise().query(
      `SELECT
        COUNT(id) AS total_dispatches,
        COUNT(CASE WHEN status = 'READY' THEN 1 END) AS ready_dispatches,
        COUNT(CASE WHEN status = 'DISPATCHED' THEN 1 END) AS in_transit_dispatches,
        COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END) AS delivered_dispatches,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_dispatches
       FROM plastic_dispatches
       WHERE company_id = ? ${dateCond}`,
      params
    );

    // 2. Transporter breakdown
    const [byTransporter] = await db.promise().query(
      `SELECT
        COALESCE(transporter, 'Own / Direct') AS transporter_name,
        COUNT(id) AS dispatch_count
       FROM plastic_dispatches
       WHERE company_id = ? ${dateCond}
       GROUP BY transporter_name
       ORDER BY dispatch_count DESC`,
      params
    );

    // 3. Vehicle-wise volume
    const [byVehicle] = await db.promise().query(
      `SELECT
        COALESCE(vehicle_number, 'Unassigned') AS vehicle_number,
        COUNT(d.id) AS trip_count,
        COALESCE(SUM(di.quantity), 0) AS total_volume_kg
       FROM plastic_dispatches d
       LEFT JOIN plastic_dispatch_items di ON d.id = di.dispatch_id AND d.company_id = di.company_id
       WHERE d.company_id = ? ${dateCond.replace(/dispatch_date/g, "d.dispatch_date")}
       GROUP BY vehicle_number
       ORDER BY total_volume_kg DESC`,
      params
    );

    res.status(200).json({
      success: true,
      summary: counts[0] || {},
      byTransporter,
      byVehicle,
    });
  } catch (error) {
    console.error("Get Dispatch Summary Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate dispatch report" });
  }
};

exports.getPaymentSummary = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    let dateCond = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateCond += " AND payment_date >= ? AND payment_date <= ?";
      params.push(from_date, to_date);
    }

    // 1. Method breakdown
    const [byMethod] = await db.promise().query(
      `SELECT
        payment_method,
        COUNT(id) AS transaction_count,
        COALESCE(SUM(amount), 0) AS total_collected
       FROM plastic_payments
       WHERE company_id = ? AND status = 'RECEIVED' ${dateCond}
       GROUP BY payment_method
       ORDER BY total_collected DESC`,
      params
    );

    // 2. Daily collection trend
    const [byDate] = await db.promise().query(
      `SELECT
        payment_date,
        COUNT(id) AS transaction_count,
        COALESCE(SUM(amount), 0) AS total_collected
       FROM plastic_payments
       WHERE company_id = ? AND status = 'RECEIVED' ${dateCond}
       GROUP BY payment_date
       ORDER BY payment_date DESC
       LIMIT 30`,
      params
    );

    const totalCollected = byMethod.reduce((acc, row) => acc + (Number(row.total_collected) || 0), 0);

    res.status(200).json({
      success: true,
      totalCollected,
      byMethod,
      byDate,
    });
  } catch (error) {
    console.error("Get Payment Summary Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate payment report" });
  }
};

/**
 * Profit & Margin Tracking
 * Revenue - Production Cost = Gross Profit
 * Uses Phase 2 production costs or FG standard costs. Clearly marks when cost data is unavailable.
 */
exports.getProfitMarginReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { from_date, to_date } = req.query;

    let dateCond = "";
    const params = [companyId];

    if (from_date && to_date) {
      dateCond += " AND d.dispatch_date >= ? AND d.dispatch_date <= ?";
      params.push(from_date, to_date);
    }

    // Fetch dispatch items with finished good details, lot details, and production costing
    const [items] = await db.promise().query(
      `SELECT
        di.id AS dispatch_item_id,
        di.quantity,
        di.rate AS selling_rate,
        (di.quantity * di.rate) AS revenue,
        d.dispatch_no,
        d.dispatch_date,
        c.name AS customer_name,
        fg.id AS fg_id,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        fg.standard_cost AS fg_standard_cost,
        fgl.lot_number,
        fgl.batch_id,
        pc.cost_per_kg AS batch_cost_per_kg,
        pc.total_cost AS batch_total_cost
       FROM plastic_dispatch_items di
       JOIN plastic_dispatches d ON di.dispatch_id = d.id AND di.company_id = d.company_id
       JOIN customers c ON d.customer_id = c.id AND d.company_id = c.company_id
       JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON di.lot_id = fgl.id AND di.company_id = fgl.company_id
       LEFT JOIN plastic_production_costs pc ON fgl.batch_id = pc.batch_id AND fgl.company_id = pc.company_id
       WHERE di.company_id = ? AND d.status IN ('DISPATCHED', 'DELIVERED') ${dateCond}
       ORDER BY d.dispatch_date DESC`,
      params
    );

    let totalRevenue = 0;
    let totalCost = 0;
    let itemsWithCost = 0;

    const detailedRows = items.map((itm) => {
      const qty = Number(itm.quantity) || 0;
      const rev = Number(itm.revenue) || 0;
      totalRevenue += rev;

      // Determine unit cost from Phase 2 costing or FG standard cost
      let unitCost = null;
      let costSource = "None";

      if (itm.batch_cost_per_kg && Number(itm.batch_cost_per_kg) > 0) {
        unitCost = Number(itm.batch_cost_per_kg);
        costSource = "Actual Batch Cost";
      } else if (itm.fg_standard_cost && Number(itm.fg_standard_cost) > 0) {
        unitCost = Number(itm.fg_standard_cost);
        costSource = "FG Standard Cost";
      }

      let costValue = null;
      let grossProfit = null;
      let marginPercent = null;

      if (unitCost !== null) {
        costValue = qty * unitCost;
        grossProfit = rev - costValue;
        marginPercent = rev > 0 ? ((grossProfit / rev) * 100).toFixed(2) : "0.00";
        totalCost += costValue;
        itemsWithCost++;
      }

      return {
        ...itm,
        unit_cost: unitCost,
        cost_source: costSource,
        cost_value: costValue,
        gross_profit: grossProfit,
        margin_percent: marginPercent !== null ? Number(marginPercent) : null,
        cost_data_available: unitCost !== null,
      };
    });

    const totalGrossProfit = itemsWithCost > 0 ? totalRevenue - totalCost : 0;
    const overallMarginPercent = totalRevenue > 0 && itemsWithCost > 0
      ? ((totalGrossProfit / totalRevenue) * 100).toFixed(2)
      : "0.00";

    res.status(200).json({
      success: true,
      summary: {
        totalRevenue,
        totalCost: itemsWithCost > 0 ? totalCost : 0,
        totalGrossProfit,
        overallMarginPercent: Number(overallMarginPercent),
        totalItemsSold: items.length,
        itemsWithCostData: itemsWithCost,
      },
      items: detailedRows,
    });
  } catch (error) {
    console.error("Get Profit Margin Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate profit margin report" });
  }
};
