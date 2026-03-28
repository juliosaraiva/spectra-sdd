import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli", "index.ts");

function run(argv: string[], cwd: string): string {
  return execFileSync("npx", ["tsx", CLI_PATH, ...argv], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, HOME: cwd },
  });
}

describe("spectra trace", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-trace-"));
    run(["init"], tmpDir);
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("trace update runs without error on empty project", () => {
    const output = run(["trace", "update"], tmpDir);
    expect(output).toContain("index updated");
  });

  it("trace update rebuilds index after spec creation", () => {
    run(["spec", "new", "test-feature"], tmpDir);
    const output = run(["trace", "update"], tmpDir);
    expect(output).toContain("index updated");
  });

  it("trace forward reports no trace entry for unknown spec", () => {
    const output = run(["trace", "forward", "feat:does-not-exist"], tmpDir);
    expect(output).toContain("No trace entry found");
  });

  it("trace why reports no ancestry for untracked file", () => {
    const output = run(["trace", "why", "src/unknown.ts"], tmpDir);
    expect(output).toContain("No trace ancestry found");
  });
});
