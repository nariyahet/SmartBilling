const express = require("express");
const router = express.Router();
const perfController = require("../controllers/supplierPerformanceController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/scorecard", perfController.getScorecard);
router.get("/:id/history", perfController.getSupplierHistory);

module.exports = router;
