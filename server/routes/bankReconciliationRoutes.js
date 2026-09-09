const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const reconController = require("../controllers/bankReconciliationController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", reconController.getReconciliations);
router.post("/", reconController.createStatementLine);
router.post("/:id/match", reconController.matchTransaction);
router.post("/:id/unmatch", reconController.unmatchTransaction);
router.get("/summary", reconController.getReconSummary);

module.exports = router;
