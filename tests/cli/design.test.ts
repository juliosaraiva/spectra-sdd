import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readdir, readFile } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseImplSpecMd } from "../../src/core/frontmatter.js";

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

describe("spectra design", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(
      tmpdir(),
      "spectra-test-design-" + Date.now() + "-" + Math.random().toString(36).slice(2)
    );
    await mkdir(tmpDir, { recursive: true });
    run("init", tmpDir);
    run("spec new test-feature", tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("design creates impl specs in .spectra/impl/", async () => {
    const output = run("design feat:test-feature", tmpDir);

    expect(output).toContain(".spectra/impl/test-feature/");

    const implDir = join(tmpDir, ".spectra", "impl", "test-feature");
    const files = await readdir(implDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => f.endsWith(".impl.md"))).toBe(true);
  });

  it("generated impl spec IDs use hyphens not dots", async () => {
    run("design feat:test-feature", tmpDir);

    const implDir = join(tmpDir, ".spectra", "impl", "test-feature");
    const files = await readdir(implDir);

    for (const file of files) {
      const raw = await readFile(join(implDir, file), "utf8");
      const parsed = parseImplSpecMd(raw);
      const id: string = (parsed.spectra as Record<string, unknown>).id as string;
      // ID must not contain dots (concern dots are converted to hyphens)
      expect(id).not.toContain(".");
      expect(id).toMatch(/^impl:/);
    }
  });

  it("design with custom concerns creates matching impl files", async () => {
    const output = run("design feat:test-feature --concerns api.rest,db.sql", tmpDir);

    expect(output).toContain("api-rest.impl.md");
    expect(output).toContain("db-sql.impl.md");

    const implDir = join(tmpDir, ".spectra", "impl", "test-feature");
    const files = await readdir(implDir);
    expect(files).toContain("api-rest.impl.md");
    expect(files).toContain("db-sql.impl.md");
  });

  it("design fails when feature spec does not exist", () => {
    const output = run("design feat:no-such-feature", tmpDir);
    expect(output).toContain("not found");
  });
});
