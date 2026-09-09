const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const chartController = require("../controllers/chartOfAccountsController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/groups", chartController.getAccountGroups);
router.post("/groups", chartController.createAccountGroup);

router.get("/accounts", chartController.getAccounts);
router.get("/accounts/:id", chartController.getAccountById);
router.post("/accounts", chartController.createAccount);
router.put("/accounts/:id", chartController.updateAccount);

router.get("/integrated-masters", chartController.getIntegratedMasters);

module.exports = router;
