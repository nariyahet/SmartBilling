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
