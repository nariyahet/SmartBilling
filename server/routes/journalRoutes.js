const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");
const journalController = require("../controllers/journalController");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/next-no", journalController.getNextJournalNo);
router.get("/", journalController.getJournalEntries);
router.get("/:id", journalController.getJournalEntryById);
router.post("/", journalController.createJournalEntry);

module.exports = router;
