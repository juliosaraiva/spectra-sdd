import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import {
  FeatureSpecSchema,
  ConstitutionSchema,
  ImplSpecSchema,
  GateSchema,
} from "../../src/core/spec-types.js";
import { validateSpec, validateAll, validateCrossRefs } from "../../src/core/validator.js";

describe("FeatureSpecSchema", () => {
  const validSpec = {
    spectra: {
      version: "1.0",
      type: "feature",
      id: "feat:test",
      semver: "1.0.0",
      status: "draft",
      created: "2026-03-22T10:00:00Z",
      updated: "2026-03-22T10:00:00Z",
      authors: ["@user"],
    },
    identity: {
      title: "Test Feature",
      domain: ["security"],
      summary: "A test feature",
    },
    acceptance_criteria: [
      {
        id: "AC-001",
        title: "Test",
        given: "a condition",
        when: "something happens",
        then: ["expected result"],
        non_negotiable: true,
      },
    ],
  };

  it("validates a valid feature spec", () => {
    const result = FeatureSpecSchema.safeParse(validSpec);
    expect(result.success).toBe(true);
  });

  it("rejects missing acceptance criteria", () => {
    const invalid = { ...validSpec, acceptance_criteria: [] };
    const result = FeatureSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid AC ID format", () => {
    const invalid = {
      ...validSpec,
      acceptance_criteria: [{ ...validSpec.acceptance_criteria[0], id: "bad-id" }],
    };
    const result = FeatureSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects missing identity", () => {
    const { identity: _identity, ...invalid } = validSpec;
    const result = FeatureSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid semver", () => {
    const invalid = {
      ...validSpec,
      spectra: { ...validSpec.spectra, semver: "not-semver" },
    };
    const result = FeatureSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ConstitutionSchema", () => {
  const validConst = {
    spectra: {
      version: "1.0",
      type: "constitution",
      semver: "1.0.0",
      updated: "2026-03-22T10:00:00Z",
      stewards: ["@team"],
    },
    vocabulary: ["security"],
    constraints: [
      {
        id: "SEC-001",
        title: "Test constraint",
        description: "A test constraint",
        domain: ["security"],
        enforcement: "MUST",
      },
    ],
  };

  it("validates a valid constitution", () => {
    const result = ConstitutionSchema.safeParse(validConst);
    expect(result.success).toBe(true);
  });

  it("rejects empty constraints", () => {
    const invalid = { ...validConst, constraints: [] };
    const result = ConstitutionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid constraint ID format", () => {
    const invalid = {
      ...validConst,
      constraints: [{ ...validConst.constraints[0], id: "bad" }],
    };
    const result = ConstitutionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("ImplSpecSchema", () => {
  it("validates a valid impl spec", () => {
    const valid = {
      spectra: {
        version: "1.0",
        type: "impl",
        id: "impl:test.rest",
        semver: "1.0.0",
        status: "draft",
        created: "2026-03-22T10:00:00Z",
        updated: "2026-03-22T10:00:00Z",
        authors: ["@user"],
        feature_ref: "feat:test@1.0.0",
        concern: "transport.rest",
      },
      design: { endpoint: "POST /test" },
    };
    const result = ImplSpecSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects invalid concern namespace", () => {
    const invalid = {
      spectra: {
        version: "1.0",
        type: "impl",
        id: "impl:test",
        semver: "1.0.0",
        status: "draft",
        created: "2026-03-22T10:00:00Z",
        updated: "2026-03-22T10:00:00Z",
        authors: ["@user"],
        feature_ref: "feat:test@1.0.0",
        concern: "INVALID CONCERN",
      },
      design: {},
    };
    const result = ImplSpecSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("GateSchema", () => {
  it("validates an approved gate", () => {
    const valid = {
      gate: {
        spec_id: "feat:test",
        spec_semver: "1.0.0",
        spec_hash: "sha256:" + "a".repeat(64),
        phase: "specify",
        status: "approved",
      },
      approval: {
        approved_by: "@user",
        approved_at: "2026-03-22T10:00:00Z",
        method: "cli",
      },
    };
    const result = GateSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

// ─── validateSpec / validateAll / validateCrossRefs ─────────────────────────

const VALID_FEATURE_YAML = stringify({
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
    title: "Auth",
    domain: ["security"],
    tags: [],
    summary: "Auth feature",
  },
  acceptance_criteria: [
    {
      id: "AC-001",
      title: "Login",
      given: "a user",
      when: "they login",
      then: ["they get a token"],
      non_negotiable: true,
    },
  ],
});

const VALID_CONSTITUTION_YAML = stringify({
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

describe("validateSpec", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-validate-"));
    await mkdir(join(tmpDir, ".spectra", "features"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("validates a valid feature spec YAML", async () => {
    const filePath = join(tmpDir, ".spectra", "features", "auth.spec.yaml");
    await writeFile(filePath, VALID_FEATURE_YAML);
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns errors for invalid YAML content", async () => {
    const filePath = join(tmpDir, ".spectra", "features", "bad.spec.yaml");
    await writeFile(filePath, ":\ninvalid: yaml: [[\n");
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(false);
  });

  it("returns errors for unknown spec type", async () => {
    const filePath = join(tmpDir, "unknown.yaml");
    await writeFile(filePath, stringify({ data: "no type" }));
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toContain("Unknown or missing spec type");
  });

  it("detects spec type from filename for impl", async () => {
    await mkdir(join(tmpDir, ".spectra", "impl", "auth"), { recursive: true });
    const filePath = join(tmpDir, ".spectra", "impl", "auth", "rest.impl.yaml");
    await writeFile(
      filePath,
      stringify({
        spectra: {
          version: "1.0",
          type: "impl",
          id: "impl:auth-rest",
          semver: "1.0.0",
          status: "draft",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
          authors: ["@user"],
          feature_ref: "feat:auth@1.0.0",
          concern: "transport.rest",
        },
        design: { endpoint: "POST /auth" },
      })
    );
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(true);
  });

  it("validates a constitution file", async () => {
    const filePath = join(tmpDir, ".spectra", "constitution.yaml");
    await writeFile(filePath, VALID_CONSTITUTION_YAML);
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(true);
  });

  it("returns error for non-object parsed content", async () => {
    const filePath = join(tmpDir, ".spectra", "features", "null.spec.yaml");
    await writeFile(filePath, "null\n");
    const result = await validateSpec(filePath);
    expect(result.valid).toBe(false);
  });
});

describe("validateAll", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-validateall-"));
    await mkdir(join(tmpDir, ".spectra", "features"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns results for feature specs in features dir", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "auth.spec.yaml"), VALID_FEATURE_YAML);
    const results = await validateAll(tmpDir);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.file.includes("auth.spec.yaml"))).toBe(true);
  });

  it("skips files starting with underscore", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "_index.yaml"), "test: true");
    const results = await validateAll(tmpDir);
    expect(results.every((r) => !r.file.includes("_index"))).toBe(true);
  });

  it("validates constitution when present", async () => {
    await writeFile(join(tmpDir, ".spectra", "constitution.yaml"), VALID_CONSTITUTION_YAML);
    const results = await validateAll(tmpDir);
    expect(results.some((r) => r.file.includes("constitution"))).toBe(true);
  });

  it("validates impl specs in subdirectories", async () => {
    await mkdir(join(tmpDir, ".spectra", "impl", "auth"), { recursive: true });
    await writeFile(
      join(tmpDir, ".spectra", "impl", "auth", "rest.impl.yaml"),
      stringify({
        spectra: {
          version: "1.0",
          type: "impl",
          id: "impl:auth-rest",
          semver: "1.0.0",
          status: "draft",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
          authors: ["@user"],
          feature_ref: "feat:auth@1.0.0",
          concern: "transport.rest",
        },
        design: { endpoint: "POST /auth" },
      })
    );
    const results = await validateAll(tmpDir);
    expect(results.some((r) => r.file.includes("rest.impl.yaml"))).toBe(true);
  });

  it("returns empty array when no spectra dir exists", async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), "spectra-test-empty-"));
    const results = await validateAll(emptyDir);
    expect(results).toEqual([]);
    await rm(emptyDir, { recursive: true, force: true });
  });
});

describe("validateCrossRefs", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-crossrefs-"));
    await mkdir(join(tmpDir, ".spectra", "features"), { recursive: true });
    await mkdir(join(tmpDir, ".spectra", "impl", "auth"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns no errors when impl refs a known feature", async () => {
    await writeFile(join(tmpDir, ".spectra", "features", "auth.spec.yaml"), VALID_FEATURE_YAML);
    await writeFile(
      join(tmpDir, ".spectra", "impl", "auth", "rest.impl.yaml"),
      stringify({
        spectra: {
          version: "1.0",
          type: "impl",
          id: "impl:auth-rest",
          semver: "1.0.0",
          status: "draft",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
          authors: ["@user"],
          feature_ref: "feat:auth@1.0.0",
          concern: "transport.rest",
        },
        design: {},
      })
    );
    const results = await validateCrossRefs(tmpDir);
    expect(results).toHaveLength(0);
  });

  it("returns error when impl refs an unknown feature", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "impl", "auth", "rest.impl.yaml"),
      stringify({
        spectra: {
          version: "1.0",
          type: "impl",
          id: "impl:auth-rest",
          semver: "1.0.0",
          status: "draft",
          created: "2026-01-01T00:00:00Z",
          updated: "2026-01-01T00:00:00Z",
          authors: ["@user"],
          feature_ref: "feat:nonexistent@1.0.0",
          concern: "transport.rest",
        },
        design: {},
      })
    );
    const results = await validateCrossRefs(tmpDir);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].errors[0].message).toContain("unknown feature");
  });
});
