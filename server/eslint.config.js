import js from "@eslint/js";
import globals from "globals";

export default [
  {
    files: ["**/*.js"],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },

    rules: {
      ...js.configs.recommended.rules,
    },
  },
];
