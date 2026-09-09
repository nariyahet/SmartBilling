const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/procurementReportsController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/requisitions", reportsController.getPurchaseRequisitionReport);
router.get("/orders", reportsController.getPurchaseOrderReport);
router.get("/pending-orders", reportsController.getPendingPOReport);
router.get("/suppliers", reportsController.getSupplierPurchaseReport);
router.get("/materials", reportsController.getMaterialPurchaseReport);
router.get("/rate-history", reportsController.getPurchaseRateHistoryReport);
router.get("/supplier-performance", reportsController.getSupplierPerformanceReport);
router.get("/delivery-performance", reportsController.getDeliveryPerformanceReport);
router.get("/variance", reportsController.getPurchaseVarianceReport);
router.get("/trend", reportsController.getPurchaseTrendReport);
router.get("/mrp", reportsController.getMaterialRequirementReport);
router.get("/savings", reportsController.getProcurementSavingsReport);

module.exports = router;
