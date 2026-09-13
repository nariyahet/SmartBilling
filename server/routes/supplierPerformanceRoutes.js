const express = require("express");
const router = express.Router();
const perfController = require("../controllers/supplierPerformanceController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/scorecard", perfController.getScorecard);
router.get("/:id/history", perfController.getSupplierHistory);

module.exports = router;
