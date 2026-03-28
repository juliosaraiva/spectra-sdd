# Phase 06: Reconcile

Reconcile is the closing phase. It does not produce new code — it confirms that what was built matches what was specified. A signed `reconcile` gate is the audit record that the full spec-driven loop was completed faithfully: the spec was written, designed, test-planned, implemented, and verified — with a content hash tying each gate to the exact spec revision that was in effect when the gate was signed.

---

## Prerequisites

- Phase 05 complete (`implement` gate approved for `feat:user-authentication`)
- Drift score is 0.00 (confirmed in Phase 05)

---

## Step 1 — Check the prerequisite gate

```bash
spectra gate check feat:user-authentication --phase reconcile
```

Expected output:

```
✔ feat:user-authentication — reconcile phase prerequisites met
  specify:     approved ✔
  design:      approved ✔
  test-design: approved ✔
  implement:   approved ✔
```

All four prior phases must be approved before this gate can be signed.

---

## Step 2 — Final drift report

```bash
spectra diff
```

Expected output:

```
feat:user-authentication@1.0.0
  transport.rest         → src/routes/auth.ts         drift: 0.00 ✔
  persistence.relational → src/db/auth.ts             drift: 0.00 ✔
  auth.middleware        → src/middleware/auth.ts      drift: 0.00 ✔

Overall drift score: 0.00
```

A non-zero drift score here means either the code changed after the `implement` gate was signed, or the trace.json was not updated to reflect a late code edit. Investigate with `spectra diff --verbose` to see which structural elements are diverging, fix them, and re-sign the `implement` gate before proceeding.

---

## Step 3 — Check AC coverage

```bash
spectra trace coverage feat:user-authentication
```

Expected output:

```
feat:user-authentication@1.0.0 — AC coverage

  AC-001  Successful login                 ✔ covered  TC-001
  AC-002  Invalid password rejected        ✔ covered  TC-002
  AC-003  Unknown email rejected           ✔ covered  TC-003
  AC-004  Rate limiting after 5 failures   ✔ covered  TC-004

Coverage: 4/4 ACs covered (100%)
Non-negotiable: 3/3 covered ✔
```

> **Note:** This is **spec-level coverage** — it shows which ACs have corresponding test cases in the test spec. It does not show runtime code coverage (line coverage, branch coverage). To see runtime results, run your actual test suite (`npm test`) separately. SPECTRA's coverage report answers "did we plan a test for every AC?" not "did all tests pass?".

---

## Step 4 — Full forward trace

```bash
spectra trace forward feat:user-authentication
```

```
feat:user-authentication@1.0.0
  ├── design
  │   ├── impl:user-authentication.transport-rest        → .spectra/impl/user-authentication/transport-rest.impl.md
  │   ├── impl:user-authentication.persistence-relational → .spectra/impl/user-authentication/persistence-relational.impl.md
  │   └── impl:user-authentication.auth-middleware        → .spectra/impl/user-authentication/auth-middleware.impl.md
  ├── test-design
  │   └── test:user-authentication                        → .spectra/tests/user-authentication.test.yaml
  └── implement
      ├── transport.rest         → src/routes/auth.ts
      ├── persistence.relational → src/db/auth.ts
      └── auth.middleware        → src/middleware/auth.ts
```

This is the complete traceability chain from spec to code. Every artifact is traceable back to the spec that authorized it.

---

## Step 5 — Verify gate integrity

```bash
spectra gate verify feat:user-authentication --phase implement
```

Expected output:

```
✔ feat:user-authentication@1.0.0 — implement gate valid
  Gate hash:  sha256:a3f9...
  Spec hash:  sha256:a3f9...  (match ✔)
  Signed at:  2026-03-28T12:30:00Z
  Signed by:  @you
```

`gate verify` is different from `gate check`:

| Command | Question it answers |
|---------|-------------------|
| `spectra gate check --phase X` | "Are all prior phases approved? Can I proceed to phase X?" |
| `spectra gate verify --phase X` | "Has the spec changed since phase X was signed? Is the gate still valid?" |

If `gate verify` reports a hash mismatch, the spec was edited after the gate was signed. You must rehash the spec, fix any issues, and re-sign the affected gates before reconcile can proceed.

---

## Step 6 — Sign the reconcile gate

```bash
spectra gate sign feat:user-authentication \
  --phase reconcile \
  --signer "@you" \
  --comment "Drift score 0.00, all 5 gates valid, 4/4 ACs covered, full forward trace verified"
```

Expected output:

```
✔ Gate signed: .spectra/gates/feat_user-authentication@1.0.0--reconcile.gate.yaml
✔ trace.json updated
```

---

## Step 7 — Final verification

```bash
spectra status feat:user-authentication
```

```
feat:user-authentication@1.0.0 — active
  specify     ✔ approved  @you  2026-03-28T09:10:00Z
  design      ✔ approved  @you  2026-03-28T10:15:00Z
  test-design ✔ approved  @you  2026-03-28T11:05:00Z
  implement   ✔ approved  @you  2026-03-28T12:30:00Z
  reconcile   ✔ approved  @you  2026-03-28T13:00:00Z

ACs: 4 (3 non-negotiable) — all covered
Drift score: 0.00
Hash: sha256:a3f9...  (valid across all gates)
```

```bash
spectra gate list feat:user-authentication
```

```
feat:user-authentication@1.0.0
  specify     ✔ approved  @you  "User auth spec reviewed and approved"
  design      ✔ approved  @you  "3 concerns designed: transport, persistence, auth"
  test-design ✔ approved  @you  "4 test cases mapped 1:1 to 4 ACs"
  implement   ✔ approved  @you  "3 source files with trace comments, drift score 0.00"
  reconcile   ✔ approved  @you  "Drift score 0.00, all 5 gates valid, full coverage"
```

All five phases show `approved`. The spec-driven loop is closed.

---

## What just happened

You completed the full SPECTRA lifecycle for a production-grade authentication feature:

1. **Specified** — captured 4 ACs in machine-readable `.spec.md` format with constitution constraints attached to each criterion. The content hash locked the spec's identity.

2. **Designed** — decomposed the feature into 3 concern-scoped impl specs (`transport.rest`, `persistence.relational`, `auth.middleware`). Each impl spec bound itself to the feature spec via `feature_ref`.

3. **Test-designed** — wrote 4 test cases in a `.test.yaml` spec, each mapped 1:1 to an AC via `ac_ref`. This created a verifiable coverage map before a line of code was written.

4. **Implemented** — created 3 source files. Line 1 of each file carries a `@spectra` trace comment that links the file to its authorizing spec and concern. The traceability matrix (`trace.json`) records the authorized artifacts.

5. **Reconciled** — ran drift detection (score 0.00), verified coverage (4/4 ACs), verified gate integrity (hashes match), and signed the final gate as confirmation that the feature was built as specified.

### What this gives you

| Capability | Enabled by |
|------------|-----------|
| **Audit trail** | Gate files record who approved what, when, and against which spec hash |
| **Change detection** | Editing the spec invalidates all signed gates — you cannot silently change requirements |
| **Forward traceability** | `spectra trace forward` shows every artifact that implements a spec |
| **Reverse traceability** | `spectra trace why <file>` shows which spec authorized any source file |
| **Drift detection** | `spectra diff` catches code that diverges from its authorizing impl spec |
| **Constitutional enforcement** | Constraints from `constitution.yaml` are injected into AI generation prompts |

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 7 |
| **Commands run** | `spectra gate check`, `spectra diff`, `spectra trace coverage`, `spectra trace forward`, `spectra gate verify`, `spectra gate sign`, `spectra status`, `spectra gate list` |
| **Files created** | `feat_user-authentication@1.0.0--reconcile.gate.yaml` only |
| **Concepts required** | `gate verify` vs `gate check`, spec coverage vs runtime coverage, content hash integrity |
| **New conventions** | Reconcile as "closed loop" confirmation |

---

## What's next

- **Add another feature:** Run `spectra spec new <name>` and repeat the cycle.
- **Handle drift:** If production code diverges from specs over time, `spectra diff` will show it. Update the impl spec, rehash the feature spec, and re-sign affected gates.
- **Enable AI generation:** Set `ai.adapter: claude-code` in `.spectra/config.yaml` and configure the Claude Code integration to automate trace comments and trace.json updates.
- **CI integration:** Add `spectra diff` and `spectra gate check --phase reconcile` to your CI pipeline to block merges on unreconciled features.
