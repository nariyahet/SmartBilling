const express = require("express");
const router = express.Router();
const phase3ReportsController = require("../controllers/phase3ReportsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/sales-summary", phase3ReportsController.getSalesSummary);
router.get("/dispatches", phase3ReportsController.getDispatchSummary);
router.get("/payments", phase3ReportsController.getPaymentSummary);
router.get("/profit-margin", phase3ReportsController.getProfitMarginReport);

module.exports = router;
