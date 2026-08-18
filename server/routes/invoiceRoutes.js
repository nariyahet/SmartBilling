const express = require("express");

const router = express.Router();

const invoiceController = require("../controllers/invoiceController");

// CREATE INVOICE
router.post("/", invoiceController.createInvoice);

// NEW INVOICE NUMBER
router.get("/new", invoiceController.getNewInvoice);

// GET ALL INVOICES
router.get("/", invoiceController.getInvoices);

// GET SINGLE INVOICE
router.get("/:id", invoiceController.getInvoiceById);

module.exports = router;
