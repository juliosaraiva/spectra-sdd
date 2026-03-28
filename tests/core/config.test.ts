import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stringify } from "yaml";
import { loadConfig, DEFAULT_CONFIG } from "../../src/core/config.js";

describe("loadConfig", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "spectra-test-config-"));
    await mkdir(join(tmpDir, ".spectra"), { recursive: true });
  });

  afterEach(async () => {
    if (!tmpDir) return;
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns DEFAULT_CONFIG when config.yaml does not exist", async () => {
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns DEFAULT_CONFIG when config.yaml is invalid YAML", async () => {
    await writeFile(join(tmpDir, ".spectra", "config.yaml"), ":\ninvalid: yaml: [[\n");
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns DEFAULT_CONFIG when config.yaml fails schema validation", async () => {
    await writeFile(join(tmpDir, ".spectra", "config.yaml"), stringify({ spectra: {} }));
    const config = await loadConfig(tmpDir);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  it("returns parsed config when config.yaml is valid", async () => {
    const validConfig = {
      spectra: { version: "1.0", project_id: "test-project" },
    };
    await writeFile(join(tmpDir, ".spectra", "config.yaml"), stringify(validConfig));
    const config = await loadConfig(tmpDir);
    expect(config.spectra.project_id).toBe("test-project");
  });
});
