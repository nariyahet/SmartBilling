const db = require("../config/db");

// ==========================================
// GET DASHBOARD STATS
// ==========================================
exports.getDashboardStats = async (req, res) => {
  try {
    // Total Customers
    const [customers] = await db
      .promise()
      .query(
        "SELECT COUNT(*) AS totalCustomers FROM customers"
      );

    // Total Products
    const [products] = await db
      .promise()
      .query(
        "SELECT COUNT(*) AS totalProducts FROM products"
      );

    // Total Invoices
    const [invoices] = await db
      .promise()
      .query(
        "SELECT COUNT(*) AS totalInvoices FROM invoices"
      );

    // Total Sales
    const [sales] = await db.promise().query(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS totalSales
      FROM invoices
    `);

    // Today's Sales
    const [todaySales] = await db.promise().query(`
      SELECT
        COALESCE(SUM(grand_total), 0) AS todaySales
      FROM invoices
      WHERE DATE(created_at) = CURDATE()
    `);

    res.status(200).json({
      success: true,

      stats: {
        totalCustomers:
          Number(customers[0]?.totalCustomers) || 0,

        totalProducts:
          Number(products[0]?.totalProducts) || 0,

        totalInvoices:
          Number(invoices[0]?.totalInvoices) || 0,

        totalSales:
          Number(sales[0]?.totalSales) || 0,

        todaySales:
          Number(todaySales[0]?.todaySales) || 0,
      },
    });
  } catch (error) {
    console.error(
      "Dashboard Stats Error:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to load dashboard statistics",

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

// ==========================================
// GET LOW STOCK PRODUCTS
// ==========================================
exports.getLowStockProducts = async (
  req,
  res
) => {
  try {
    const [products] =
      await db.promise().query(`
        SELECT
          id,
          name,
          price,
          stock
        FROM products
        WHERE stock <= 5
        ORDER BY stock ASC, id DESC
      `);

    res.status(200).json({
      success: true,

      products: Array.isArray(products)
        ? products
        : [],
    });
  } catch (error) {
    console.error(
      "Low Stock Error:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to load low stock products",

      products: [],
    });
  }
};

// ==========================================
// GET SALES REPORT
// ==========================================
exports.getSalesReport = async (
  req,
  res
) => {
  try {
    // ======================================
    // DAILY SALES
    // ======================================
    const [dailySales] =
      await db.promise().query(`
        SELECT
          DATE(created_at) AS date,
          COALESCE(
            SUM(grand_total),
            0
          ) AS total
        FROM invoices
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at) DESC
      `);

    // ======================================
    // MONTHLY SALES
    // ======================================
    const [monthlySales] =
      await db.promise().query(`
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

        GROUP BY
          DATE_FORMAT(
            created_at,
            '%Y-%m'
          )

        ORDER BY month DESC
      `);

    // ======================================
    // RESPONSE
    // ======================================
    res.status(200).json({
      success: true,

      dailySales: Array.isArray(
        dailySales
      )
        ? dailySales.map((item) => ({
            date: item.date,
            total:
              Number(item.total) || 0,
          }))
        : [],

      monthlySales: Array.isArray(
        monthlySales
      )
        ? monthlySales.map((item) => ({
            month: item.month,
            total:
              Number(item.total) || 0,
          }))
        : [],
    });
  } catch (error) {
    console.error(
      "Sales Report Error:",
      error
    );

    res.status(500).json({
      success: false,

      message:
        "Failed to load sales report",

      dailySales: [],
      monthlySales: [],
    });
  }
};