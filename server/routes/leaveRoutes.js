const express = require("express");
const router = express.Router();
const leaveController = require("../controllers/leaveController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/types", leaveController.getLeaveTypes);
router.post("/types", leaveController.createLeaveType);
router.get("/balances", leaveController.getLeaveBalances);
router.post("/initialize-balances", leaveController.initializeBalances);
router.get("/requests", leaveController.getLeaveRequests);
router.post("/requests", leaveController.createLeaveRequest);
router.put("/requests/:id/status", leaveController.updateLeaveRequestStatus);
router.patch("/requests/:id/status", leaveController.updateLeaveRequestStatus);
router.patch("/requests/:id/approve", leaveController.approveLeaveRequest);
router.patch("/requests/:id/reject", leaveController.rejectLeaveRequest);

module.exports = router;
