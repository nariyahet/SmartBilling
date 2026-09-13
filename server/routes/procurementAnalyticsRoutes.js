const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/procurementAnalyticsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/dashboard", analyticsController.getDashboardData);
router.get("/alerts", analyticsController.getAlerts);
router.get("/mrp", analyticsController.getMRP);

module.exports = router;
