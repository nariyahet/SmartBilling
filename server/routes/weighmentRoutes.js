const express = require("express");
const router = express.Router();

const weighmentController = require("../controllers/weighmentController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", weighmentController.getWeighments);
router.get("/:id", weighmentController.getWeighmentById);
router.post("/", weighmentController.createWeighment);

module.exports = router;
