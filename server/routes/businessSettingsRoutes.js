const express = require("express");
const router = express.Router();

const businessSettingsController = require("../controllers/businessSettingsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", businessSettingsController.getSettings);
router.put("/", businessSettingsController.updateSettings);

module.exports = router;
