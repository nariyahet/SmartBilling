const express = require("express");

const router = express.Router();

const dashboardController = require("../controllers/dashboardController");

// ==========================================
// DASHBOARD STATS
// GET /api/dashboard
// ==========================================
router.get(
  "/",
  dashboardController.getDashboardStats
);

// ==========================================
// LOW STOCK
// GET /api/dashboard/low-stock
// ==========================================
router.get(
  "/low-stock",
  dashboardController.getLowStockProducts
);

// ==========================================
// SALES REPORT
// GET /api/dashboard/sales-report
// ==========================================
router.get(
  "/sales-report",
  dashboardController.getSalesReport
);

module.exports = router;