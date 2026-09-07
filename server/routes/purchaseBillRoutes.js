const express = require("express");
const router = express.Router();

const purchaseBillController = require("../controllers/purchaseBillController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", purchaseBillController.getPurchaseBills);
router.get("/:id", purchaseBillController.getPurchaseBillById);
router.post("/", purchaseBillController.createPurchaseBill);

module.exports = router;
