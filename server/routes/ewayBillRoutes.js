const express = require("express");
const router = express.Router();
const ewayBillController = require("../controllers/ewayBillController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

// KPI & Utilities
router.get("/kpi", ewayBillController.getEWayBillKPIs);
router.get("/next-no", ewayBillController.getNextEwbNo);
router.get("/source-data", ewayBillController.getSourceData);

// CRUD
router.get("/", ewayBillController.getEWayBills);
router.get("/:id", ewayBillController.getEWayBillById);
router.post("/", ewayBillController.createEWayBill);
router.put("/:id", ewayBillController.updateEWayBill);
router.patch("/:id/status", ewayBillController.updateStatus);
router.delete("/:id", ewayBillController.deleteEWayBill);

module.exports = router;
