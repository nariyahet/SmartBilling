const express = require("express");
const router = express.Router();
const receivablesController = require("../controllers/receivablesController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/summary", receivablesController.getReceivablesSummary);
router.get("/customers", receivablesController.getCustomerReceivables);
router.get("/aging", receivablesController.getReceivablesAging);
router.get("/invoices", receivablesController.getPendingInvoices);

module.exports = router;
