const express = require("express");
const router = express.Router();
const costingController = require("../controllers/productionCostingController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", costingController.getAllBatchCosts);
router.post("/batch/:batch_id", costingController.calculateBatchCost);

module.exports = router;
