const express = require("express");
const router = express.Router();
const requisitionController = require("../controllers/procurementRequisitionController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/next-no", requisitionController.getNextPRNo);
router.get("/", requisitionController.getRequisitions);
router.get("/:id", requisitionController.getRequisitionById);
router.post("/", requisitionController.createRequisition);
router.put("/:id", requisitionController.updateRequisition);
router.put("/:id/status", requisitionController.updateRequisitionStatus);
router.post("/:id/convert-to-po", requisitionController.convertToPO);

module.exports = router;
