# Phase 01: Configure

This phase sets up SPECTRA in the `taskflow-api` starter project. By the end you will have a fully initialized `.spectra/` directory, a project config, and a default constitution enforcing five project-wide constraints.

---

## Prerequisites

- Node.js ≥ 20
- `spectra` installed globally (`npm install -g @spectra-sdd/cli` or built from source)

---

## Step 1 — Copy the starter project

```bash
cp -r examples/walkthrough/starter ~/taskflow-api
cd ~/taskflow-api
npm install
```

This gives you a minimal Express API with TypeScript — no SPECTRA files yet.

---

## Step 2 — Initialize SPECTRA

```bash
spectra init --project-id taskflow-api
```

Expected output:

```
✔ Created .spectra/config.yaml
✔ Created .spectra/constitution.yaml
✔ Created .spectra/trace.json
✔ Created .spectra/features/_index.yaml
✔ Initialized project: taskflow-api
```

> **Note:** The `--project-id` flag sets the identifier recorded in `config.yaml`. Use a slug matching your repository name — it will appear in gate files and the traceability matrix.

---

## Step 3 — Inspect the `.spectra/` directory

```bash
ls .spectra/
```

```
config.yaml
constitution.yaml
features/
gates/
impl/
tests/
templates/
trace.json
```

| Directory/File | Purpose |
|----------------|---------|
| `config.yaml` | Project-level SPECTRA settings |
| `constitution.yaml` | Project-wide invariants (constraints) |
| `features/` | Feature specs (`.spec.md`) and `_index.yaml` |
| `gates/` | Signed gate files (one per spec per phase) |
| `impl/` | Implementation specs (`.impl.md`), organized by feature |
| `tests/` | Test specs (`.test.yaml`) |
| `templates/` | Project-local Handlebars templates (override bundled defaults) |
| `trace.json` | Denormalized traceability matrix (dual-written on gate sign) |

---

## Step 4 — View the config

```bash
cat .spectra/config.yaml
```

```yaml
spectra:
  version: "1.0"
  project_id: taskflow-api

ai:
  adapter: none
  primary_agent: none

spec:
  id_prefix: feat
  default_status: draft

git:
  gate_branch_protection: false
  trace_commit_hook: false
```

The `ai.adapter` field is where you would wire a Claude Code or Codex integration. For this walkthrough it stays `none` — all steps are manual.

---

## Step 5 — View the constitution

```bash
cat .spectra/constitution.yaml
```

The default constitution ships with five constraints that cover the most common failure modes in real projects:

| ID | Title | Enforcement | Domain |
|----|-------|-------------|--------|
| `SEC-001` | No secrets in source code | MUST | security |
| `SEC-002` | Validate all external inputs | MUST | security, api, transport |
| `ARCH-001` | Single responsibility per module | SHOULD | architecture, transport, persistence |
| `QUAL-001` | Acceptance criteria for public interfaces | MUST | api, transport |
| `QUAL-002` | Critical paths must be tested | MUST | security, identity, persistence |

Each constraint has three enforcement levels:

- **MUST** — Blocking. Code or specs that violate these will fail lint.
- **SHOULD** — Advisory. Violations are flagged as warnings.
- **MAY** — Informational only.

When SPECTRA generates code, it scores each spec's domain tags against these constraints and injects the top-5 most relevant ones as `constitutional_context` into the generation prompt. This is the mechanism that makes AI-generated code respect your project invariants.

---

## Step 6 — Check status

```bash
spectra status
```

```
Project: taskflow-api
Constitution: ✔ 5 constraints (1.0.0)

No feature specs found. Run `spectra spec new <feature-name>` to create one.
```

No specs yet — that comes in Phase 02.

---

## Scorecard

| Metric | Value |
|--------|-------|
| **Steps** | 5 |
| **Commands run** | `npm install`, `spectra init`, `spectra status` |
| **Files created** | `.spectra/config.yaml`, `.spectra/constitution.yaml`, `.spectra/trace.json`, `.spectra/features/_index.yaml` |
| **Concepts required** | Project root, CLI initialization, `.spectra/` directory layout |
| **New conventions** | Constitution as project-wide constraint system |

---

## Next

Proceed to **[Phase 02: Specify](../02-specify/guide.md)** to write the first feature spec.
