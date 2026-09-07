const express = require("express");
const router = express.Router();

const rawMaterialController = require("../controllers/rawMaterialController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", rawMaterialController.getRawMaterials);
router.get("/:id", rawMaterialController.getRawMaterialById);
router.post("/", rawMaterialController.createRawMaterial);
router.put("/:id", rawMaterialController.updateRawMaterial);
router.delete("/:id", rawMaterialController.deleteRawMaterial);

module.exports = router;
