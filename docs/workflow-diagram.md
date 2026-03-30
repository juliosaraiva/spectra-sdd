# SPECTRA Workflow

From feature idea to pull request in 5 gated phases.

```
specify → design → test-design → implement → reconcile
```

Each phase must be approved before the next one begins.

## Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant S as SPECTRA
    participant GH as GitHub

    %% ── Specify ──
    rect rgb(255, 245, 230)
        Note over Dev,GH: 1. Specify — define what to build
        Dev->>S: spectra spec new user-auth
        S-->>Dev: user-auth.spec.md scaffold
        Dev->>Dev: Write acceptance criteria, interfaces, NFRs
        Dev->>S: spectra validate feat:user-auth
        S-->>Dev: Valid
        Dev->>S: spectra gate sign feat:user-auth --phase specify
        S-->>Dev: Specify gate approved
    end

    %% ── Design ──
    rect rgb(230, 255, 230)
        Note over Dev,GH: 2. Design — plan how to build it
        Dev->>S: spectra design feat:user-auth --concerns "transport.rest,persistence.relational"
        S-->>Dev: Impl spec scaffolds created
        Dev->>Dev: Write design details for each concern
        Dev->>S: spectra validate --all --cross-refs
        S-->>Dev: Valid
        Dev->>S: spectra gate sign feat:user-auth --phase design
        S-->>Dev: Design gate approved
    end

    %% ── Test Design ──
    rect rgb(255, 230, 255)
        Note over Dev,GH: 3. Test Design — map tests to acceptance criteria
        Dev->>Dev: Write user-auth.test.yaml (AC-001 to TC-001)
        Dev->>S: spectra validate test:user-auth
        S-->>Dev: Valid
        Dev->>S: spectra gate sign feat:user-auth --phase test-design
        S-->>Dev: Test-design gate approved
    end

    %% ── Implement ──
    rect rgb(230, 245, 255)
        Note over Dev,GH: 4. Implement — write the code
        Dev->>Dev: Write source code + tests
        Dev->>S: spectra diff
        S-->>Dev: No drift detected
        Dev->>S: spectra gate sign feat:user-auth --phase implement
        S-->>Dev: Implement gate approved
    end

    %% ── Reconcile ──
    rect rgb(240, 240, 240)
        Note over Dev,GH: 5. Reconcile — verify everything aligns
        Dev->>S: spectra diff
        S-->>Dev: Drift score: 0.0
        Dev->>S: spectra trace coverage feat:user-auth
        S-->>Dev: 100% AC coverage
        Dev->>S: spectra gate verify feat:user-auth --phase implement
        S-->>Dev: Gate integrity verified
        Dev->>S: spectra gate sign feat:user-auth --phase reconcile
        S-->>Dev: Lifecycle complete
    end

    %% ── Ship ──
    rect rgb(220, 245, 220)
        Note over Dev,GH: Ship it
        Dev->>S: spectra status feat:user-auth
        S-->>Dev: All 5 gates approved
        Dev->>GH: git push + open pull request
        GH-->>Dev: PR ready for review
    end
```

## What each phase does

| Phase | Goal | Key command |
|-------|------|-------------|
| **Specify** | Define acceptance criteria, interfaces, and NFRs | `spectra spec new <name>` |
| **Design** | Break the feature into implementation concerns | `spectra design <id> --concerns "..."` |
| **Test Design** | Map each acceptance criterion to a test case | `spectra validate test:<name>` |
| **Implement** | Write the code, check for drift | `spectra diff` |
| **Reconcile** | Verify full coverage and no drift | `spectra trace coverage <id>` |
