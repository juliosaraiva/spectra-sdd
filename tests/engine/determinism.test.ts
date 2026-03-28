import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import { auditDeterminism } from "../../src/engine/determinism.js";
import { generate } from "../../src/engine/generator.js";

describe("auditDeterminism", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-determinism-"));
    await mkdir(join(tmpDir, ".spectra", "features"), { recursive: true });
    await mkdir(join(tmpDir, ".spectra", "templates"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns not deterministic when no lock entry exists", async () => {
    // Write an empty lock file
    await writeFile(join(tmpDir, ".spectra", "generate.lock"), "{}");
    const result = await auditDeterminism(tmpDir, "feat:test", "1.0.0", "tests");
    expect(result.deterministic).toBe(false);
    expect(result.message).toContain("No lock entry found");
    expect(result.spec_id).toBe("feat:test");
    expect(result.target).toBe("tests");
  });

  it("returns not deterministic when re-generation fails", async () => {
    // Write a lock entry for a spec that doesn't exist on disk
    const lockData = {
      "feat:ghost@1.0.0--tests": {
        template_id: "feature-to-tests",
        template_version: "1.0",
        template_hash: "sha256:" + "b".repeat(64),
        input_spec_hash: "sha256:" + "c".repeat(64),
        model: "human",
        model_params: {},
        output_hash: "sha256:" + "d".repeat(64),
        generated_at: new Date().toISOString(),
        generation_id: "gen:12345678",
      },
    };
    await writeFile(join(tmpDir, ".spectra", "generate.lock"), JSON.stringify(lockData));
    const result = await auditDeterminism(tmpDir, "feat:ghost", "1.0.0", "tests");
    expect(result.deterministic).toBe(false);
    expect(result.message).toContain("Re-generation failed");
  });

  it("returns deterministic when output hashes match", async () => {
    // Set up a real spec + template so generation works
    const spec = stringify({
      spectra: {
        version: "1.0",
        type: "feature",
        id: "feat:det-test",
        semver: "1.0.0",
        status: "draft",
        created: "2026-01-01T00:00:00Z",
        updated: "2026-01-01T00:00:00Z",
        authors: ["@user"],
      },
      identity: {
        title: "Determinism Test",
        domain: ["security"],
        tags: [],
        summary: "Testing determinism",
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
    await writeFile(join(tmpDir, ".spectra", "features", "det-test.spec.yaml"), spec);
    await writeFile(
      join(tmpDir, ".spectra", "templates", "feature-to-tests.tmpl"),
      "Test output: {{spec.spectra.id}}"
    );
    await writeFile(join(tmpDir, ".spectra", "generate.lock"), "{}");

    // Generate once to populate the lock
    await generate(tmpDir, {
      templateId: "feature-to-tests",
      specId: "feat:det-test",
      specVersion: "1.0.0",
      target: "tests",
    });

    // Now audit — should be deterministic since same inputs produce same output
    const result = await auditDeterminism(tmpDir, "feat:det-test", "1.0.0", "tests");
    expect(result.deterministic).toBe(true);
    expect(result.message).toContain("deterministic");
    expect(result.locked_hash).toBeDefined();
    expect(result.regenerated_hash).toBeDefined();
    expect(result.locked_hash).toBe(result.regenerated_hash);
  });
});
