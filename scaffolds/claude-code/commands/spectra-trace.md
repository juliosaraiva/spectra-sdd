---
description: Query the SPECTRA traceability matrix — trace files to specs and specs to artifacts
allowed-tools: Bash, Read
---

Traceability queries. Accepts a subcommand as first argument.

**Reverse trace — find which spec authorized a file:**
```
spectra trace why <file-path>
```

**Forward trace — list all artifacts for a spec:**
```
spectra trace forward <spec-id>
```

**AC coverage — show test coverage per acceptance criterion:**
```
spectra trace coverage <spec-id>
```

**Rebuild index:**
```
spectra trace update
```

Parse `$ARGUMENTS` to determine which subcommand to run. If no subcommand is recognized, show the available options.
