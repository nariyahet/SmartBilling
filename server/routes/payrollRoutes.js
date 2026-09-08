const express = require("express");
const router = express.Router();
const payrollController = require("../controllers/payrollController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", payrollController.getPayrolls);
router.get("/payslip/:payslipNo", payrollController.getPayslip);
router.get("/:id", payrollController.getPayrollById);
router.post("/process", payrollController.processMonthlyPayroll);
router.post("/generate", payrollController.processMonthlyPayroll);
router.put("/:id/status", payrollController.updatePayrollStatus);
router.patch("/:id/status", payrollController.updatePayrollStatus);

module.exports = router;
