import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  loadConstitution,
  selectConstraints,
  validateAgainstConstitution,
  amendConstitution,
  defaultConstitution,
  constitutionToYaml,
} from "../../src/core/constitution.js";
import { ConstitutionSchema } from "../../src/core/spec-types.js";

let TEST_DIR: string;
let SPECTRA_DIR: string;

beforeEach(async () => {
  TEST_DIR = join(
    tmpdir(),
    "spectra-test-constitution-" + Date.now() + "-" + Math.random().toString(36).slice(2)
  );
  SPECTRA_DIR = join(TEST_DIR, ".spectra");
  await mkdir(SPECTRA_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("selectConstraints", () => {
  it("returns constraints ranked by domain overlap", () => {
    const constitution = defaultConstitution();
    // "security" overlaps SEC-001 (security), SEC-002 (security,api,transport), QUAL-002 (security,identity,persistence)
    const results = selectConstraints(constitution, ["security"], 10);
    // all three match "security"
    const ids = results.map((c) => c.id);
    expect(ids).toContain("SEC-001");
    expect(ids).toContain("SEC-002");
    expect(ids).toContain("QUAL-002");
  });

  it("gives MUST constraints +2 priority boost over SHOULD constraints", () => {
    const constitution = defaultConstitution();
    // With "persistence": QUAL-002 (MUST, overlap 1, score=3), ARCH-001 (SHOULD, overlap 1, score=2)
    // MUST constraints with same overlap should rank higher
    const results = selectConstraints(constitution, ["persistence"], 10);
    const qualIdx = results.findIndex((c) => c.id === "QUAL-002");
    const archIdx = results.findIndex((c) => c.id === "ARCH-001");
    expect(qualIdx).not.toBe(-1);
    expect(archIdx).not.toBe(-1);
    // QUAL-002 (MUST, score=3) should rank before ARCH-001 (SHOULD, score=2)
    expect(qualIdx).toBeLessThan(archIdx);
  });

  it("gives SHOULD constraints +1 priority boost", () => {
    const constitution = defaultConstitution();
    // ARCH-001 is SHOULD, overlaps "persistence"
    // QUAL-002 is MUST, overlaps "persistence"
    // Score for "persistence": QUAL-002 = 1+2=3, ARCH-001 = 1+1=2
    const results = selectConstraints(constitution, ["persistence"], 10);
    const qualIdx = results.findIndex((c) => c.id === "QUAL-002");
    const archIdx = results.findIndex((c) => c.id === "ARCH-001");
    expect(qualIdx).not.toBe(-1);
    expect(archIdx).not.toBe(-1);
    expect(qualIdx).toBeLessThan(archIdx); // QUAL-002 ranks higher
  });

  it("returns at most maxCount results", () => {
    const constitution = defaultConstitution();
    const results = selectConstraints(
      constitution,
      ["security", "api", "transport", "persistence", "identity"],
      2
    );
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("includes MUST/SHOULD constraints even with zero domain overlap due to enforcement boost", () => {
    const constitution = defaultConstitution();
    // "nonexistent-domain" matches no constraint domains
    // But MUST constraints get +2 boost (score=2>0) and SHOULD get +1 (score=1>0)
    // Only MAY constraints with zero overlap (score=0) would be excluded
    const results = selectConstraints(constitution, ["nonexistent-domain"], 10);
    // All 5 default constraints are MUST or SHOULD, so all have score > 0
    expect(results.length).toBeGreaterThan(0);
    // All returned constraints should be MUST or SHOULD
    for (const c of results) {
      expect(["MUST", "SHOULD"]).toContain(c.enforcement);
    }
  });
});

describe("validateAgainstConstitution", () => {
  it("returns empty array when all constraint refs are valid", () => {
    const constitution = defaultConstitution();
    const spec = {
      acceptance_criteria: [
        { id: "AC-001", constitution_constraints: ["SEC-001", "SEC-002"] },
        { id: "AC-002", constitution_constraints: ["QUAL-001"] },
      ],
    };
    const violations = validateAgainstConstitution(spec, constitution);
    expect(violations).toHaveLength(0);
  });

  it("returns violations for unknown constraint refs", () => {
    const constitution = defaultConstitution();
    const spec = {
      acceptance_criteria: [{ id: "AC-001", constitution_constraints: ["SEC-001", "UNKNOWN-999"] }],
    };
    const violations = validateAgainstConstitution(spec, constitution);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("AC-001");
    expect(violations[0]).toContain("UNKNOWN-999");
  });

  it("skips ACs without constitution_constraints", () => {
    const constitution = defaultConstitution();
    const spec = {
      acceptance_criteria: [
        { id: "AC-001" }, // no constitution_constraints field
        { id: "AC-002", constitution_constraints: ["SEC-001"] },
      ],
    };
    const violations = validateAgainstConstitution(spec, constitution);
    expect(violations).toHaveLength(0);
  });
});

describe("amendConstitution", () => {
  it("appends a line to the changelog file", async () => {
    await amendConstitution(TEST_DIR, {
      action: "ADD_CONSTRAINT",
      author: "@alice",
      description: "Added new security constraint",
      approved_by: ["@bob", "@carol"],
      prev_hash: "sha256:" + "0".repeat(64),
      new_hash: "sha256:" + "1".repeat(64),
    });

    const changelogPath = join(SPECTRA_DIR, "constitution.changelog");
    const content = await readFile(changelogPath, "utf8");
    expect(content).toContain("ADD_CONSTRAINT");
    expect(content).toContain("@alice");
    expect(content).toContain("Added new security constraint");
    expect(content).toContain("approved_by:@bob,@carol");
  });
});

describe("defaultConstitution", () => {
  it("returns a constitution that passes ConstitutionSchema validation", () => {
    const constitution = defaultConstitution();
    const result = ConstitutionSchema.safeParse(constitution);
    expect(result.success).toBe(true);
  });
});

describe("loadConstitution", () => {
  it("parses a valid constitution YAML file from disk", async () => {
    const constitution = defaultConstitution();
    const yaml = constitutionToYaml(constitution);
    await writeFile(join(SPECTRA_DIR, "constitution.yaml"), yaml);

    const loaded = await loadConstitution(TEST_DIR);
    expect(loaded.spectra.type).toBe("constitution");
    expect(loaded.constraints.length).toBeGreaterThan(0);
    expect(loaded.vocabulary.length).toBeGreaterThan(0);
    // constraint IDs match
    const ids = loaded.constraints.map((c) => c.id);
    expect(ids).toContain("SEC-001");
  });
});
