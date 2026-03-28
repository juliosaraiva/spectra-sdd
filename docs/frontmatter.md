# Frontmatter System

SPECTRA uses a Markdown+Frontmatter format for feature specs (`.spec.md`) and implementation specs (`.impl.md`). This format enables **dual consumption**: structured YAML metadata for code pipelines (validator, hasher, gates, index builder) and prose Markdown for LLM templates and human reading.

Gates, constitution, test specs, migration specs, and config files remain pure YAML.

---

## Why Frontmatter?

Traditional YAML-only specs forced acceptance criteria into deeply nested structures that were awkward for both humans and LLMs to read. The frontmatter format separates concerns:

- **YAML frontmatter** holds machine-parseable metadata: `spectra` header, `identity`, `interfaces`, `non_functional`, `dependencies`, and `hash`
- **Markdown body** holds human-readable content: acceptance criteria as `## AC-NNN: Title` headings with `**Given**`/`**When**`/`**Then**` prose

The generator passes the **raw file content** to LLM templates, so the model receives native Markdown -- not serialized YAML objects.

---

## File Format

A frontmatter file has two sections separated by `---` delimiters. Below is a shortened excerpt showing the structure — see the full fields in `SpectraMetaSchema` (at minimum `type`, `id`, `semver`, `status`, `created`, `updated`, and `authors` are required; `version` defaults to `"1.0"` and `reviewers` defaults to `[]` if omitted):

```markdown
---
spectra:
  version: "1.0"
  type: feature
  id: "feat:user-authentication"
  semver: "2.1.0"
  status: active
  created: "2024-01-01"
  updated: "2024-06-15"
  authors: [alice]
  constitution_ref: "const:v1.0"

identity:
  title: "User Authentication"
  domain: [identity, security, api]
  tags: [login, session, credentials]
  summary: "Authenticate users via email/password and issue session tokens"

interfaces:
  inputs:
    - name: credentials
      schema:
        email: Email
        password: string[8..128]
  outputs:
    - name: session
      schema:
        token: JWT
        expires_at: ISO8601
        user_id: UUID
---

# User Authentication

Authenticate users via email/password and issue session tokens

## AC-001: Successful authentication

> non_negotiable: true | constitution_constraints: [SEC-001]

**Given** A registered user with valid credentials
**When** The user submits correct email and password
**Then:**
- System returns a valid JWT session token
- Token expires within configured TTL
- Event identity.user.authenticated is emitted

## AC-002: Failed authentication

> non_negotiable: true

**Given** Any authentication attempt with invalid credentials
**When** The user submits incorrect email or password
**Then:**
- System returns a 401 error
- Error message does not reveal which field was incorrect
```

---

## Splitting: The Frontmatter Regex

The core regex that splits every frontmatter file:

```
/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/
```

| Segment | Purpose |
|---------|---------|
| `^---\r?\n` | Opening delimiter -- file must start with `---` |
| `([\s\S]*?)` | Capture group 1: YAML content (lazy match) |
| `\r?\n---` | Closing delimiter |
| `\r?\n?` | Optional newline after closing `---` |
| `([\s\S]*)$` | Capture group 2: Markdown body (may be empty) |

**Design details:**

- **Lazy match** (`*?`) ensures the *first* `\n---` closes the frontmatter block, not the last. This prevents YAML document separators inside the body from being misinterpreted.
- **CRLF tolerance** (`\r?\n`) throughout -- files with Windows line endings parse correctly.
- **Optional trailing newline** after the closing `---` -- files that end immediately after the closing delimiter (no body) parse cleanly. Earlier versions required a trailing newline; the regex was updated to make it optional.

`parseFrontmatter()` returns `{ meta, body }` where `meta` is the parsed YAML object and `body` is the raw Markdown string.

---

## Acceptance Criteria Parser

The AC parser is a line-by-line state machine driven by seven regexes:

| Regex | Pattern | Matches |
|-------|---------|---------|
| `AC_HEADING` | `^##\s+(AC-\d{3}):\s*(.+)$` | `## AC-001: Title` |
| `GIVEN` | `^\*\*Given\*\*\s+(.+)$` | `**Given** text` |
| `WHEN` | `^\*\*When\*\*\s+(.+)$` | `**When** text` |
| `THEN` (block) | `^\*\*Then:\*\*\s*$` | `**Then:**` (items follow as list) |
| `THEN` (inline) | `^\*\*Then\*\*\s+(.+)$` | `**Then** single outcome` |
| `LIST_ITEM` | `^-\s+(.+)$` | `- outcome text` |
| `BLOCKQUOTE` | `^>\s*(.+)$` | `> metadata line` |

### State Machine Behavior

1. An `AC_HEADING` line flushes the previous AC (if complete) and starts a new one
2. `BLOCKQUOTE` lines parse metadata: `non_negotiable` and `constitution_constraints`
3. `GIVEN` and `WHEN` set their respective fields and stop any active Then-collection
4. `THEN` (block form) starts collecting subsequent `LIST_ITEM` lines
5. `THEN` (inline form) captures the single outcome and also starts list collection
6. Empty lines between Then items are tolerated -- collection continues
7. A non-empty, non-list line after Then items stops collection

### Flush Validation

An AC is only emitted to the result array if it has all required fields: `id`, `title`, `given`, `when`, and at least one `then` item. Incomplete ACs are silently dropped.

### Metadata Line Format

The blockquote metadata line uses pipe-separated key-value pairs:

```markdown
> non_negotiable: true | constitution_constraints: [SEC-001, SEC-002]
```

- `non_negotiable` accepts `true` or `false` (defaults to `false` if absent)
- `constitution_constraints` accepts both bracketed (`[SEC-001, SEC-002]`) and unbracketed (`SEC-001, SEC-002`) lists
- The `constitution_constraints` part is omitted entirely when the AC has no constraints

---

## Feature Spec Parsing

`parseFeatureSpecMd(raw)` performs two steps:

1. `parseFrontmatter(raw)` → splits into `{ meta, body }`
2. `parseMarkdownACs(body)` → parses Markdown body into `AcceptanceCriterion[]`

Returns `{ ...meta, acceptance_criteria }` -- the AC array is merged into the metadata object.

**Critical rule:** `acceptance_criteria` is **never stored in the YAML frontmatter**. It always lives in the Markdown body and is parsed at read-time. If the YAML frontmatter contained an `acceptance_criteria` key, it would be overwritten by the parsed body content.

---

## Implementation Spec Parsing

`parseImplSpecMd(raw)` is simpler:

1. `parseFrontmatter(raw)` → splits into `{ meta, body }`
2. Returns `{ ...meta, design: { description: body.trim() || "TODO" } }`

The entire Markdown body becomes a single `design.description` string. Empty bodies default to `"TODO"`. The `ImplSpecSchema.design` field is `z.record(z.unknown())`, so `{ description: string }` satisfies validation.

### Impl Spec Example

```markdown
---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-auth-rest"
  semver: "1.0.0"
  status: active
  created: "2024-01-01"
  updated: "2024-06-15"
  authors: [alice]
  feature_ref: "feat:user-authentication@2.1.0"
  concern: transport.rest
---

# transport.rest

POST /auth/sessions endpoint implementation.

## Request Handling

Validate email format and password length (8-128 chars) from JSON body.
Apply rate-limiter and request-logger middleware.

## Response Format

Success: 201 with JWT token, expiry, and user_id.
Errors: 401 INVALID_CREDENTIALS, 429 RATE_LIMITED with Retry-After header.
```

---

## Serialization

### Feature Spec Serialization

`serializeFeatureSpec(spec)` produces a canonical output:

**Frontmatter key order** (explicit, not alphabetical):

1. `spectra`
2. `identity`
3. `interfaces` (if present)
4. `non_functional` (if present)
5. `dependencies` (if present)
6. `hash` (if present)

**Body structure:**

```markdown
# {identity.title}

{identity.summary}

## AC-001: Title

> non_negotiable: true | constitution_constraints: [SEC-001]

**Given** given text
**When** when text
**Then:**
- outcome 1
- outcome 2
```

YAML is stringified with `lineWidth: 120` to prevent unnecessary line wrapping.

### Implementation Spec Serialization

`serializeImplSpec(impl, designBody?)` puts only the `spectra` block in YAML frontmatter. The body comes from one of three sources (in priority order):

1. The `designBody` parameter, if it is a non-empty string
2. `impl.design.description` if it is a string
3. The full `impl.design` object rendered as a YAML code block

---

## Round-Trip Integrity

The most critical invariant in the system:

```
contentHash(spec) === contentHash(parseFeatureSpecMd(serializeFeatureSpec(spec)))
```

Content hashes are computed over the **parsed object** (not raw file bytes), with the `hash` field excluded. As long as serialize → parse produces the same structured data, gate signatures remain valid across file edits.

This is verified in the test suite (`frontmatter.test.ts`, lines 382-451).

### The `spec rehash` Pattern

When only the hash needs updating (no body changes), `spec rehash` uses a targeted approach:

```typescript
const { meta, body } = parseFrontmatter(rawContent);
meta.hash = parsed.hash;
const updatedFrontmatter = yamlStringify(meta, { lineWidth: 120 }).trimEnd();
await writeFile(specPath, `---\n${updatedFrontmatter}\n---\n\n${body}`);
```

This preserves the Markdown body verbatim -- no re-parsing or re-serialization of ACs.

---

## Format Resolution

The spec reader supports both formats simultaneously. `resolveSpecFile()` checks file existence in priority order:

| Priority | Extension | Format |
|----------|-----------|--------|
| 1 | `.spec.md` / `.impl.md` | Markdown+Frontmatter |
| 2 | `.spec.yaml` / `.impl.yaml` | Plain YAML |
| 3 | `.spec.yml` / `.impl.yml` | Plain YAML |

`parseSpecContent()` dispatches by extension:

- `.spec.md` → `parseFeatureSpecMd()`
- `.impl.md` → `parseImplSpecMd()`
- Everything else → `yaml.parse()` (plain YAML)

All downstream consumers (validator, linter, gate, generator, index builder) go through `spec-reader.ts` and never need to know the file format.

---

## Pipeline Integration

| Pipeline Stage | What It Reads | How Frontmatter Is Used |
|----------------|---------------|------------------------|
| `spectra spec new` | -- | `serializeFeatureSpec()` writes `.spec.md` |
| `spectra design` | -- | `serializeImplSpec()` writes `.impl.md` |
| `spectra spec rehash` | `.spec.md` | `parseFrontmatter()` → update hash → rewrite with body preserved |
| `spectra validate` | `.spec.md`, `.impl.md`, `.spec.yaml`, `.impl.yaml`, `.spec.yml`, `.impl.yml` | `parseSpecContent()` → Zod schema validation |
| `spectra lint` | `.spec.md`, `.spec.yaml`, `.spec.yml` | `readSpecFile()` → quality rule checks on parsed ACs |
| `spectra gate sign/verify` | `.spec.md`, `.spec.yaml`, `.spec.yml` | `readSpecFile()` → hash computation for gate binding |
| `spectra generate` | `.spec.md`, `.impl.md`, `.spec.yaml`, `.impl.yaml`, `.spec.yml`, `.impl.yml` | Raw file content passed to LLM templates; parsed spec used for lock |
| Index builder | `.spec.md`, `.impl.md`, `.spec.yaml`, `.impl.yaml`, `.spec.yml`, `.impl.yml` | `readSpecFile()` → extract metadata for `_index.yaml` |
| Cross-ref validator | `.spec.md`, `.impl.md`, `.spec.yaml`, `.impl.yaml`, `.spec.yml`, `.impl.yml` | `parseSpecContent()` → verify `feature_ref` links |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Missing `---` delimiters | `parseFrontmatter()` throws `"File does not contain valid YAML frontmatter (expected --- delimiters)"` |
| Invalid YAML in frontmatter | YAML parser throws; error propagates to caller |
| Empty body after `---` | Body is empty string; `parseMarkdownACs()` returns `[]` |
| Windows line endings (`\r\n`) | Handled by regex -- CRLF-tolerant throughout |
| No trailing newline after closing `---` | Parsed cleanly (body is empty string) |
| Non-AC `##` headings in body | Silently ignored -- only `## AC-\d{3}: ...` triggers the parser |
| AC missing required fields | Silently dropped by flush validation |
| `acceptance_criteria` key in YAML frontmatter | Overwritten by parsed body content |
| `constitution_constraints` without brackets | Parsed correctly -- brackets are optional |
| Blank lines between Then list items | Tolerated -- collection continues |
