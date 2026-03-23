import { describe, it, expect } from "vitest";
import {
  FeatureSpecSchema,
  ConstitutionSchema,
  ImplSpecSchema,
  GateSchema,
} from "../../src/core/spec-types.js";

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
