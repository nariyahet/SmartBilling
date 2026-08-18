const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");

// ==========================================
// GET ALL PRODUCTS
// ==========================================
router.get(
  "/",
  productController.getProducts
);

// ==========================================
// GET LOW STOCK PRODUCTS
// IMPORTANT: Keep this BEFORE /:id
// ==========================================
router.get(
  "/low-stock",
  productController.getLowStockProducts
);

// ==========================================
// GET SINGLE PRODUCT
// ==========================================
router.get(
  "/:id",
  productController.getProductById
);

// ==========================================
// CREATE PRODUCT
// ==========================================
router.post(
  "/",
  productController.createProduct
);

// ==========================================
// UPDATE PRODUCT
// ==========================================
router.put(
  "/:id",
  productController.updateProduct
);

// ==========================================
// DELETE PRODUCT
// ==========================================
router.delete(
  "/:id",
  productController.deleteProduct
);

module.exports = router;