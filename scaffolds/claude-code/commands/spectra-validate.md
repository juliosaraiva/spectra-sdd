---
description: Validate SPECTRA spec files against their schemas
allowed-tools: Bash, Read
---

Validate spec schemas.

**Single spec:**
```
spectra validate $ARGUMENTS
```

**All specs with cross-reference checks:**
```
spectra validate --all --cross-refs
```

If validation fails, read the spec file and fix the schema errors. Common issues:
- Missing required fields (id, title, given, when, then)
- Invalid ID format (must be `feat:name`, `impl:name`, `test:name`)
- Empty acceptance criteria arrays
- Invalid semver format

After fixing, re-validate to confirm.
