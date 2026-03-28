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

describe("spectra gate", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-gate-"));
    run("init", tmpDir);
    run("spec new test-feat", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("gate sign creates a gate file for the specify phase", () => {
    const output = run("gate sign feat:test-feat --phase specify", tmpDir);
    expect(output).toContain("Gate signed");
    expect(output).toContain("feat:test-feat");
    expect(output).toContain("specify");
  });

  it("gate sign for design phase fails without specify gate", () => {
    let output = "";
    try {
      output = run("gate sign feat:test-feat --phase design", tmpDir);
    } catch (err: unknown) {
      // execFileSync throws on non-zero exit; capture stdout from error
      const execError = err as { stdout?: string; stderr?: string };
      output = execError.stdout ?? execError.stderr ?? "";
    }
    // The command exits 0 but prints an error message about missing prerequisites
    expect(output).toMatch(/missing prerequisite|Cannot sign/i);
  });

  it("gate sign design with --force bypasses ordering", () => {
    const output = run("gate sign feat:test-feat --phase design --force", tmpDir);
    expect(output).toContain("Gate signed");
    expect(output).toContain("design");
  });

  it("gate list shows signed gates", () => {
    run("gate sign feat:test-feat --phase specify", tmpDir);
    const output = run("gate list", tmpDir);

    expect(output).toContain("feat:test-feat");
    expect(output).toContain("specify");
    expect(output).toContain("approved");
  });

  it("gate list with spec-id filter shows only that spec's gates", () => {
    run("gate sign feat:test-feat --phase specify", tmpDir);
    const output = run("gate list feat:test-feat", tmpDir);

    expect(output).toContain("feat:test-feat");
  });

  it("gate list shows 'No gates' on fresh project", () => {
    const output = run("gate list", tmpDir);
    expect(output).toContain("No gates found");
  });

  it("gate check reports missing gates for design phase", () => {
    const output = run("gate check feat:test-feat --phase design", tmpDir);
    expect(output).toContain("Not ready");
    expect(output).toContain("specify");
  });

  it("gate check reports ready when prerequisites are signed", () => {
    run("gate sign feat:test-feat --phase specify", tmpDir);
    const output = run("gate check feat:test-feat --phase design", tmpDir);
    expect(output).toContain("Ready");
  });

  it("gate expire expires all gates for a spec", () => {
    run("gate sign feat:test-feat --phase specify", tmpDir);
    const expireOut = run("gate expire feat:test-feat", tmpDir);
    expect(expireOut).toContain("Expired");
    expect(expireOut).toContain("feat:test-feat");

    const listOut = run("gate list feat:test-feat", tmpDir);
    expect(listOut).toContain("expired");
  });

  it("gate verify reports valid after signing", () => {
    run("gate sign feat:test-feat --phase specify", tmpDir);
    const output = run("gate verify feat:test-feat --phase specify", tmpDir);
    expect(output).toContain("valid");
  });
});
