import tseslint from "typescript-eslint";
import react from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "react-hooks": react },
    rules: {
      ...react.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
