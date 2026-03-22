---
description: Show SPECTRA project health or detailed spec status
allowed-tools: Bash, Read
---

Show SPECTRA project or spec status.

**Without arguments** — project overview:
```
spectra status
```

**With spec ID** — detailed view:
```
spectra status $ARGUMENTS
```

Shows: title, version, status, AC count, impl count, test count, content hash, gates per phase, AC coverage percentage.

After showing status, suggest the next action based on what's missing (unsigned gates, uncovered ACs, drift issues).
