import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import { lintFeatureSpec, lintAll } from "../../src/core/linter.js";
import type { FeatureSpec } from "../../src/core/spec-types.js";

function makeSpec(overrides: Partial<FeatureSpec> = {}): FeatureSpec {
  return {
    spectra: {
      version: "1.0",
      type: "feature",
      id: "feat:test",
      semver: "1.0.0",
      status: "draft",
      created: "2026-03-22",
      updated: "2026-03-22",
      authors: ["@user"],
      reviewers: [],
    },
    identity: {
      title: "Test",
      domain: ["security"],
      tags: [],
      summary: "A test feature",
    },
    acceptance_criteria: [
      {
        id: "AC-001",
        title: "Test",
        given: "a precondition",
        when: "action occurs",
        then: ["result happens"],
        non_negotiable: true,
      },
    ],
    ...overrides,
  } as FeatureSpec;
}

describe("SPEC-001: AC must have given/when/then", () => {
  it("passes with valid AC", () => {
    const spec = makeSpec();
    const results = lintFeatureSpec(spec, "test.yaml");
    expect(results.filter((r) => r.rule === "SPEC-001")).toHaveLength(0);
  });
});

describe("SPEC-002: No vague quantifiers", () => {
  it("warns on vague language", () => {
    const spec = makeSpec({
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Test",
          given: "a fast response is needed",
          when: "user makes appropriate request",
          then: ["system responds quickly"],
          non_negotiable: true,
        },
      ],
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const vagueWarnings = results.filter((r) => r.rule === "SPEC-002");
    expect(vagueWarnings.length).toBeGreaterThan(0);
  });

  it("passes with precise language", () => {
    const spec = makeSpec({
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Test",
          given: "a registered user with valid credentials",
          when: "the user submits their email and password",
          then: ["HTTP 200 is returned within 200ms"],
          non_negotiable: true,
        },
      ],
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const vagueWarnings = results.filter((r) => r.rule === "SPEC-002");
    expect(vagueWarnings).toHaveLength(0);
  });
});

describe("SPEC-003: No any types in schemas", () => {
  it("flags any types in input schemas", () => {
    const spec = makeSpec({
      interfaces: {
        inputs: [{ name: "data", schema: { type: "any" } }],
        outputs: [],
        events_emitted: [],
        events_consumed: [],
      },
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const anyWarnings = results.filter((r) => r.rule === "SPEC-003");
    expect(anyWarnings.length).toBeGreaterThan(0);
  });
});

describe("SPEC-004: Measurable NFRs", () => {
  it("warns on unmeasurable performance requirements", () => {
    const spec = makeSpec({
      non_functional: {
        performance: ["the system must be responsive"],
        security: [],
        observability: [],
        scalability: [],
      },
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const nfrWarnings = results.filter((r) => r.rule === "SPEC-004");
    expect(nfrWarnings.length).toBeGreaterThan(0);
  });

  it("passes with measurable requirements", () => {
    const spec = makeSpec({
      non_functional: {
        performance: ["p99 latency < 200ms under 1000 concurrent users"],
        security: [],
        observability: [],
        scalability: [],
      },
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const nfrWarnings = results.filter((r) => r.rule === "SPEC-004");
    expect(nfrWarnings).toHaveLength(0);
  });
});

describe("SPEC-007: At least one non_negotiable AC", () => {
  it("warns when no AC is non_negotiable", () => {
    const spec = makeSpec({
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Test",
          given: "a condition",
          when: "action",
          then: ["result"],
          non_negotiable: false,
        },
      ],
    });
    const results = lintFeatureSpec(spec, "test.yaml");
    const warnings = results.filter((r) => r.rule === "SPEC-007");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("passes with at least one non_negotiable", () => {
    const spec = makeSpec();
    const results = lintFeatureSpec(spec, "test.yaml");
    const warnings = results.filter((r) => r.rule === "SPEC-007");
    expect(warnings).toHaveLength(0);
  });
});

describe("SPEC-008: Domain tags in vocabulary", () => {
  it("warns when domain tag is not in vocabulary", () => {
    const spec = makeSpec({
      identity: {
        title: "Test",
        domain: ["nonexistent-domain"],
        tags: [],
        summary: "Test",
      },
    });
    const results = lintFeatureSpec(spec, "test.yaml", ["security", "api"]);
    const warnings = results.filter((r) => r.rule === "SPEC-008");
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("passes when all domain tags are in vocabulary", () => {
    const spec = makeSpec();
    const results = lintFeatureSpec(spec, "test.yaml", ["security", "identity"]);
    const warnings = results.filter((r) => r.rule === "SPEC-008");
    expect(warnings).toHaveLength(0);
  });
});

// ─── lintAll ────────────────────────────────────────────────────────────────

const VALID_SPEC_YAML = stringify({
  spectra: {
    version: "1.0",
    type: "feature",
    id: "feat:auth",
    semver: "1.0.0",
    status: "draft",
    created: "2026-01-01T00:00:00Z",
    updated: "2026-01-01T00:00:00Z",
    authors: ["@user"],
  },
  identity: {
    title: "Auth Feature",
    domain: ["security"],
    tags: [],
    summary: "Authentication feature",
  },
  acceptance_criteria: [
    {
      id: "AC-001",
      title: "Login",
      given: "a fast user",
      when: "they login appropriately",
      then: ["they should get a reasonable token"],
      non_negotiable: false,
    },
  ],
});

describe("lintAll", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-lintall-"));
    await mkdir(join(tmpDir, ".spectra", "features"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when features dir does not exist", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "spectra-test-empty-"));
    await mkdir(join(emptyDir, ".spectra"), { recursive: true });
    const results = await lintAll(emptyDir);
    expect(results).toEqual([]);
    await rm(emptyDir, { recursive: true, force: true });
  });

  it("returns lint results for specs with vague language", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "auth.spec.yaml"), VALID_SPEC_YAML);
    const results = await lintAll(tmpDir);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.rule === "SPEC-002")).toBe(true);
  });

  it("detects missing non_negotiable ACs", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "auth.spec.yaml"), VALID_SPEC_YAML);
    const results = await lintAll(tmpDir);
    expect(results.some((r) => r.rule === "SPEC-007")).toBe(true);
  });

  it("uses constitution vocabulary for domain tag checks", async () => {
    const specWithBadDomain = stringify({
      spectra: {
        version: "1.0",
        type: "feature",
        id: "feat:test",
        semver: "1.0.0",
        status: "draft",
        created: "2026-01-01T00:00:00Z",
        updated: "2026-01-01T00:00:00Z",
        authors: ["@user"],
      },
      identity: {
        title: "Test",
        domain: ["unknown-domain"],
        tags: [],
        summary: "Test feature",
      },
      acceptance_criteria: [
        {
          id: "AC-001",
          title: "Test",
          given: "a context",
          when: "an action",
          then: ["a result"],
          non_negotiable: true,
        },
      ],
    });
    const constitutionYaml = stringify({
      spectra: {
        version: "1.0",
        type: "constitution",
        semver: "1.0.0",
        updated: "2026-01-01T00:00:00Z",
        stewards: ["@team"],
      },
      vocabulary: ["security"],
      constraints: [
        {
          id: "SEC-001",
          title: "No secrets",
          description: "No secrets in code",
          domain: ["security"],
          enforcement: "MUST",
        },
      ],
    });
    await writeFile(join(tmpDir, ".spectra", "constitution.yaml"), constitutionYaml);
    await writeFile(join(tmpDir, ".spectra", "features", "test.spec.yaml"), specWithBadDomain);
    const results = await lintAll(tmpDir);
    expect(results.some((r) => r.rule === "SPEC-008")).toBe(true);
  });

  it("proceeds without vocabulary when constitution is missing", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "auth.spec.yaml"), VALID_SPEC_YAML);
    const results = await lintAll(tmpDir);
    expect(results.every((r) => r.rule !== "SPEC-008")).toBe(true);
  });
});
