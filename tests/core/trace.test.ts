import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  updateTrace,
  traceWhy,
  traceForward,
  computeCoverage,
  updateGateInTrace,
  loadTrace,
  saveTrace,
} from "../../src/core/trace.js";
import type { ContentHash } from "../../src/core/spec-types.js";

const TEST_DIR = join(tmpdir(), "spectra-test-trace");
const SPECTRA_DIR = join(TEST_DIR, ".spectra");
const HASH_A = ("sha256:" + "a".repeat(64)) as ContentHash;
const HASH_B = ("sha256:" + "b".repeat(64)) as ContentHash;
const HASH_C = ("sha256:" + "c".repeat(64)) as ContentHash;

const EMPTY_TRACE = JSON.stringify({
  version: "1.0",
  updated_at: new Date().toISOString(),
  specs: {},
});

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(SPECTRA_DIR, { recursive: true });
  await writeFile(join(SPECTRA_DIR, "trace.json"), EMPTY_TRACE);
});

describe("updateTrace", () => {
  it("writes a new trace entry with artifacts", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", [
      { path: "src/auth.ts", hash: HASH_B, concern: "transport.rest", impl_ref: "impl:auth" },
    ]);

    const trace = await loadTrace(TEST_DIR);
    expect(trace.specs["feat:auth"]).toBeDefined();
    expect(trace.specs["feat:auth"].hash).toBe(HASH_A);
    expect(trace.specs["feat:auth"].status).toBe("draft");
    expect(trace.specs["feat:auth"].authorized_artifacts).toHaveLength(1);
    expect(trace.specs["feat:auth"].authorized_artifacts[0].path).toBe("src/auth.ts");
  });

  it("replaces artifacts on second call (NOT additive)", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", [
      { path: "src/auth.ts", hash: HASH_B },
      { path: "src/auth.test.ts", hash: HASH_C, type: "test" },
    ]);

    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "active", [
      { path: "src/auth-v2.ts", hash: HASH_B },
    ]);

    const trace = await loadTrace(TEST_DIR);
    expect(trace.specs["feat:auth"].authorized_artifacts).toHaveLength(1);
    expect(trace.specs["feat:auth"].authorized_artifacts[0].path).toBe("src/auth-v2.ts");
    expect(trace.specs["feat:auth"].status).toBe("active");
  });
});

describe("traceWhy", () => {
  it("returns ancestry for a tracked file path", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", [
      { path: "src/auth.ts", hash: HASH_B, impl_ref: "impl:auth", generation_id: "gen-001" },
    ]);

    const ancestry = await traceWhy(TEST_DIR, "src/auth.ts");
    expect(ancestry).not.toBeNull();
    expect(ancestry?.spec_id).toBe("feat:auth");
    expect(ancestry?.spec_hash).toBe(HASH_A);
    expect(ancestry?.impl_ref).toBe("impl:auth");
    expect(ancestry?.generation_id).toBe("gen-001");
    expect(ancestry?.file).toBe("src/auth.ts");
  });

  it("returns null for an untracked file", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", [
      { path: "src/auth.ts", hash: HASH_B },
    ]);

    const ancestry = await traceWhy(TEST_DIR, "src/untracked.ts");
    expect(ancestry).toBeNull();
  });
});

describe("traceForward", () => {
  it("returns the full entry for a tracked spec", async () => {
    await updateTrace(TEST_DIR, "feat:payments", HASH_A, "active", [
      { path: "src/payments.ts", hash: HASH_B },
    ]);

    const entry = await traceForward(TEST_DIR, "feat:payments");
    expect(entry).not.toBeNull();
    expect(entry?.hash).toBe(HASH_A);
    expect(entry?.status).toBe("active");
    expect(entry?.authorized_artifacts).toHaveLength(1);
  });

  it("returns null for an untracked spec", async () => {
    const entry = await traceForward(TEST_DIR, "feat:nonexistent");
    expect(entry).toBeNull();
  });
});

describe("computeCoverage", () => {
  it("returns 0% when all ACs are uncovered", async () => {
    const trace = await loadTrace(TEST_DIR);
    trace.specs["feat:auth"] = {
      hash: HASH_A,
      status: "draft",
      authorized_artifacts: [],
      ac_coverage: {
        "AC-001": { covered: false, test_ids: [] },
        "AC-002": { covered: false, test_ids: [] },
      },
      gates: {},
    };
    await saveTrace(TEST_DIR, trace);

    const report = await computeCoverage(TEST_DIR, "feat:auth");
    expect(report).not.toBeNull();
    expect(report?.coverage_percent).toBe(0);
    expect(report?.covered_acs).toBe(0);
    expect(report?.total_acs).toBe(2);
    expect(report?.uncovered).toEqual(expect.arrayContaining(["AC-001", "AC-002"]));
  });

  it("returns 100% when all ACs are covered", async () => {
    const trace = await loadTrace(TEST_DIR);
    trace.specs["feat:auth"] = {
      hash: HASH_A,
      status: "active",
      authorized_artifacts: [],
      ac_coverage: {
        "AC-001": { covered: true, test_ids: ["TC-001"] },
        "AC-002": { covered: true, test_ids: ["TC-002"] },
      },
      gates: {},
    };
    await saveTrace(TEST_DIR, trace);

    const report = await computeCoverage(TEST_DIR, "feat:auth");
    expect(report?.coverage_percent).toBe(100);
    expect(report?.covered_acs).toBe(2);
    expect(report?.uncovered).toHaveLength(0);
  });

  it("returns null when no ac_coverage entries exist", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", []);

    const report = await computeCoverage(TEST_DIR, "feat:auth");
    expect(report).toBeNull();
  });
});

describe("updateGateInTrace", () => {
  it("no-ops when spec is not tracked yet", async () => {
    await updateGateInTrace(TEST_DIR, "feat:new-spec", "specify", "approved");

    const trace = await loadTrace(TEST_DIR);
    expect(trace.specs["feat:new-spec"]).toBeUndefined();
  });

  it("updates gate status on existing entry", async () => {
    await updateTrace(TEST_DIR, "feat:auth", HASH_A, "draft", []);
    await updateGateInTrace(TEST_DIR, "feat:auth", "specify", "approved");
    await updateGateInTrace(TEST_DIR, "feat:auth", "design", "pending");

    const trace = await loadTrace(TEST_DIR);
    expect(trace.specs["feat:auth"].gates["specify"]).toBe("approved");
    expect(trace.specs["feat:auth"].gates["design"]).toBe("pending");
    // original hash preserved
    expect(trace.specs["feat:auth"].hash).toBe(HASH_A);
  });
});
