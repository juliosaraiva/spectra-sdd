import { describe, it, expect } from "vitest";
import {
  detectSemanticDrift,
  detectConstitutionalDrift,
  computeDriftScore,
  type DriftItem,
} from "../../src/core/drift.js";

describe("detectSemanticDrift", () => {
  it("flags uncovered acceptance criteria", () => {
    const trace = {
      version: "1.0",
      updated_at: "2026-03-22T10:00:00Z",
      specs: {
        "feat:test": {
          hash: "sha256:" + "a".repeat(64),
          status: "active" as const,
          authorized_artifacts: [],
          ac_coverage: {
            "AC-001": { covered: true, test_ids: ["TC-001"] },
            "AC-002": { covered: false, test_ids: [] },
          },
          gates: { specify: "approved" as const },
        },
      },
    };

    const items = detectSemanticDrift(trace);
    expect(items.length).toBe(1);
    expect(items[0].message).toContain("AC-002");
    expect(items[0].type).toBe("semantic");
  });

  it("returns empty for fully covered specs", () => {
    const trace = {
      version: "1.0",
      updated_at: "2026-03-22T10:00:00Z",
      specs: {
        "feat:test": {
          hash: "sha256:" + "a".repeat(64),
          status: "active" as const,
          authorized_artifacts: [],
          ac_coverage: {
            "AC-001": { covered: true, test_ids: ["TC-001"] },
          },
          gates: { specify: "approved" as const },
        },
      },
    };

    const items = detectSemanticDrift(trace);
    expect(items).toHaveLength(0);
  });
});

describe("detectConstitutionalDrift", () => {
  it("flags active specs with no gates", () => {
    const trace = {
      version: "1.0",
      updated_at: "2026-03-22T10:00:00Z",
      specs: {
        "feat:test": {
          hash: "sha256:" + "a".repeat(64),
          status: "active" as const,
          authorized_artifacts: [],
          ac_coverage: {},
          gates: {},
        },
      },
    };

    const items = detectConstitutionalDrift(trace);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe("constitutional");
  });
});

describe("computeDriftScore", () => {
  it("returns 0 for no items", () => {
    expect(computeDriftScore([])).toBe(0);
  });

  it("returns higher score for errors than warnings", () => {
    const warnings: DriftItem[] = [{ type: "structural", severity: "warning", message: "test" }];
    const errors: DriftItem[] = [{ type: "structural", severity: "error", message: "test" }];
    expect(computeDriftScore(errors)).toBeGreaterThan(computeDriftScore(warnings));
  });

  it("is bounded between 0 and 1", () => {
    const many: DriftItem[] = Array.from({ length: 50 }, () => ({
      type: "structural" as const,
      severity: "error" as const,
      message: "test",
    }));
    const score = computeDriftScore(many);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
