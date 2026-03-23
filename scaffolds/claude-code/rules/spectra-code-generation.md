---
paths:
  - "src/**"
  - "lib/**"
  - "app/**"
---

# SPECTRA Code Generation Rules

These rules apply when writing or editing source code in a SPECTRA-managed project.

## Trace Comment — Required on Generated Files

Every file generated from a SPECTRA spec MUST include a trace comment on line 1:
```
// @spectra <feat-id>@<semver> impl:<concern> gen:<generation-id>
```

Example:
```typescript
// @spectra feat:user-authentication@1.0.0 impl:transport.rest gen:a1b2c3d4
```

This comment enables the drift detector to link source files back to their authorizing spec.

## Spec Fidelity — Only What's Specified

- Implement ALL acceptance criteria marked `non_negotiable: true`
- Do NOT add features, endpoints, or behaviors not specified in the acceptance criteria
- Do NOT add extra API routes, event handlers, or exported functions without AC coverage

## Constitutional Constraints — Non-Negotiable

Constraints with enforcement `MUST` in `.spectra/constitution.yaml` must be respected:
- **SEC-001**: Never hardcode secrets, credentials, API keys, or tokens in source code
- **SEC-002**: Validate all external inputs at system boundaries
- **ARCH-001**: Each module should have a single responsibility
- **QUAL-001**: Public interfaces must have corresponding acceptance criteria
- **QUAL-002**: Critical paths must have test specifications

## After Writing Code

Always update the traceability matrix:
```
spectra trace update
```
