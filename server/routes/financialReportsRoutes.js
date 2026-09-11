const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const repController = require("../controllers/financialReportsController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", repController.getTrialBalance);
router.get("/trial-balance", repController.getTrialBalance);
router.get("/profit-loss", repController.getProfitAndLoss);
router.get("/balance-sheet", repController.getBalanceSheet);
router.get("/cash-book", repController.getCashBook);
router.get("/bank-book", repController.getBankBook);
router.get("/general-ledger", repController.getGeneralLedger);
router.get("/customer-ledger", repController.getCustomerLedgerReport);
router.get("/supplier-ledger", repController.getSupplierLedgerReport);
router.get("/expense-report", repController.getExpenseReport);
router.get("/receivables", repController.getReceivableReport);
router.get("/payables", repController.getPayableReport);
router.get("/gst-summary", repController.getGstSummaryReport);
router.get("/hsn-summary", repController.getHsnSummaryReport);
router.get("/cash-flow", repController.getCashFlowSummary);
router.get("/dashboard-kpis", repController.getFinancialDashboardKPIs);

module.exports = router;
