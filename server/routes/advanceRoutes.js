const express = require("express");
const router = express.Router();
const advanceController = require("../controllers/advanceController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", advanceController.getNextAdvanceNo);
router.get("/", advanceController.getAdvances);
router.post("/", advanceController.createAdvance);
router.post("/:id/recover", advanceController.recordAdvanceRecovery);
router.post("/:id/repay", advanceController.recordAdvanceRecovery);

module.exports = router;
