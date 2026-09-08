const express = require("express");
const router = express.Router();
const workforceController = require("../controllers/workforceController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/overview", workforceController.getWorkforceOverview);
router.post("/map-operator", workforceController.mapOperatorToEmployee);
router.get("/shift-labour-cost", workforceController.getShiftLabourCost);

module.exports = router;
