const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/plasticReportsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/operational", reportsController.getOperationalReports);
router.get("/alerts", reportsController.getOperationalAlerts);

module.exports = router;
