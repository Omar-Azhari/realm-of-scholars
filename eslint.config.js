// ESLint flat config (RC1). Recommended TypeScript + React hooks rules —
// correctness-focused; nothing is globally silenced. Any inline
// eslint-disable in src/ carries a justification comment.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // _-prefixed args and rest-sibling omissions (`const { id: _id, ...rest }`)
      // are intentional patterns, not dead variables.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
    languageOptions: {
      globals: { ...globals.browser },
    },
  }
);
