const express = require("express");
const router = express.Router();
const salesReturnController = require("../controllers/salesReturnController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", salesReturnController.getNextReturnNo);
router.get("/", salesReturnController.getSalesReturns);
router.get("/:id", salesReturnController.getSalesReturnById);
router.post("/", salesReturnController.createSalesReturn);
router.patch("/:id/complete", salesReturnController.completeSalesReturn);

module.exports = router;
