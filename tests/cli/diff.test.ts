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

describe("spectra diff", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-diff-"));
    run("init", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("diff runs without error on a fresh project", () => {
    const output = run("diff", tmpDir);
    expect(output).toContain("Drift Report");
    expect(output).toContain("Score");
  });

  it("diff shows no drift on a fresh project", () => {
    const output = run("diff", tmpDir);
    expect(output).toContain("No drift detected");
  });

  it("diff --json outputs valid JSON", () => {
    const output = run("diff --json", tmpDir);
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("project_drift_score");
    expect(parsed).toHaveProperty("items");
    expect(parsed).toHaveProperty("features");
  });

  it("diff --json score is 0 on a fresh project", () => {
    const output = run("diff --json", tmpDir);
    const parsed = JSON.parse(output);
    expect(parsed.project_drift_score).toBe(0);
    expect(parsed.items).toHaveLength(0);
  });
});
