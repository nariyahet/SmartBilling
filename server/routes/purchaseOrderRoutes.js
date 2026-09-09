const express = require("express");
const router = express.Router();
const poController = require("../controllers/purchaseOrderController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/next-no", poController.getNextPONo);
router.get("/", poController.getPurchaseOrders);
router.get("/:id", poController.getPurchaseOrderById);
router.post("/", poController.createPurchaseOrder);
router.put("/:id/status", poController.updatePurchaseOrderStatus);

module.exports = router;
