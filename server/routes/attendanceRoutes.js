const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/daily", attendanceController.getDailyAttendance);
router.get("/daily-roster", attendanceController.getDailyAttendance);
router.get("/monthly-summary", attendanceController.getMonthlyAttendanceSummary);
router.get("/summary", attendanceController.getMonthlyAttendanceSummary);
router.get("/employee/:employeeId", attendanceController.getEmployeeAttendanceHistory);
router.post("/mark", attendanceController.markAttendance);
router.post("/bulk", attendanceController.markBulkAttendance);


module.exports = router;
