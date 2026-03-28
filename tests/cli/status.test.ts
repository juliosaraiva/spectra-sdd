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

describe("spectra status", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-status-"));
    run("init", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("status shows project overview", () => {
    const output = run("status", tmpDir);
    expect(output).toContain("SPECTRA");
    expect(output).toContain("Total specs");
  });

  it("status shows project overview with features", () => {
    run("spec new alpha", tmpDir);
    run("spec new beta", tmpDir);
    const output = run("status", tmpDir);
    expect(output).toContain("Total specs: 2");
  });

  it("status <spec-id> shows per-spec status", () => {
    run("spec new test-feature", tmpDir);
    const output = run("status feat:test-feature", tmpDir);

    expect(output).toContain("feat:test-feature");
    expect(output).toContain("Version");
    expect(output).toContain("Status");
  });

  it("status <spec-id> reports not found for unknown spec", () => {
    const output = run("status feat:does-not-exist", tmpDir);
    expect(output).toContain("not found");
  });

  it("status shows gate information after signing", () => {
    run("spec new test-feature", tmpDir);
    run("gate sign feat:test-feature --phase specify", tmpDir);
    const output = run("status feat:test-feature", tmpDir);

    expect(output).toContain("Gates");
    expect(output).toContain("specify");
    expect(output).toContain("approved");
  });
});
