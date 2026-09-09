const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const gstReconController = require("../controllers/gstReconciliationController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/items", gstReconController.getGstReconciliationItems);
router.post("/items", gstReconController.addPortalItem);
router.post("/auto-match", gstReconController.autoMatchPortalItems);

module.exports = router;
