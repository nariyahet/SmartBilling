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

router.get("/plastic-stats", dashboardController.getPlasticDashboardStats);

module.exports = router;
