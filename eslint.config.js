import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.config.*"],
  },

  // Base config for all TypeScript source files
  {
    files: ["src/**/*.ts", "tests/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      eqeqeq: ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
    },
  },

  // Looser rules for test files
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  }
);
