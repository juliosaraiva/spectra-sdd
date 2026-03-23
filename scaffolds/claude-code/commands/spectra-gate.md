---
description: Manage SPECTRA review gates — sign, check, verify, list, and expire
allowed-tools: Bash, Read
---

Gate management. Parse `$ARGUMENTS` to determine the operation.

## Operations

**Sign a gate** (`sign <spec-id> --phase <phase>`):

MANDATORY PREFLIGHT — do NOT skip these checks:
1. `spectra validate <spec-id>` — STOP if validation fails
2. `spectra lint <spec-id>` — STOP if any ERROR-level issues exist
3. `spectra gate check <spec-id> --phase <phase>` — STOP if prerequisite phases are unsigned

Only if ALL checks pass:
```
spectra gate sign <spec-id> --phase <phase> --signer "@claude-code"
```

**Check prerequisites** (`check <spec-id> --phase <phase>`):
```
spectra gate check <spec-id> --phase <phase>
```

**Verify integrity** (`verify <spec-id> --phase <phase>`):
```
spectra gate verify <spec-id> --phase <phase>
```

**List gates** (`list [spec-id]`):
```
spectra gate list
spectra gate list <spec-id>
```

**Expire gates** (`expire <spec-id>`):
```
spectra gate expire <spec-id>
```

## Phase Order

```
specify → design → test-design → implement → reconcile
```

Each phase requires all previous phases to be signed.
