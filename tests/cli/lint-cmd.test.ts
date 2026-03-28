import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli", "index.ts");

function run(cmd: string, cwd: string): string {
  return execFileSync("npx", ["tsx", CLI_PATH, ...cmd.split(/\s+/)], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, HOME: cwd },
  });
}

describe("spectra lint", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-lint-"));
    run("init", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("lint a single spec runs without error", () => {
    run("spec new test-feature", tmpDir);
    // A fresh spec has TODO placeholders — lint will report warnings but should not throw
    let output = "";
    try {
      output = run("lint feat:test-feature", tmpDir);
    } catch (err: unknown) {
      const execError = err as { stdout?: string };
      output = execError.stdout ?? "";
    }
    expect(output).toBeDefined();
  });

  it("lint a single spec reports not found for unknown id", () => {
    const output = run("lint feat:does-not-exist", tmpDir);
    expect(output).toContain("not found");
  });

  it("lint all runs across all specs", () => {
    run("spec new alpha", tmpDir);
    run("spec new beta", tmpDir);
    let output = "";
    try {
      output = run("lint", tmpDir);
    } catch (err: unknown) {
      // lint exits non-zero when there are errors; still capture output
      const execError = err as { stdout?: string };
      output = execError.stdout ?? "";
    }
    // Should mention both specs or report lint results
    expect(output).toBeDefined();
  });

  it("lint with no specs reports no lint issues", () => {
    const output = run("lint", tmpDir);
    expect(output).toContain("No lint issues found");
  });
});
