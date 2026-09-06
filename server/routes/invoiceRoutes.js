const express = require("express");

const router = express.Router();

const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.post("/", invoiceController.createInvoice);

router.get("/new", invoiceController.getNewInvoice);

router.get("/", invoiceController.getInvoices);

router.get("/:id", invoiceController.getInvoiceById);

module.exports = router;
