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

    res.status(200).json({
      success: true,
      period,
      stats: {
        totalPurchasedKg: Number(itemsVolume[0]?.totalPurchasedKg) || 0,
        totalPurchaseAmount: Number(purchases[0]?.totalPurchaseAmount) || 0,
        currentStockKg: Number(stock[0]?.currentStockKg) || 0,
        currentStockValue: Number(stock[0]?.currentStockValue) || 0,
        totalSuppliers: Number(suppliers[0]?.totalSuppliers) || 0,
        totalTruckInwards: Number(trucks[0]?.totalTruckInwards) || 0,
        totalPurchaseBills: Number(purchases[0]?.totalPurchaseBills) || 0,
        lowStockMaterials: lowStockMaterials || [],
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
