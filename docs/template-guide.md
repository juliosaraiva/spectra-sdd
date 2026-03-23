# Template Guide

SPECTRA uses [Handlebars](https://handlebarsjs.com/) templates to generate AI prompts for code and test generation.

## Built-in Templates

| Template ID | File | Purpose |
|-------------|------|---------|
| `feature-to-tests` | `templates/feature-to-tests.tmpl` | Generate test spec YAML from feature acceptance criteria |
| `impl-to-code` | `templates/impl-to-code.tmpl` | Generate implementation source code from impl specs |

## Template Resolution

When loading a template by ID, SPECTRA checks two locations in order:

1. **Project-local:** `.spectra/templates/<templateId>.tmpl`
2. **Built-in:** `<package-root>/templates/<templateId>.tmpl`

Project-local templates take priority, allowing you to override built-in templates.

## Context Variables

Templates receive these variables when rendered:

| Variable | Type | Description |
|----------|------|-------------|
| `spec` | object | The parsed feature spec (full object) |
| `spec_yaml` | string | The feature spec as raw YAML |
| `spec_canonical_yaml` | string | Canonical JSON of the spec (deterministic) |
| `constitutional_context` | string | Selected constraint summaries (3-5 most relevant) |
| `spec_id` | string | Spec ID (e.g., `feat:user-authentication`) |
| `spec_version` | string | Spec semver (e.g., `2.1.0`) |
| `target` | string | Target concern namespace (e.g., `transport.rest`) |

## Custom Handlebars Helpers

SPECTRA registers 4 custom helpers:

### `{{canonical_yaml obj}}`

Returns the canonical JSON string of an object (keys sorted, deterministic).

```handlebars
Input spec (canonical):
{{canonical_yaml spec}}
```

### `{{to_yaml obj}}`

Returns YAML serialization of an object (line width: 120).

```handlebars
Feature specification:
{{to_yaml spec.identity}}
```

### `{{json obj}}`

Returns pretty-printed JSON (2-space indent).

```handlebars
Acceptance criteria:
{{json spec.acceptance_criteria}}
```

### `{{ac_to_testcase ac}}`

Transforms an AC object's ID from `AC-NNN` to `TC-NNN`.

```handlebars
{{#each spec.acceptance_criteria}}
Test case {{ac_to_testcase this}} validates {{this.id}}
{{/each}}
```

## Writing Custom Templates

### 1. Create the template file

```bash
mkdir -p .spectra/templates
```

Create `.spectra/templates/my-template.tmpl`:

```handlebars
You are generating code for {{spec.identity.title}}.

## Constitutional Constraints
{{constitutional_context}}

## Feature Specification
{{spec_yaml}}

## Target
Concern: {{target}}

## Requirements
{{#each spec.acceptance_criteria}}
### {{this.id}}: {{this.title}}
Given: {{this.given}}
When: {{this.when}}
Then:
{{#each this.then}}
- {{this}}
{{/each}}
{{#if this.non_negotiable}}(NON-NEGOTIABLE){{/if}}
{{/each}}

## Output Format
Generate valid TypeScript source code.
First line must be: // @spectra {{spec_id}}@{{spec_version}} impl:{{target}} gen:[generation_id]
```

### 2. Use the template

The template ID is the filename without the `.tmpl` extension. When SPECTRA's generation engine is invoked with `templateId: "my-template"`, it will find your project-local template first.

### 3. List available templates

```bash
ls .spectra/templates/
```

Or programmatically via `listTemplates(projectRoot)`.

## How Generation Works

1. Load the feature spec and compute its content hash
2. Load the template by ID (project-local first, then built-in)
3. Check the **generation lock** -- skip if same input + template hash already locked
4. Load the constitution and select the 3-5 most relevant constraints for the spec's domain tags
5. Render the Handlebars template with spec data + constitutional context
6. Compute output hash, write to `generate.lock`
7. Return the rendered prompt

## Constitutional Constraint Injection

The `constitutional_context` variable contains a formatted summary of the selected constraints. The selection algorithm:

1. Score each constraint by domain tag overlap with the feature's `identity.domain`
2. Add enforcement boost: MUST = +2, SHOULD = +1, MAY = +0
3. Filter to score > 0, sort descending, take top 5

This ensures generated code respects the project's most relevant constraints.
