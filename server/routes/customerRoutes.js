const express = require("express");

const router = express.Router();

const customerController = require("../controllers/customerController");

// ==========================================
// GET ALL CUSTOMERS
// ==========================================
router.get(
  "/",
  customerController.getCustomers
);

// ==========================================
// GET SINGLE CUSTOMER
// ==========================================
router.get(
  "/:id",
  customerController.getCustomerById
);

// ==========================================
// CREATE CUSTOMER
// ==========================================
router.post(
  "/",
  customerController.createCustomer
);

// ==========================================
// UPDATE CUSTOMER
// ==========================================
router.put(
  "/:id",
  customerController.updateCustomer
);

// ==========================================
// DELETE CUSTOMER
// ==========================================
router.delete(
  "/:id",
  customerController.deleteCustomer
);

module.exports = router;