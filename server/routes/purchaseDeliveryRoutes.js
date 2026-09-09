const express = require("express");
const router = express.Router();
const deliveryController = require("../controllers/purchaseDeliveryController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/next-no", deliveryController.getNextDeliveryNo);
router.get("/pending", deliveryController.getPendingItems);
router.get("/", deliveryController.getDeliveries);
router.post("/", deliveryController.recordDelivery);

module.exports = router;
