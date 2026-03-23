---
name: spectra-setup
description: "Initialize a SPECTRA SDD project. Creates .spectra/ directory, constitution, config, and explains the framework."
allowed-tools: Bash, Read, Write
---

# SPECTRA Setup

Initialize and configure a SPECTRA Spec-Driven Development project.

## When to Use

Use this when starting a new project or adding SPECTRA to an existing codebase.

## Steps

1. **Check if already initialized:**
   Run `ls .spectra/` to check. If it exists, run `spectra status` and show the current state instead.

2. **Gather inputs:**
   - Ask the user for a project ID (suggest the directory name as default)
   - Ask if this is a new project or existing codebase (brownfield)

3. **Initialize:**
   ```
   spectra init --project-id <id>
   ```
   Add `--brownfield` if this is an existing codebase.

4. **Show what was created:**
   Run `ls -la .spectra/` and explain each file:
   - `config.yaml` — Project configuration (edit to change enforcement level)
   - `constitution.yaml` — 5 default constraints (SEC-001, SEC-002, ARCH-001, QUAL-001, QUAL-002)
   - `features/_index.yaml` — Spec index (auto-maintained)
   - `trace.json` — Traceability matrix linking specs to code
   - `generate.lock` — Generation determinism lock

5. **Show the constitution:**
   Run `cat .spectra/constitution.yaml` and explain:
   - **MUST** constraints are non-negotiable (errors if violated)
   - **SHOULD** constraints are strongly recommended (warnings)
   - **MAY** constraints are optional guidance
   - Constraints are automatically injected into AI generation context

6. **Explain the SDD workflow:**
   The development lifecycle follows 5 phases in strict order:
   ```
   specify → design → test-design → implement → reconcile
   ```
   Each phase has a gate that must be signed before the next phase can begin.
   Gates are hash-bound — if a spec changes, the gate becomes invalid.

7. **Guide to next step:**
   Tell the user: "Your project is ready. Create your first feature spec with `/spectra-specify <feature-name>`"
