import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function normalizePath(p: string | undefined): string {
  return (p ?? "").replace(/\\/g, "/");
}
import {
  detectStructuralDrift,
  detectSemanticDrift,
  detectConstitutionalDrift,
  computeDriftScore,
  generateDriftReport,
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

// ─── detectStructuralDrift ──────────────────────────────────────────────────

describe("detectStructuralDrift", () => {
  let tmpDir = "";
  const HASH = "sha256:" + "a".repeat(64);

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-drift-"));
    await mkdir(join(tmpDir, ".spectra"), { recursive: true });
    await mkdir(join(tmpDir, "src"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({ version: "1.0", updated_at: new Date().toISOString(), specs: {} })
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(items).toHaveLength(0);
  });

  it("warns when file references an unknown spec", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({ version: "1.0", updated_at: new Date().toISOString(), specs: {} })
    );
    await writeFile(
      join(tmpDir, "src", "handler.ts"),
      "// @spectra feat:unknown@1.0.0 impl:transport.rest gen:abc123\nexport function handler() {}"
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(items.some((i) => i.message.includes("no trace entry exists"))).toBe(true);
  });

  it("warns when file is not in authorized artifacts", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({
        version: "1.0",
        updated_at: new Date().toISOString(),
        specs: {
          "feat:auth": {
            hash: HASH,
            status: "active",
            authorized_artifacts: [],
            ac_coverage: {},
            gates: { specify: "approved" },
          },
        },
      })
    );
    await writeFile(
      join(tmpDir, "src", "auth.ts"),
      "// @spectra feat:auth@1.0.0 impl:transport.rest gen:abc123\nexport function auth() {}"
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(items.some((i) => i.message.includes("not in the authorized artifacts list"))).toBe(
      true
    );
  });

  it("does not warn when file is authorized", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({
        version: "1.0",
        updated_at: new Date().toISOString(),
        specs: {
          "feat:auth": {
            hash: HASH,
            status: "active",
            authorized_artifacts: [{ path: "src/auth.ts", hash: HASH, type: "source" }],
            ac_coverage: {},
            gates: { specify: "approved" },
          },
        },
      })
    );
    await writeFile(
      join(tmpDir, "src", "auth.ts"),
      "// @spectra feat:auth@1.0.0 impl:transport.rest gen:abc123\nexport function auth() {}"
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(
      items.filter((i) => {
        const p = normalizePath(i.file);
        return p === "src/auth.ts" || p.endsWith("/src/auth.ts");
      })
    ).toHaveLength(0);
  });

  it("warns when active spec has no authorized artifacts", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({
        version: "1.0",
        updated_at: new Date().toISOString(),
        specs: {
          "feat:orphan": {
            hash: HASH,
            status: "active",
            authorized_artifacts: [],
            ac_coverage: {},
            gates: { specify: "approved" },
          },
        },
      })
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(items.some((i) => i.message.includes("active but has no authorized artifacts"))).toBe(
      true
    );
  });

  it("handles nonexistent srcDir gracefully", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({ version: "1.0", updated_at: new Date().toISOString(), specs: {} })
    );
    const items = await detectStructuralDrift(tmpDir, ["nonexistent"]);
    expect(items).toHaveLength(0);
  });

  it("scans nested subdirectories", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({ version: "1.0", updated_at: new Date().toISOString(), specs: {} })
    );
    await mkdir(join(tmpDir, "src", "sub"), { recursive: true });
    await writeFile(
      join(tmpDir, "src", "sub", "deep.ts"),
      "// @spectra feat:deep@1.0.0\nexport const x = 1;"
    );
    const items = await detectStructuralDrift(tmpDir);
    expect(items.some((i) => normalizePath(i.file).includes("sub/deep.ts"))).toBe(true);
  });
});

// ─── generateDriftReport ────────────────────────────────────────────────────

describe("generateDriftReport", () => {
  let tmpDir = "";
  const HASH = "sha256:" + "a".repeat(64);

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-report-"));
    await mkdir(join(tmpDir, ".spectra"), { recursive: true });
    await mkdir(join(tmpDir, "src"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns a report with score 0 for clean project", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({ version: "1.0", updated_at: new Date().toISOString(), specs: {} })
    );
    const report = await generateDriftReport(tmpDir);
    expect(report.project_drift_score).toBe(0);
    expect(report.items).toHaveLength(0);
    expect(report.generated_at).toBeDefined();
  });

  it("groups items by feature in the report", async () => {
    await writeFile(
      join(tmpDir, ".spectra", "trace.json"),
      JSON.stringify({
        version: "1.0",
        updated_at: new Date().toISOString(),
        specs: {
          "feat:auth": {
            hash: HASH,
            status: "active",
            authorized_artifacts: [],
            ac_coverage: { "AC-001": { covered: false, test_ids: [] } },
            gates: {},
          },
        },
      })
    );
    const report = await generateDriftReport(tmpDir);
    expect(report.items.length).toBeGreaterThan(0);
    expect(report.features["feat:auth"]).toBeDefined();
    expect(report.features["feat:auth"].status).toBe("drifted");
    expect(report.features["feat:auth"].drift_types.length).toBeGreaterThan(0);
  });
});
