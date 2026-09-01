const express = require("express");
const router = express.Router();

const businessSettingsController = require("../controllers/businessSettingsController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", businessSettingsController.getSettings);
router.put("/", authMiddleware, businessSettingsController.updateSettings);

module.exports = router;
