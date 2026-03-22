---
description: Detect drift between SPECTRA specs and implementation
allowed-tools: Bash, Read
---

Run drift detection across the project.

```
spectra diff
```

**With JSON output for CI:**
```
spectra diff --json --save
```

## Drift Types

- **Structural** — Source files with `@spectra` trace comments not matching the trace matrix
- **Semantic** — Acceptance criteria without test coverage
- **Constitutional** — Active specs with no signed gates

## Drift Score

| Range | Meaning |
|-------|---------|
| 0.0 | Clean — no drift |
| 0.0-0.3 | Minor drift |
| 0.3-0.7 | Significant drift |
| 0.7-1.0 | Critical drift |

If drift score > 0.3, suggest specific fixes based on the drift items reported.
