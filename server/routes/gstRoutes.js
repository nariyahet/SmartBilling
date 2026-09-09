const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const gstController = require("../controllers/gstController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/records", gstController.getGstRecords);
router.get("/gstr-1", gstController.getGstr1Report);
router.get("/gstr-3b", gstController.getGstr3bReport);
router.get("/itc-register", gstController.getItcRegister);
router.patch("/itc-status/:id", gstController.updateItcStatus);

module.exports = router;
