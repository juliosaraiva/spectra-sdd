import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, access, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFeatureSpecMd } from "../../src/core/frontmatter.js";

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

describe("spectra spec", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-spec-"));
    run("init", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("spec new creates a spec file in .spectra/features/", async () => {
    const output = run("spec new test-feature", tmpDir);

    expect(output).toContain("feat:test-feature");

    await access(join(tmpDir, ".spectra", "features", "test-feature.spec.md"));

    const raw = await readFile(
      join(tmpDir, ".spectra", "features", "test-feature.spec.md"),
      "utf8"
    );
    const parsed = parseFeatureSpecMd(raw);
    expect((parsed.spectra as Record<string, unknown>).id).toBe("feat:test-feature");
    expect((parsed.spectra as Record<string, unknown>).type).toBe("feature");
  });

  it("spec list shows features after creation", () => {
    run("spec new test-feature", tmpDir);
    const output = run("spec list", tmpDir);

    expect(output).toContain("feat:test-feature");
  });

  it("spec list shows no features on a fresh project", () => {
    const output = run("spec list", tmpDir);
    expect(output).toContain("No feature specs found");
  });

  it("spec show displays the spec content", () => {
    run("spec new test-feature", tmpDir);
    const output = run("spec show feat:test-feature", tmpDir);

    expect(output).toContain("feat:test-feature");
    expect(output).toContain("feature");
  });

  it("spec show reports not found for unknown spec", () => {
    const output = run("spec show feat:does-not-exist", tmpDir);
    expect(output).toContain("not found");
  });

  it("spec rehash updates the hash block", async () => {
    run("spec new test-feature", tmpDir);
    const output = run("spec rehash feat:test-feature", tmpDir);

    expect(output).toContain("sha256:");

    const raw = await readFile(
      join(tmpDir, ".spectra", "features", "test-feature.spec.md"),
      "utf8"
    );
    const parsed = parseFeatureSpecMd(raw);
    expect(parsed.hash).toBeDefined();
    expect((parsed.hash as Record<string, unknown>).content_hash).toMatch(/^sha256:/);
  });

  it("spec new with no name fails gracefully", () => {
    let threw = false;
    try {
      run("spec new", tmpDir);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  });
});
