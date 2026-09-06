const express = require("express");

const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", dashboardController.getDashboardStats);

router.get("/low-stock", dashboardController.getLowStockProducts);

router.get("/sales-report", dashboardController.getSalesReport);

module.exports = router;
