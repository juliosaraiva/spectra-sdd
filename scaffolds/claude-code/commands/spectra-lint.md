---
description: Lint SPECTRA specs for quality issues beyond schema validity
allowed-tools: Bash, Read
---

Lint spec quality.

**Single spec:**
```
spectra lint $ARGUMENTS
```

**All specs:**
```
spectra lint --all
```

## Linter Rules

| Rule | Severity | Issue |
|------|----------|-------|
| SPEC-001 | error | Empty given/when/then in acceptance criteria |
| SPEC-002 | warning | Vague language: "fast", "scalable", "appropriate", "should", "may" |
| SPEC-003 | error | Interface schema contains `any` or `unknown` types |
| SPEC-004 | warning | Performance NFR lacks numeric threshold |
| SPEC-006 | error | Content hash is stale (spec edited without rehashing) |
| SPEC-007 | warning | No AC marked `non_negotiable: true` |
| SPEC-008 | warning | Domain tag not in constitution vocabulary |

Fix all ERRORs before proceeding. For SPEC-006, run `spectra spec rehash <id>`.
