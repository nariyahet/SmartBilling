const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const cashBankController = require("../controllers/cashBankController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/accounts", cashBankController.getAccounts);
router.post("/accounts", cashBankController.createAccount);

router.get("/transactions", cashBankController.getTransactions);
router.post("/transactions", cashBankController.recordTransaction);

router.get("/statement/:id", cashBankController.getStatement);

module.exports = router;
