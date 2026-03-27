import { describe, it, expect } from "vitest";
import {
  parseFrontmatter,
  parseMarkdownACs,
  parseFeatureSpecMd,
  parseImplSpecMd,
  serializeFeatureSpec,
  serializeImplSpec,
} from "../../src/core/frontmatter.js";
import { contentHash } from "../../src/core/hash.js";
import { FeatureSpecSchema, ImplSpecSchema } from "../../src/core/spec-types.js";
import type { FeatureSpec, ImplSpec } from "../../src/core/spec-types.js";

// ─── Test Fixtures ──────────────────────────────────────────────────────────

const SAMPLE_FEATURE_MD = `---
spectra:
  version: "1.0"
  type: feature
  id: "feat:user-auth"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors:
    - "@julio"
  reviewers: []
identity:
  title: User Authentication
  domain:
    - identity
    - security
  tags:
    - auth
  summary: Users can authenticate via email/password
interfaces:
  inputs:
    - name: credentials
      schema:
        email: string
        password: string
  outputs:
    - name: session
      schema:
        token: string
  events_emitted: []
  events_consumed: []
non_functional:
  performance:
    - "p99 latency < 200ms"
  security: []
  observability: []
  scalability: []
dependencies:
  feature_refs: []
  schema_refs: []
---

# User Authentication

Users can authenticate via email/password

## AC-001: Successful Login

> non_negotiable: true

**Given** a registered user with valid credentials
**When** the user submits email and password
**Then:**
- A JWT token is returned
- The token expires in 24 hours

## AC-002: Failed Login

> non_negotiable: false | constitution_constraints: [SEC-002]

**Given** a user with incorrect password
**When** the user attempts to login
**Then:**
- HTTP 401 is returned
- Error does not reveal which field is wrong
`;

const SAMPLE_IMPL_MD = `---
spectra:
  version: "1.0"
  type: impl
  id: "impl:user-auth-transport-rest"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors:
    - "@julio"
  reviewers: []
  feature_ref: "feat:user-auth@1.0.0"
  concern: transport.rest
---

# REST Transport for User Auth

## Endpoint

\`POST /auth/sessions\`

## Response

**201 Created** — returns session token
`;

// ─── parseFrontmatter ───────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("splits frontmatter and body correctly", () => {
    const { meta, body } = parseFrontmatter(SAMPLE_FEATURE_MD);
    expect(meta.spectra).toBeDefined();
    expect((meta.spectra as Record<string, unknown>).type).toBe("feature");
    expect(body).toContain("## AC-001: Successful Login");
  });

  it("throws on missing frontmatter delimiters", () => {
    expect(() => parseFrontmatter("no frontmatter here")).toThrow("YAML frontmatter");
  });

  it("throws on invalid YAML in frontmatter", () => {
    expect(() => parseFrontmatter("---\n: invalid: yaml: [[\n---\nbody")).toThrow();
  });

  it("handles empty body", () => {
    const { meta, body } = parseFrontmatter("---\nkey: value\n---\n");
    expect(meta.key).toBe("value");
    expect(body).toBe("");
  });

  it("handles Windows line endings", () => {
    const { meta, body } = parseFrontmatter("---\r\nkey: value\r\n---\r\nbody text");
    expect(meta.key).toBe("value");
    expect(body).toBe("body text");
  });

  it("handles file ending immediately after closing delimiter (no trailing newline)", () => {
    const { meta, body } = parseFrontmatter("---\nkey: value\n---");
    expect(meta.key).toBe("value");
    expect(body).toBe("");
  });
});

// ─── parseMarkdownACs ───────────────────────────────────────────────────────

describe("parseMarkdownACs", () => {
  const body = `
# User Auth

Some intro text

## AC-001: Successful Login

> non_negotiable: true

**Given** a registered user with valid credentials
**When** the user submits email and password
**Then:**
- A JWT token is returned
- The token expires in 24 hours

## AC-002: Failed Login

> non_negotiable: false | constitution_constraints: [SEC-002, SEC-003]

**Given** a user with incorrect password
**When** the user attempts to login
**Then:**
- HTTP 401 is returned
- Error message is generic
`;

  it("parses multiple ACs", () => {
    const acs = parseMarkdownACs(body);
    expect(acs).toHaveLength(2);
  });

  it("extracts AC ID and title", () => {
    const acs = parseMarkdownACs(body);
    expect(acs[0].id).toBe("AC-001");
    expect(acs[0].title).toBe("Successful Login");
    expect(acs[1].id).toBe("AC-002");
    expect(acs[1].title).toBe("Failed Login");
  });

  it("extracts Given/When/Then", () => {
    const acs = parseMarkdownACs(body);
    expect(acs[0].given).toBe("a registered user with valid credentials");
    expect(acs[0].when).toBe("the user submits email and password");
    expect(acs[0].then).toEqual(["A JWT token is returned", "The token expires in 24 hours"]);
  });

  it("extracts non_negotiable flag", () => {
    const acs = parseMarkdownACs(body);
    expect(acs[0].non_negotiable).toBe(true);
    expect(acs[1].non_negotiable).toBe(false);
  });

  it("extracts constitution_constraints", () => {
    const acs = parseMarkdownACs(body);
    expect(acs[0].constitution_constraints).toBeUndefined();
    expect(acs[1].constitution_constraints).toEqual(["SEC-002", "SEC-003"]);
  });

  it("handles empty body", () => {
    const acs = parseMarkdownACs("");
    expect(acs).toHaveLength(0);
  });

  it("ignores non-AC headings", () => {
    const body =
      "## Some Random Heading\n\nParagraph\n\n## AC-001: Real AC\n\n> non_negotiable: true\n\n**Given** ctx\n**When** action\n**Then:**\n- result\n";
    const acs = parseMarkdownACs(body);
    expect(acs).toHaveLength(1);
    expect(acs[0].id).toBe("AC-001");
  });
});

// ─── parseFeatureSpecMd ─────────────────────────────────────────────────────

describe("parseFeatureSpecMd", () => {
  it("produces a valid FeatureSpec object", () => {
    const parsed = parseFeatureSpecMd(SAMPLE_FEATURE_MD);
    const result = FeatureSpecSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("merges frontmatter and ACs correctly", () => {
    const parsed = parseFeatureSpecMd(SAMPLE_FEATURE_MD);
    expect((parsed.spectra as Record<string, unknown>).id).toBe("feat:user-auth");
    expect(parsed.acceptance_criteria as Array<Record<string, unknown>>).toHaveLength(2);
  });

  it("preserves all frontmatter fields", () => {
    const parsed = parseFeatureSpecMd(SAMPLE_FEATURE_MD);
    const identity = parsed.identity as Record<string, unknown>;
    expect(identity.title).toBe("User Authentication");
    expect(identity.domain).toEqual(["identity", "security"]);
    expect(identity.summary).toBe("Users can authenticate via email/password");
  });
});

// ─── parseImplSpecMd ────────────────────────────────────────────────────────

describe("parseImplSpecMd", () => {
  it("produces a valid ImplSpec object", () => {
    const parsed = parseImplSpecMd(SAMPLE_IMPL_MD);
    const result = ImplSpecSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("stores body as design.description", () => {
    const parsed = parseImplSpecMd(SAMPLE_IMPL_MD);
    const design = parsed.design as Record<string, unknown>;
    expect(design.description).toContain("REST Transport for User Auth");
    expect(design.description).toContain("POST /auth/sessions");
  });
});

// ─── serializeFeatureSpec ───────────────────────────────────────────────────

describe("serializeFeatureSpec", () => {
  const spec: FeatureSpec = {
    spectra: {
      version: "1.0",
      type: "feature",
      id: "feat:test",
      semver: "1.0.0",
      status: "draft",
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
      authors: ["@user"],
      reviewers: [],
    },
    identity: {
      title: "Test Feature",
      domain: ["general"],
      tags: [],
      summary: "A test feature",
    },
    acceptance_criteria: [
      {
        id: "AC-001",
        title: "Basic test",
        given: "a context",
        when: "an action",
        then: ["a result"],
        non_negotiable: true,
      },
    ],
  };

  it("produces valid Markdown with frontmatter", () => {
    const md = serializeFeatureSpec(spec);
    expect(md).toContain("---");
    expect(md).toContain("## AC-001: Basic test");
    expect(md).toContain("**Given** a context");
    expect(md).toContain("**When** an action");
    expect(md).toContain("- a result");
  });

  it("includes non_negotiable metadata in blockquote", () => {
    const md = serializeFeatureSpec(spec);
    expect(md).toContain("> non_negotiable: true");
  });

  it("round-trips through parse and produces valid schema", () => {
    const md = serializeFeatureSpec(spec);
    const parsed = parseFeatureSpecMd(md);
    const result = FeatureSpecSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("includes constitution_constraints when present", () => {
    const specWithConstraints = {
      ...spec,
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Constrained AC",
          given: "a context",
          when: "an action",
          then: ["a result"],
          non_negotiable: false,
          constitution_constraints: ["SEC-001", "SEC-002"],
        },
      ],
    };
    const md = serializeFeatureSpec(specWithConstraints);
    expect(md).toContain("constitution_constraints: [SEC-001, SEC-002]");
  });
});

// ─── serializeImplSpec ──────────────────────────────────────────────────────

describe("serializeImplSpec", () => {
  const impl: ImplSpec = {
    spectra: {
      version: "1.0",
      type: "impl",
      id: "impl:test-transport-rest",
      semver: "1.0.0",
      status: "draft",
      created: "2026-01-01T00:00:00Z",
      updated: "2026-01-01T00:00:00Z",
      authors: ["@user"],
      reviewers: [],
      feature_ref: "feat:test@1.0.0",
      concern: "transport.rest",
    },
    design: {
      description: "TODO: Describe the transport.rest design",
    },
  };

  it("produces valid Markdown with frontmatter", () => {
    const md = serializeImplSpec(impl);
    expect(md).toContain("---");
    expect(md).toContain("transport.rest");
  });

  it("round-trips through parse and produces valid schema", () => {
    const md = serializeImplSpec(impl);
    const parsed = parseImplSpecMd(md);
    const result = ImplSpecSchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });

  it("accepts custom design body", () => {
    const md = serializeImplSpec(impl, "# Custom Design\n\nRich markdown body");
    expect(md).toContain("# Custom Design");
    expect(md).toContain("Rich markdown body");
  });
});

// ─── Hash Round-Trip Integrity ──────────────────────────────────────────────

describe("hash round-trip", () => {
  it("feature spec produces identical hash after serialize → parse round-trip", () => {
    const spec: FeatureSpec = {
      spectra: {
        version: "1.0",
        type: "feature",
        id: "feat:hash-test",
        semver: "2.0.0",
        status: "active",
        created: "2026-03-22T10:00:00Z",
        updated: "2026-03-22T10:00:00Z",
        authors: ["@julio"],
        reviewers: ["@alice"],
      },
      identity: {
        title: "Hash Test Feature",
        domain: ["identity", "security"],
        tags: ["auth"],
        summary: "Testing hash stability across format conversion",
      },
      interfaces: {
        inputs: [{ name: "creds", schema: { email: "string" } }],
        outputs: [{ name: "token", schema: { jwt: "string" } }],
        events_emitted: [],
        events_consumed: [],
      },
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Login works",
          given: "valid user",
          when: "login attempt",
          then: ["token issued", "session created"],
          non_negotiable: true,
        },
        {
          id: "AC-002",
          title: "Bad password",
          given: "invalid password",
          when: "login attempt",
          then: ["401 returned"],
          non_negotiable: false,
          constitution_constraints: ["SEC-002"],
        },
      ],
      non_functional: {
        performance: ["p99 < 200ms"],
        security: ["bcrypt cost 12"],
        observability: [],
        scalability: [],
      },
      dependencies: {
        feature_refs: [],
        schema_refs: [],
      },
    };

    // Hash the original spec object
    const originalHash = contentHash(spec as unknown as Record<string, unknown>);

    // Serialize to Markdown, parse back
    const md = serializeFeatureSpec(spec);
    const parsed = parseFeatureSpecMd(md);

    // Hash the round-tripped object
    const roundTripHash = contentHash(parsed);

    expect(roundTripHash).toBe(originalHash);
  });
});
