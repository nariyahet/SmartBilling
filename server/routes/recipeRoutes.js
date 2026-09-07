const express = require("express");
const router = express.Router();
const recipeController = require("../controllers/recipeController");
const authMiddleware = require("../middleware/authMiddleware");
const trialMiddleware = require("../middleware/trialMiddleware");

router.use(authMiddleware);
router.use(trialMiddleware);

router.get("/", recipeController.getRecipes);
router.get("/:id", recipeController.getRecipeById);
router.post("/", recipeController.createRecipe);
router.put("/:id", recipeController.updateRecipe);

module.exports = router;
