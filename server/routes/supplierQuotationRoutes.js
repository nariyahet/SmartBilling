const express = require("express");
const router = express.Router();
const quotationController = require("../controllers/supplierQuotationController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/next-no", quotationController.getNextQuoteNo);
router.get("/compare", quotationController.compareQuotations);
router.get("/", quotationController.getQuotations);
router.get("/:id", quotationController.getQuotationById);
router.post("/", quotationController.createQuotation);
router.post("/:id/convert-to-po", quotationController.convertQuoteToPO);

module.exports = router;
