const express = require("express");
const router = express.Router();

const rawMaterialStockController = require("../controllers/rawMaterialStockController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", rawMaterialStockController.getStockSummary);
router.get("/movements", rawMaterialStockController.getStockMovements);
router.get("/:material_id/movements", rawMaterialStockController.getStockMovements);
router.post("/adjustment", rawMaterialStockController.recordStockAdjustment);

module.exports = router;
