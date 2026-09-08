const express = require("express");
const router = express.Router();
const dispatchController = require("../controllers/dispatchController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", dispatchController.getNextDispatchNo);
router.get("/", dispatchController.getDispatches);
router.get("/:id", dispatchController.getDispatchById);
router.post("/", dispatchController.createDispatch);
router.patch("/:id/status", dispatchController.updateDispatchStatus);
router.post("/:id/create-invoice", dispatchController.createInvoiceFromDispatch);

module.exports = router;
