const express = require("express");
const router = express.Router();
const prodInv = require("../controllers/productionInventoryController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

// Material Consumption
router.get("/consumptions", prodInv.getMaterialConsumptions);
router.post("/consume", prodInv.recordMaterialConsumption);

// WIP Inventory
router.get("/wip", prodInv.getWipStock);
router.put("/wip/:id", prodInv.updateWipStage);

// Finished Goods
router.get("/finished-goods", prodInv.getFinishedGoods);
router.post("/finished-goods", prodInv.createFinishedGood);
router.get("/finished-goods/lots", prodInv.getFinishedGoodsLots);

// Scrap & Waste
router.get("/scrap", prodInv.getScrapRecords);
router.post("/scrap", prodInv.recordScrap);

// Regrind
router.get("/regrind", prodInv.getRegrindTransactions);
router.post("/regrind/generate", prodInv.recordRegrindGeneration);

module.exports = router;
