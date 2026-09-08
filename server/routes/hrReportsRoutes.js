const express = require("express");
const router = express.Router();
const hrReportsController = require("../controllers/hrReportsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/salary-register", hrReportsController.getSalaryRegister);
router.get("/attendance-summary", hrReportsController.getAttendanceSummaryReport);
router.get("/leave-report", hrReportsController.getLeaveReport);
router.get("/advance-recovery", hrReportsController.getAdvanceRecoveryReport);
router.get("/expenses-summary", hrReportsController.getExpenseSummaryReport);
router.get("/labour-cost", hrReportsController.getPlantLabourCostReport);

module.exports = router;
