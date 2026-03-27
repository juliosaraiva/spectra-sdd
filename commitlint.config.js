export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "refactor",
        "test",
        "chore",
        "perf",
        "ci",
        "revert",
        "build",
      ],
    ],
    "header-max-length": [2, "always", 100],
  },
};
