const express = require("express");

const router = express.Router();

const productController = require("../controllers/productController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", productController.getProducts);

router.get("/low-stock", productController.getLowStockProducts);

router.get("/:id", productController.getProductById);

router.post("/", productController.createProduct);

router.put("/:id", productController.updateProduct);

router.delete("/:id", productController.deleteProduct);

module.exports = router;
