const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-code", employeeController.getNextEmployeeCode);
router.get("/meta", employeeController.getDepartmentsAndDesignations);
router.get("/", employeeController.getEmployees);
router.get("/:id", employeeController.getEmployeeById);
router.post("/", employeeController.createEmployee);
router.put("/:id", employeeController.updateEmployee);
router.put("/:id/salary", employeeController.updateSalaryStructure);
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
