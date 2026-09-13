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

    // 5. Top Products by Volume & Revenue
    const [topProducts] = await db.promise().query(
      `SELECT
        ii.product_name AS fg_name,
        'PROD' AS fg_code,
        COALESCE(SUM(ii.quantity), 0) AS total_quantity,
        COALESCE(SUM(ii.total), 0) AS total_revenue
       FROM invoice_items ii
       WHERE ii.company_id = ?
       GROUP BY ii.product_name
       ORDER BY total_revenue DESC
       LIMIT 10`,
      [companyId]
    );

    const formattedCustomers = (byCustomer || []).map((c) => ({
      customer_name: c.customer_name,
      order_count: c.invoice_count,
      total_value: c.total_revenue,
    }));

    const totalOrders = Number(soTotals[0]?.total_orders) || 0;
    const confirmedOrders = Number(soTotals[0]?.pending_orders) || 0;
    const totalSalesValue = Number(soTotals[0]?.total_order_value) || 0;
    const totalDispatchedValue = Number(totals[0]?.total_sales) || 0;

    const summary = {
      totalOrders,
      total_orders: totalOrders,
      confirmedOrders,
      confirmed_orders: confirmedOrders,
      totalSalesValue,
      total_sales_value: totalSalesValue,
      totalDispatchedValue,
      total_dispatched_value: totalDispatchedValue,
      topCustomers: formattedCustomers,
      topProducts: topProducts || [],
      byCustomer,
      byMonth,
    };

    res.status(200).json({
      success: true,
      summary,
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
        COALESCE(d.transporter, 'Own / Direct') AS transporter,
        COUNT(DISTINCT d.id) AS trips_count,
        COALESCE(SUM(di.quantity), 0) AS total_qty
       FROM plastic_dispatches d
       LEFT JOIN plastic_dispatch_items di ON d.id = di.dispatch_id AND d.company_id = di.company_id
       WHERE d.company_id = ? ${dateCond.replace(/dispatch_date/g, "d.dispatch_date")}
       GROUP BY transporter
       ORDER BY total_qty DESC`,
      params
    );

    // 3. Destination breakdown
    const [byDestination] = await db.promise().query(
      `SELECT
        COALESCE(d.destination, 'Factory Pickup') AS destination,
        COUNT(DISTINCT d.id) AS shipments_count,
        COALESCE(SUM(di.quantity), 0) AS total_qty
       FROM plastic_dispatches d
       LEFT JOIN plastic_dispatch_items di ON d.id = di.dispatch_id AND d.company_id = di.company_id
       WHERE d.company_id = ? ${dateCond.replace(/dispatch_date/g, "d.dispatch_date")}
       GROUP BY destination
       ORDER BY total_qty DESC
       LIMIT 10`,
      params
    );

    // 4. Vehicle-wise volume
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

    const totalDispatchedQty = byTransporter.reduce((acc, row) => acc + (Number(row.total_qty) || 0), 0);
    const totalDispatches = counts[0]?.total_dispatches || 0;

    const summary = {
      totalDispatches,
      total_dispatches: totalDispatches,
      totalDispatchedQty,
      total_dispatched_qty: totalDispatchedQty,
      byTransporter,
      byDestination,
      counts: counts[0] || {},
    };

    res.status(200).json({
      success: true,
      summary,
      totalDispatches,
      totalDispatchedQty,
      byTransporter,
      byDestination,
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

    // 3. Top paying customers
    const [byCustomer] = await db.promise().query(
      `SELECT
        c.name AS customer_name,
        COUNT(p.id) AS payment_count,
        COALESCE(SUM(p.amount), 0) AS total_paid
       FROM plastic_payments p
       JOIN customers c ON p.customer_id = c.id AND p.company_id = c.company_id
       WHERE p.company_id = ? AND p.status = 'RECEIVED' ${dateCond.replace(/payment_date/g, "p.payment_date")}
       GROUP BY c.id
       ORDER BY total_paid DESC
       LIMIT 10`,
      params
    );

    const totalCollected = byMethod.reduce((acc, row) => acc + (Number(row.total_collected) || 0), 0);
    const totalPayments = byMethod.reduce((acc, row) => acc + (Number(row.transaction_count) || 0), 0);

    const formattedModes = byMethod.map((m) => ({
      payment_mode: m.payment_method,
      receipt_count: m.transaction_count,
      total_amount: m.total_collected,
    }));

    const summary = {
      totalCollected,
      totalPayments,
      byMode: formattedModes,
      byCustomer: byCustomer || [],
      byMethod,
      byDate,
    };

    res.status(200).json({
      success: true,
      summary,
      totalCollected,
      totalPayments,
      byMode: formattedModes,
      byCustomer: byCustomer || [],
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
        margin_pct: marginPercent !== null ? Number(marginPercent) : null,
        margin_percent: marginPercent !== null ? Number(marginPercent) : null,
        actual_cost: costValue,
        cost_data_available: unitCost !== null,
      };
    });

    const totalGrossProfit = itemsWithCost > 0 ? totalRevenue - totalCost : 0;
    const overallMarginPercent = totalRevenue > 0 && itemsWithCost > 0
      ? ((totalGrossProfit / totalRevenue) * 100).toFixed(2)
      : "0.00";

    const summary = {
      totalRevenue,
      totalSalesRevenue: totalRevenue,
      totalCost: itemsWithCost > 0 ? totalCost : 0,
      totalCostOfGoodsSold: itemsWithCost > 0 ? totalCost : 0,
      totalGrossProfit,
      overallMarginPercent: Number(overallMarginPercent),
      grossMarginPercentage: Number(overallMarginPercent),
      totalItemsSold: items.length,
      itemsWithCostData: itemsWithCost,
      items: detailedRows,
    };

    res.status(200).json({
      success: true,
      summary,
      totalSalesRevenue: totalRevenue,
      totalCostOfGoodsSold: itemsWithCost > 0 ? totalCost : 0,
      totalGrossProfit,
      grossMarginPercentage: Number(overallMarginPercent),
      items: detailedRows,
    });
  } catch (error) {
    console.error("Get Profit Margin Report Error:", error);
    res.status(500).json({ success: false, message: "Failed to generate profit margin report" });
  }
};
