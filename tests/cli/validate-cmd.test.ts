import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli", "index.ts");

function run(cmd: string, cwd: string): string {
  return execSync(`npx tsx ${CLI_PATH} ${cmd}`, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, HOME: cwd },
  });
}

describe("spectra validate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      "spectra-test-validate-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    );
    await mkdir(tmpDir, { recursive: true });
    run("init", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("validate a single spec", () => {
    run("spec new test-feature", tmpDir);
    const output = run("validate feat:test-feature", tmpDir);
    expect(output).toContain("PASS");
  });

  it("validate a single spec reports not found for unknown id", () => {
    const output = run("validate feat:does-not-exist", tmpDir);
    expect(output).toContain("not found");
  });

  it("validate all runs across all specs", () => {
    run("spec new alpha", tmpDir);
    run("spec new beta", tmpDir);
    const output = run("validate", tmpDir);
    // Should validate both and report them
    expect(output).toMatch(/PASS|valid|specs are valid/i);
  });

  it("validate with no feature specs shows only constitution", () => {
    const output = run("validate", tmpDir);
    expect(output).toContain("constitution.yaml");
    expect(output).not.toMatch(/feat:/);
  });

  it("validate --cross-refs runs cross-reference validation", () => {
    run("spec new test-feature", tmpDir);
    // Should not throw; cross-ref validation on a valid spec should pass or give no errors
    const output = run("validate feat:test-feature --cross-refs", tmpDir);
    expect(output).toBeDefined();
  });
});
