const express = require("express");
const router = express.Router();
const salesOrderController = require("../controllers/salesOrderController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", salesOrderController.getNextSalesOrderNo);
router.get("/reservations", salesOrderController.getReservations);
router.get("/", salesOrderController.getSalesOrders);
router.get("/:id", salesOrderController.getSalesOrderById);
router.post("/", salesOrderController.createSalesOrder);
router.patch("/:id/confirm", salesOrderController.confirmSalesOrder);
router.patch("/:id/cancel", salesOrderController.cancelSalesOrder);

module.exports = router;
