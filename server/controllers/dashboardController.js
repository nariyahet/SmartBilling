const db = require("../config/db");

exports.getDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [customers] = await db
      .promise()
      .query("SELECT COUNT(*) AS totalCustomers FROM customers WHERE company_id = ?", [companyId]);

    const [products] = await db
      .promise()
      .query("SELECT COUNT(*) AS totalProducts FROM products WHERE company_id = ?", [companyId]);

    const [invoices] = await db
      .promise()
      .query("SELECT COUNT(*) AS totalInvoices FROM invoices WHERE company_id = ?", [companyId]);

    const [sales] = await db.promise().query(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS totalSales
      FROM invoices
      WHERE company_id = ?
    `, [companyId]);

    const [todaySales] = await db.promise().query(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS todaySales
      FROM invoices
      WHERE company_id = ? AND DATE(created_at) = CURDATE()
    `, [companyId]);

    res.status(200).json({
      success: true,

      stats: {
        totalCustomers: Number(customers[0]?.totalCustomers) || 0,

        totalProducts: Number(products[0]?.totalProducts) || 0,

        totalInvoices: Number(invoices[0]?.totalInvoices) || 0,

        totalSales: Number(sales[0]?.totalSales) || 0,

        todaySales: Number(todaySales[0]?.todaySales) || 0,
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to load dashboard statistics",

      stats: {
        totalCustomers: 0,
        totalProducts: 0,
        totalInvoices: 0,
        totalSales: 0,
        todaySales: 0,
      },
    });
  }
};

exports.getLowStockProducts = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [products] = await db.promise().query(`
      SELECT
        id,
        name,
        price,
        stock
      FROM products
      WHERE company_id = ? AND stock <= 5
      ORDER BY stock ASC, id DESC
    `, [companyId]);

    res.status(200).json({
      success: true,

      products: Array.isArray(products) ? products : [],
    });
  } catch (error) {
    console.error("Low Stock Error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to load low stock products",

      products: [],
    });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const [dailySales] = await db.promise().query(`
      SELECT
        DATE(created_at) AS date,
        COALESCE(
          SUM(grand_total),
          0
        ) AS total
      FROM invoices
      WHERE company_id = ?
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) DESC
    `, [companyId]);

    const [monthlySales] = await db.promise().query(`
      SELECT
        DATE_FORMAT(
          created_at,
          '%Y-%m'
        ) AS month,

        COALESCE(
          SUM(grand_total),
          0
        ) AS total

      FROM invoices
      WHERE company_id = ?
      GROUP BY
        DATE_FORMAT(
          created_at,
          '%Y-%m'
        )

      ORDER BY month DESC
    `, [companyId]);

    res.status(200).json({
      success: true,

      dailySales: Array.isArray(dailySales)
        ? dailySales.map((item) => ({
            date: item.date,
            total: Number(item.total) || 0,
          }))
        : [],

      monthlySales: Array.isArray(monthlySales)
        ? monthlySales.map((item) => ({
            month: item.month,
            total: Number(item.total) || 0,
          }))
        : [],
    });
  } catch (error) {
    console.error("Sales Report Error:", error);

    res.status(500).json({
      success: false,

      message: "Failed to load sales report",

      dailySales: [],
      monthlySales: [],
    });
  }
};

exports.getPlasticDashboardStats = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period = "month", from_date, to_date } = req.query;

    let dateConditionBills = "";
    let dateConditionInwards = "";
    const paramsBills = [companyId];
    const paramsInwards = [companyId];

    if (period === "today") {
      dateConditionBills = " AND DATE(purchase_date) = CURDATE()";
      dateConditionInwards = " AND DATE(inward_date) = CURDATE()";
    } else if (period === "year") {
      dateConditionBills = " AND YEAR(purchase_date) = YEAR(CURDATE())";
      dateConditionInwards = " AND YEAR(inward_date) = YEAR(CURDATE())";
    } else if (period === "custom" && from_date && to_date) {
      dateConditionBills = " AND DATE(purchase_date) >= ? AND DATE(purchase_date) <= ?";
      dateConditionInwards = " AND DATE(inward_date) >= ? AND DATE(inward_date) <= ?";
      paramsBills.push(from_date, to_date);
      paramsInwards.push(from_date, to_date);
    } else {
      // Default: this month
      dateConditionBills = " AND DATE_FORMAT(purchase_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
      dateConditionInwards = " AND DATE_FORMAT(inward_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
    }

    // 1. Purchase Bills volume and amount
    const [purchases] = await db.promise().query(`
      SELECT
        COUNT(id) AS totalPurchaseBills,
        COALESCE(SUM(grand_total), 0) AS totalPurchaseAmount
      FROM purchase_bills
      WHERE company_id = ? ${dateConditionBills}
    `, paramsBills);

    // 1b. Total Purchased KG from purchase_bill_items
    const [itemsVolume] = await db.promise().query(`
      SELECT
        COALESCE(SUM(pbi.quantity), 0) AS totalPurchasedKg
      FROM purchase_bill_items pbi
      JOIN purchase_bills pb ON pbi.purchase_bill_id = pb.id AND pbi.company_id = pb.company_id
      WHERE pb.company_id = ? ${dateConditionBills.replace(/purchase_date/g, "pb.purchase_date")}
    `, paramsBills);

    // 2. Current Stock (independent of period filter - always reflects current inventory)
    const [stock] = await db.promise().query(`
      SELECT
        COALESCE(SUM(quantity), 0) AS currentStockKg,
        COALESCE(SUM(stock_value), 0) AS currentStockValue
      FROM raw_material_stock
      WHERE company_id = ?
    `, [companyId]);

    // 3. Active Suppliers
    const [suppliers] = await db.promise().query(`
      SELECT COUNT(*) AS totalSuppliers
      FROM suppliers
      WHERE company_id = ? AND status = 'ACTIVE'
    `, [companyId]);

    // 4. Truck Inwards
    const [trucks] = await db.promise().query(`
      SELECT
        COUNT(id) AS totalTruckInwards,
        COALESCE(SUM(net_weight), 0) AS totalInwardWeight
      FROM truck_inwards
      WHERE company_id = ? ${dateConditionInwards}
    `, paramsInwards);

    // 5. Low Stock Raw Materials
    const [lowStockMaterials] = await db.promise().query(`
      SELECT
        rm.id,
        rm.material_name,
        rm.plastic_type,
        rm.unit,
        rm.minimum_stock,
        COALESCE(rms.quantity, 0) AS current_stock
      FROM raw_materials rm
      LEFT JOIN raw_material_stock rms
        ON rm.id = rms.raw_material_id AND rm.company_id = rms.company_id
      WHERE rm.company_id = ?
        AND rm.status = 'ACTIVE'
        AND COALESCE(rms.quantity, 0) <= rm.minimum_stock
      ORDER BY COALESCE(rms.quantity, 0) ASC
      LIMIT 10
    `, [companyId]);

    // ==========================================
    // PHASE 2 EXECUTIVE KPIS
    // ==========================================
    let dateConditionBatches = "";
    const paramsBatches = [companyId];

    if (period === "today") {
      dateConditionBatches = " AND DATE(batch_date) = CURDATE()";
    } else if (period === "year") {
      dateConditionBatches = " AND YEAR(batch_date) = YEAR(CURDATE())";
    } else if (period === "custom" && from_date && to_date) {
      dateConditionBatches = " AND DATE(batch_date) >= ? AND DATE(batch_date) <= ?";
      paramsBatches.push(from_date, to_date);
    } else {
      // month
      dateConditionBatches = " AND DATE_FORMAT(batch_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
    }

    // Production volume in selected period
    const [batchMetrics] = await db.promise().query(`
      SELECT
        COALESCE(SUM(actual_quantity), 0) AS totalProductionKg,
        COALESCE(SUM(planned_quantity), 0) AS totalPlannedKg,
        COALESCE(SUM(scrap_quantity), 0) AS totalScrapKg,
        COALESCE(SUM(regrind_quantity), 0) AS totalRegrindKg,
        COALESCE(AVG(efficiency_percent), 0) AS avgEfficiencyPercent
      FROM plastic_production_batches
      WHERE company_id = ? ${dateConditionBatches}
    `, paramsBatches);

    // Today's production specifically
    const [todayProdRows] = await db.promise().query(`
      SELECT COALESCE(SUM(actual_quantity), 0) AS todayProductionKg
      FROM plastic_production_batches
      WHERE company_id = ? AND DATE(batch_date) = CURDATE()
    `, [companyId]);

    // Monthly production specifically
    const [monthProdRows] = await db.promise().query(`
      SELECT COALESCE(SUM(actual_quantity), 0) AS monthProductionKg
      FROM plastic_production_batches
      WHERE company_id = ? AND DATE_FORMAT(batch_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
    `, [companyId]);

    // Active production batches
    const [activeBatchesRows] = await db.promise().query(`
      SELECT COUNT(id) AS activeBatches
      FROM plastic_production_batches
      WHERE company_id = ? AND status = 'RUNNING'
    `, [companyId]);

    // Current WIP stock
    const [wipRows] = await db.promise().query(`
      SELECT COALESCE(SUM(wip_quantity), 0) AS currentWipKg
      FROM plastic_wip_stock
      WHERE company_id = ? AND status IN ('OPEN', 'PROCESSING')
    `, [companyId]);

    // Finished Goods stock
    const [fgRows] = await db.promise().query(`
      SELECT COALESCE(SUM(current_stock), 0) AS fgStockKg
      FROM plastic_finished_goods
      WHERE company_id = ?
    `, [companyId]);

    // Machines count and utilization
    const [machinesRows] = await db.promise().query(`
      SELECT
        COUNT(id) AS totalMachines,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS activeMachines,
        COUNT(CASE WHEN status IN ('MAINTENANCE', 'BREAKDOWN') THEN 1 END) AS maintenanceMachines
      FROM plastic_machines
      WHERE company_id = ?
    `, [companyId]);
    const totalMachines = Number(machinesRows[0]?.totalMachines) || 0;
    const activeMachines = Number(machinesRows[0]?.activeMachines) || 0;
    const machineUtilization = totalMachines > 0 ? ((activeMachines / totalMachines) * 100).toFixed(1) : "0.0";

    // QC Pending / Rejected
    const [qcRows] = await db.promise().query(`
      SELECT
        COUNT(CASE WHEN overall_status = 'PENDING' THEN 1 END) AS qcPending,
        COUNT(CASE WHEN overall_status = 'REJECTED' THEN 1 END) AS qcRejected
      FROM plastic_quality_inspections
      WHERE company_id = ?
    `, [companyId]);

    // Production cost
    const [costRows] = await db.promise().query(`
      SELECT COALESCE(SUM(total_cost), 0) AS totalProductionCost
      FROM plastic_production_costs
      WHERE company_id = ?
    `, [companyId]);

    const totalProd = Number(batchMetrics[0]?.totalProductionKg) || 0;
    const plannedProd = Number(batchMetrics[0]?.totalPlannedKg) || 0;
    const achievementPercent = plannedProd > 0 ? ((totalProd / plannedProd) * 100).toFixed(1) : (totalProd > 0 ? "100.0" : "0.0");

    // ==========================================
    // PHASE 3 SALES, DISPATCH & FINANCE KPIS
    // ==========================================
    const [salesToday] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS todaySales FROM invoices WHERE company_id = ? AND DATE(created_at) = CURDATE()`,
      [companyId]
    );
    const [salesMonth] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total), 0) AS monthSales FROM invoices WHERE company_id = ? AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
      [companyId]
    );
    const [soStats] = await db.promise().query(
      `SELECT
        COUNT(id) AS totalOrders,
        COUNT(CASE WHEN status IN ('DRAFT', 'CONFIRMED', 'RESERVED') THEN 1 END) AS pendingOrders
       FROM plastic_sales_orders WHERE company_id = ?`,
      [companyId]
    );
    const [dispatchStats] = await db.promise().query(
      `SELECT
        COUNT(id) AS totalDispatches,
        COUNT(CASE WHEN DATE(dispatch_date) = CURDATE() THEN 1 END) AS todayDispatches,
        COUNT(CASE WHEN DATE_FORMAT(dispatch_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m') THEN 1 END) AS monthDispatches
       FROM plastic_dispatches WHERE company_id = ?`,
      [companyId]
    );
    const [fgSoldRows] = await db.promise().query(
      `SELECT COALESCE(SUM(quantity), 0) AS fgSoldKg FROM plastic_sales_stock_movements WHERE company_id = ? AND movement_type = 'SALES_OUTWARD'`,
      [companyId]
    );
    const [receivablesRows] = await db.promise().query(
      `SELECT COALESCE(SUM(grand_total - paid_amount), 0) AS outstandingReceivables FROM invoices WHERE company_id = ? AND (payment_status != 'PAID' OR paid_amount < grand_total)`,
      [companyId]
    );
    const [paymentsRows] = await db.promise().query(
      `SELECT COALESCE(SUM(amount), 0) AS paymentsCollected FROM plastic_payments WHERE company_id = ? AND status = 'RECEIVED'`,
      [companyId]
    );
    const [returnsRows] = await db.promise().query(
      `SELECT COUNT(id) AS totalReturns, COALESCE(SUM(grand_total), 0) AS totalReturnAmount FROM plastic_sales_returns WHERE company_id = ?`,
      [companyId]
    );

    // Estimate gross profit: Total Sales - (FG Sold * avg cost or standard cost)
    const [costEstimateRows] = await db.promise().query(
      `SELECT
        COALESCE(SUM(di.quantity * di.rate), 0) AS dispatchRevenue,
        COALESCE(SUM(di.quantity * COALESCE(pc.cost_per_kg, fg.standard_cost, 0)), 0) AS dispatchCost
       FROM plastic_dispatch_items di
       JOIN plastic_dispatches d ON di.dispatch_id = d.id AND di.company_id = d.company_id
       JOIN plastic_finished_goods fg ON di.finished_good_id = fg.id AND di.company_id = fg.company_id
       LEFT JOIN plastic_finished_goods_lots fgl ON di.lot_id = fgl.id AND di.company_id = fgl.company_id
       LEFT JOIN plastic_production_costs pc ON fgl.batch_id = pc.batch_id AND fgl.company_id = pc.company_id
       WHERE di.company_id = ? AND d.status IN ('DISPATCHED', 'DELIVERED')`,
      [companyId]
    );
    const dRev = Number(costEstimateRows[0]?.dispatchRevenue) || 0;
    const dCost = Number(costEstimateRows[0]?.dispatchCost) || 0;
    const grossProfit = dRev > 0 ? dRev - dCost : 0;
    const grossMarginPercent = dRev > 0 ? Number(((grossProfit / dRev) * 100).toFixed(1)) : 0;

    res.status(200).json({
      success: true,
      period,
      stats: {
        // Phase 1 preserved stats
        totalPurchasedKg: Number(itemsVolume[0]?.totalPurchasedKg) || 0,
        totalPurchaseAmount: Number(purchases[0]?.totalPurchaseAmount) || 0,
        currentStockKg: Number(stock[0]?.currentStockKg) || 0,
        currentStockValue: Number(stock[0]?.currentStockValue) || 0,
        totalSuppliers: Number(suppliers[0]?.totalSuppliers) || 0,
        totalTruckInwards: Number(trucks[0]?.totalTruckInwards) || 0,
        totalPurchaseBills: Number(purchases[0]?.totalPurchaseBills) || 0,
        lowStockMaterials: lowStockMaterials || [],
        // Phase 2 executive KPIs
        todayProductionKg: Number(todayProdRows[0]?.todayProductionKg) || 0,
        monthProductionKg: Number(monthProdRows[0]?.monthProductionKg) || 0,
        productionTargetKg: plannedProd,
        productionAchievementPercent: Number(achievementPercent),
        activeBatches: Number(activeBatchesRows[0]?.activeBatches) || 0,
        currentWipKg: Number(wipRows[0]?.currentWipKg) || 0,
        finishedGoodsStockKg: Number(fgRows[0]?.fgStockKg) || 0,
        scrapGeneratedKg: Number(batchMetrics[0]?.totalScrapKg) || 0,
        regrindGeneratedKg: Number(batchMetrics[0]?.totalRegrindKg) || 0,
        efficiencyPercent: Number(batchMetrics[0]?.avgEfficiencyPercent) || 0,
        machineUtilizationPercent: Number(machineUtilization),
        activeMachines,
        maintenanceMachines: Number(machinesRows[0]?.maintenanceMachines) || 0,
        qcPending: Number(qcRows[0]?.qcPending) || 0,
        qcRejected: Number(qcRows[0]?.qcRejected) || 0,
        totalProductionCost: Number(costRows[0]?.totalProductionCost) || 0,
        // Phase 3 Sales, Dispatch & Finance KPIs
        todaySales: Number(salesToday[0]?.todaySales) || 0,
        monthSales: Number(salesMonth[0]?.monthSales) || 0,
        salesOrders: Number(soStats[0]?.totalOrders) || 0,
        pendingOrders: Number(soStats[0]?.pendingOrders) || 0,
        todayDispatches: Number(dispatchStats[0]?.todayDispatches) || 0,
        monthDispatches: Number(dispatchStats[0]?.monthDispatches) || 0,
        totalDispatches: Number(dispatchStats[0]?.totalDispatches) || 0,
        finishedGoodsSoldKg: Number(fgSoldRows[0]?.fgSoldKg) || 0,
        finishedGoodsAvailableKg: Number(fgRows[0]?.fgStockKg) || 0,
        outstandingReceivables: Number(receivablesRows[0]?.outstandingReceivables) || 0,
        paymentsCollected: Number(paymentsRows[0]?.paymentsCollected) || 0,
        salesReturns: Number(returnsRows[0]?.totalReturns) || 0,
        salesReturnAmount: Number(returnsRows[0]?.totalReturnAmount) || 0,
        grossProfit,
        grossMarginPercent,
      },
    });
  } catch (error) {
    console.error("Plastic Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load plastic recycling dashboard statistics",
    });
  }
};

exports.getPlasticPhase2Analytics = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { period = "today", from_date, to_date } = req.query;

    let dateCond = "";
    const params = [companyId];

    if (period === "today") {
      dateCond = " AND DATE(b.batch_date) = CURDATE()";
    } else if (period === "year") {
      dateCond = " AND YEAR(b.batch_date) = YEAR(CURDATE())";
    } else if (period === "custom" && from_date && to_date) {
      dateCond = " AND DATE(b.batch_date) >= ? AND DATE(b.batch_date) <= ?";
      params.push(from_date, to_date);
    } else {
      dateCond = " AND DATE_FORMAT(b.batch_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')";
    }

    // A. Daily production trend in period
    const [dailyTrend] = await db.promise().query(`
      SELECT
        DATE_FORMAT(b.batch_date, '%Y-%m-%d') AS date,
        COALESCE(SUM(b.actual_quantity), 0) AS production_kg,
        COALESCE(SUM(b.scrap_quantity), 0) AS scrap_kg
      FROM plastic_production_batches b
      WHERE b.company_id = ? ${dateCond}
      GROUP BY DATE_FORMAT(b.batch_date, '%Y-%m-%d')
      ORDER BY date ASC
    `, params);

    // B. Material consumption breakdown
    const [consumptionData] = await db.promise().query(`
      SELECT
        c.material_name,
        COALESCE(SUM(c.actual_quantity), 0) AS total_kg,
        COALESCE(SUM(c.total_cost), 0) AS total_cost
      FROM plastic_material_consumptions c
      WHERE c.company_id = ?
      GROUP BY c.material_name
      ORDER BY total_kg DESC
      LIMIT 6
    `, [companyId]);

    // C. Machine status & downtime breakdown
    const [machinesData] = await db.promise().query(`
      SELECT
        m.id,
        m.machine_name,
        m.machine_code,
        m.status,
        m.capacity,
        COALESCE(SUM(d.duration_minutes), 0) AS downtime_minutes
      FROM plastic_machines m
      LEFT JOIN plastic_machine_downtime d ON m.id = d.machine_id AND m.company_id = d.company_id
      WHERE m.company_id = ?
      GROUP BY m.id, m.machine_name, m.machine_code, m.status, m.capacity
    `, [companyId]);

    // D. Running batches (Live operations)
    const [runningBatches] = await db.promise().query(`
      SELECT
        b.id,
        b.batch_no,
        b.product_name,
        b.planned_quantity,
        b.status,
        m.machine_name,
        s.shift_name,
        o.name AS operator_name
      FROM plastic_production_batches b
      LEFT JOIN plastic_machines m ON b.machine_id = m.id AND b.company_id = m.company_id
      LEFT JOIN plastic_shifts s ON b.shift_id = s.id AND b.company_id = s.company_id
      LEFT JOIN plastic_operators o ON b.operator_id = o.id AND b.company_id = o.company_id
      WHERE b.company_id = ? AND b.status IN ('RUNNING', 'PAUSED')
      ORDER BY b.id DESC
      LIMIT 5
    `, [companyId]);

    res.status(200).json({
      success: true,
      analytics: {
        dailyTrend,
        consumptionData,
        machinesData,
        runningBatches,
      },
    });
  } catch (error) {
    console.error("Plastic Phase 2 Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load plastic operations analytics",
    });
  }
};

exports.getPlasticPhase3Analytics = async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // 1. Top Customers
    const [topCustomers] = await db.promise().query(
      `SELECT
        c.id,
        c.name,
        c.mobile,
        COUNT(i.id) AS invoices_count,
        COALESCE(SUM(i.grand_total), 0) AS total_revenue,
        COALESCE(SUM(i.grand_total - i.paid_amount), 0) AS outstanding
       FROM customers c
       LEFT JOIN invoices i ON c.id = i.customer_id AND c.company_id = i.company_id
       WHERE c.company_id = ?
       GROUP BY c.id
       ORDER BY total_revenue DESC
       LIMIT 5`,
      [companyId]
    );

    // 2. Top Selling Finished Goods
    const [topFinishedGoods] = await db.promise().query(
      `SELECT
        fg.id,
        fg.fg_name,
        fg.fg_code,
        fg.plastic_type,
        COALESCE(SUM(di.quantity), 0) AS sold_qty,
        COALESCE(SUM(di.quantity * di.rate), 0) AS revenue
       FROM plastic_finished_goods fg
       JOIN plastic_dispatch_items di ON fg.id = di.finished_good_id AND fg.company_id = di.company_id
       JOIN plastic_dispatches d ON di.dispatch_id = d.id AND di.company_id = d.company_id
       WHERE fg.company_id = ? AND d.status IN ('DISPATCHED', 'DELIVERED')
       GROUP BY fg.id
       ORDER BY sold_qty DESC
       LIMIT 5`,
      [companyId]
    );

    // 3. Recent Dispatches
    const [recentDispatches] = await db.promise().query(
      `SELECT
        d.id,
        d.dispatch_no,
        d.dispatch_date,
        d.status,
        c.name AS customer_name,
        d.vehicle_number,
        COALESCE(SUM(di.quantity), 0) AS total_kg
       FROM plastic_dispatches d
       JOIN customers c ON d.customer_id = c.id AND d.company_id = c.company_id
       LEFT JOIN plastic_dispatch_items di ON d.id = di.dispatch_id AND d.company_id = di.company_id
       WHERE d.company_id = ?
       GROUP BY d.id
       ORDER BY d.id DESC
       LIMIT 5`,
      [companyId]
    );

    // 4. Sales Orders Pipeline
    const [pipeline] = await db.promise().query(
      `SELECT
        status,
        COUNT(id) AS count,
        COALESCE(SUM(grand_total), 0) AS value
       FROM plastic_sales_orders
       WHERE company_id = ?
       GROUP BY status`,
      [companyId]
    );

    // 5. Operational Alerts
    const [pendingOrdersCount] = await db.promise().query(
      `SELECT COUNT(id) AS cnt FROM plastic_sales_orders WHERE company_id = ? AND status IN ('DRAFT', 'CONFIRMED', 'RESERVED')`,
      [companyId]
    );
    const [readyDispatchesCount] = await db.promise().query(
      `SELECT COUNT(id) AS cnt FROM plastic_dispatches WHERE company_id = ? AND status = 'READY'`,
      [companyId]
    );
    const [overdueInvoicesCount] = await db.promise().query(
      `SELECT COUNT(id) AS cnt FROM invoices WHERE company_id = ? AND (payment_status != 'PAID' OR paid_amount < grand_total) AND DATEDIFF(CURDATE(), COALESCE(due_date, DATE(created_at))) > 0`,
      [companyId]
    );
    const [pendingReturnsCount] = await db.promise().query(
      `SELECT COUNT(id) AS cnt FROM plastic_sales_returns WHERE company_id = ? AND status IN ('DRAFT', 'RECEIVED', 'INSPECTED')`,
      [companyId]
    );
    const [lowStockFg] = await db.promise().query(
      `SELECT COUNT(id) AS cnt FROM plastic_finished_goods WHERE company_id = ? AND current_stock <= minimum_stock`,
      [companyId]
    );

    res.status(200).json({
      success: true,
      analytics: {
        topCustomers,
        topFinishedGoods,
        recentDispatches,
        pipeline,
        alerts: {
          pendingOrders: pendingOrdersCount[0]?.cnt || 0,
          readyDispatches: readyDispatchesCount[0]?.cnt || 0,
          overdueInvoices: overdueInvoicesCount[0]?.cnt || 0,
          pendingReturns: pendingReturnsCount[0]?.cnt || 0,
          lowStockFg: lowStockFg[0]?.cnt || 0,
        },
      },
    });
  } catch (error) {
    console.error("Plastic Phase 3 Analytics Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load plastic sales analytics",
    });
  }
};
