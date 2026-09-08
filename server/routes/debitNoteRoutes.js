const express = require("express");
const router = express.Router();
const debitNoteController = require("../controllers/debitNoteController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", debitNoteController.getNextDebitNoteNo);
router.get("/", debitNoteController.getDebitNotes);
router.get("/:id", debitNoteController.getDebitNoteById);
router.post("/", debitNoteController.createDebitNote);

module.exports = router;
