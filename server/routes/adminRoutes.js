const express = require("express");

const router = express.Router();

const adminController = require("../controllers/customerController");

router.post("/login", adminController.login);

module.exports = router;
