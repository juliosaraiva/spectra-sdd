import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, rm, readFile, access } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli", "index.ts");
const TEST_DIR = join(tmpdir(), "spectra-test-init-" + Date.now());

beforeEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
  await mkdir(TEST_DIR, { recursive: true });
});

describe("spectra init", () => {
  it("creates the .spectra directory structure", async () => {
    // Run init from the test dir
    execSync(`npx tsx ${CLI_PATH} init`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const spectraDir = join(TEST_DIR, ".spectra");

    // Check directories exist
    await access(join(spectraDir, "features"));
    await access(join(spectraDir, "impl"));
    await access(join(spectraDir, "tests"));
    await access(join(spectraDir, "migrations"));
    await access(join(spectraDir, "gates"));
    await access(join(spectraDir, "templates"));
    await access(join(spectraDir, "adapters"));

    // Check files exist
    const config = parse(await readFile(join(spectraDir, "config.yaml"), "utf8"));
    expect(config.spectra.version).toBe("1.0");

    const constitution = parse(await readFile(join(spectraDir, "constitution.yaml"), "utf8"));
    expect(constitution.constraints.length).toBeGreaterThan(0);

    const index = parse(await readFile(join(spectraDir, "features", "_index.yaml"), "utf8"));
    expect(index.features).toEqual([]);

    const trace = JSON.parse(await readFile(join(spectraDir, "trace.json"), "utf8"));
    expect(trace.version).toBe("1.0");
  });

  it("is idempotent - does not overwrite existing", async () => {
    // First init
    execSync(`npx tsx ${CLI_PATH} init`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    // Second init should not error
    const output = execSync(`npx tsx ${CLI_PATH} init`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    expect(output).toContain("already initialized");
  });
});
