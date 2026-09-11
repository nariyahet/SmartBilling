const express = require("express");
const router = express.Router();
const customerLedgerController = require("../controllers/customerLedgerController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/overview", customerLedgerController.getLedgerOverview);
router.get("/customer/:customerId", customerLedgerController.getCustomerLedger);
router.get("/:customerId", customerLedgerController.getCustomerLedger);

module.exports = router;
