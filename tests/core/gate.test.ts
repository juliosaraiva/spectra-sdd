import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  signGate,
  verifyGate,
  listGates,
  expireGatesForSpec,
  checkPhaseReady,
} from "../../src/core/gate.js";
import type { Phase } from "../../src/core/spec-types.js";

const HASH = "sha256:" + "a".repeat(64);
const HASH2 = "sha256:" + "b".repeat(64);

let TEST_DIR: string;

beforeEach(async () => {
  TEST_DIR = await mkdtemp(join(tmpdir(), "spectra-test-gates-"));
  const GATES_DIR = join(TEST_DIR, ".spectra", "gates");
  await mkdir(GATES_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("signGate", () => {
  it("creates a signed gate file", async () => {
    const gate = await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    expect(gate.gate.status).toBe("approved");
    expect(gate.approval?.approved_by).toBe("@user");
    expect(gate.approval?.method).toBe("cli");
  });
});

describe("verifyGate", () => {
  it("returns valid for matching hash", async () => {
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    const result = await verifyGate(TEST_DIR, "feat:test", "specify", HASH);
    expect(result.valid).toBe(true);
  });

  it("returns invalid when spec hash changes", async () => {
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    const result = await verifyGate(TEST_DIR, "feat:test", "specify", HASH2);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("does not match");
  });

  it("returns invalid for non-existent gate", async () => {
    const result = await verifyGate(TEST_DIR, "feat:missing", "specify", HASH);
    expect(result.valid).toBe(false);
  });
});

describe("listGates", () => {
  it("lists all gates", async () => {
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "design", "@user");
    const gates = await listGates(TEST_DIR);
    expect(gates.length).toBe(2);
  });

  it("filters by spec ID", async () => {
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    await signGate(TEST_DIR, "feat:other", "1.0.0", HASH, "specify", "@user");
    const gates = await listGates(TEST_DIR, "feat:test");
    expect(gates.length).toBe(1);
  });
});

describe("expireGatesForSpec", () => {
  it("expires all gates for a spec", async () => {
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "specify", "@user");
    await signGate(TEST_DIR, "feat:test", "1.0.0", HASH, "design", "@user");
    const count = await expireGatesForSpec(TEST_DIR, "feat:test");
    expect(count).toBe(2);

    const result = await verifyGate(TEST_DIR, "feat:test", "specify", HASH);
    expect(result.valid).toBe(false);
  });
});

describe("checkPhaseReady", () => {
  it("returns ready when all prerequisite phases are signed", () => {
    const result = checkPhaseReady("design" as Phase, ["specify"]);
    expect(result.ready).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it("returns not ready with missing prerequisite", () => {
    const result = checkPhaseReady("implement" as Phase, ["specify"]);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("design");
    expect(result.missing).toContain("test-design");
  });

  it("first phase is always ready", () => {
    const result = checkPhaseReady("specify" as Phase, []);
    expect(result.ready).toBe(true);
  });
});
