const express = require("express");
const router = express.Router();
const qualityController = require("../controllers/qualityController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/inspections", qualityController.getInspections);
router.get("/inspections/:id", qualityController.getInspectionById);
router.post("/inspections", qualityController.createInspection);

module.exports = router;
