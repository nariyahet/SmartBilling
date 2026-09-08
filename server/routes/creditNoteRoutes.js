const express = require("express");
const router = express.Router();
const creditNoteController = require("../controllers/creditNoteController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", creditNoteController.getNextCreditNoteNo);
router.get("/", creditNoteController.getCreditNotes);
router.get("/:id", creditNoteController.getCreditNoteById);
router.post("/", creditNoteController.createCreditNote);

module.exports = router;
