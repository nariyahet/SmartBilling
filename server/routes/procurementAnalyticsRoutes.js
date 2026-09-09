const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/procurementAnalyticsController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/dashboard", analyticsController.getDashboardData);
router.get("/alerts", analyticsController.getAlerts);
router.get("/mrp", analyticsController.getMRP);

module.exports = router;
