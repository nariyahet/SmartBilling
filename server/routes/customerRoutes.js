const express = require("express");

const router = express.Router();

const customerController = require("../controllers/customerController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", customerController.getCustomers);

router.get("/:id", customerController.getCustomerById);

router.post("/", customerController.createCustomer);

router.put("/:id", customerController.updateCustomer);

router.delete("/:id", customerController.deleteCustomer);

module.exports = router;
