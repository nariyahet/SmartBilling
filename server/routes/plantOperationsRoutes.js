const express = require("express");
const router = express.Router();
const plantOps = require("../controllers/plantOperationsController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

// Machines
router.get("/machines", plantOps.getMachines);
router.get("/machines/:id", plantOps.getMachineById);
router.post("/machines", plantOps.createMachine);
router.put("/machines/:id", plantOps.updateMachine);

// Downtime
router.get("/downtime", plantOps.getDowntimeLogs);
router.post("/downtime", plantOps.logDowntime);

// Maintenance
router.get("/maintenance", plantOps.getMaintenanceRecords);
router.post("/maintenance", plantOps.createMaintenance);

// Shifts
router.get("/shifts", plantOps.getShifts);
router.post("/shifts", plantOps.createShift);

// Operators
router.get("/operators", plantOps.getOperators);
router.post("/operators", plantOps.createOperator);

module.exports = router;
