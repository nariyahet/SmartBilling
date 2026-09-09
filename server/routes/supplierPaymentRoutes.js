const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const supPayController = require("../controllers/supplierPaymentController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", supPayController.getSupplierPayments);
router.post("/", supPayController.recordSupplierPayment);
router.get("/:id", supPayController.getSupplierPaymentById);
router.get("/ledger/:supplier_id", supPayController.getSupplierLedger);

module.exports = router;
