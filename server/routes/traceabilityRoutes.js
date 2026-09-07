const express = require("express");
const router = express.Router();
const traceabilityController = require("../controllers/traceabilityController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/batch/:identifier", traceabilityController.traceBatch);

module.exports = router;
