const express = require("express");
const router = express.Router();
const transportController = require("../controllers/transportController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

// Vehicles
router.get("/vehicles", transportController.getVehicles);
router.post("/vehicles", transportController.createVehicle);
router.put("/vehicles/:id", transportController.updateVehicle);

// Delivery Challans
router.get("/challans/next-no", transportController.getNextChallanNo);
router.get("/challans", transportController.getChallans);
router.get("/challans/:id", transportController.getChallanById);
router.post("/challans", transportController.createChallan);
router.patch("/challans/:id/status", transportController.updateChallanStatus);

module.exports = router;
