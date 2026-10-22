import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["node_modules/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Phone number patterns and their docs contain non-breaking spaces on purpose.
      "no-irregular-whitespace": ["error", { skipRegExps: true, skipComments: true }],
      // `const { reguly: _reguly, ...rest }` drops a key from an object; the underscore marks it as unused on purpose.
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    },
  },
);
