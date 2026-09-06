const express = require("express");
const router = express.Router();

const businessSettingsController = require("../controllers/businessSettingsController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware);

router.get("/", businessSettingsController.getSettings);
router.put("/", businessSettingsController.updateSettings);

module.exports = router;
