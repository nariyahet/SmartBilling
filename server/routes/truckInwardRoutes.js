const express = require("express");
const router = express.Router();

const truckInwardController = require("../controllers/truckInwardController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", truckInwardController.getTruckInwards);
router.get("/:id", truckInwardController.getTruckInwardById);
router.post("/", truckInwardController.createTruckInward);
router.put("/:id", truckInwardController.updateTruckInward);

module.exports = router;
