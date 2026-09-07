const express = require("express");
const router = express.Router();
const production = require("../controllers/productionController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

// Production Planning
router.get("/plans", production.getProductionPlans);
router.post("/plans", production.createProductionPlan);
router.put("/plans/:id/status", production.updateProductionPlanStatus);

// Production Orders
router.get("/orders", production.getProductionOrders);
router.get("/orders/:id", production.getProductionOrderById);
router.post("/orders", production.createProductionOrder);
router.put("/orders/:id/status", production.updateProductionOrderStatus);

// Production Batches
router.get("/batches", production.getProductionBatches);
router.get("/batches/:id", production.getProductionBatchById);
router.post("/batches", production.createProductionBatch);

// Shop Floor Batch Controls
router.post("/batches/:id/start", production.startBatch);
router.post("/batches/:id/pause", production.pauseBatch);
router.post("/batches/:id/resume", production.resumeBatch);
router.post("/batches/:id/complete", production.completeBatch);

module.exports = router;
