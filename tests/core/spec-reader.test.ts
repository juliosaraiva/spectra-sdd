import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isFeatureSpec,
  isImplSpec,
  isMarkdownSpec,
  readSpecFile,
  resolveSpecFile,
  parseSpecContent,
} from "../../src/core/spec-reader.js";

describe("isFeatureSpec", () => {
  it("matches .spec.yaml", () => expect(isFeatureSpec("auth.spec.yaml")).toBe(true));
  it("matches .spec.yml", () => expect(isFeatureSpec("auth.spec.yml")).toBe(true));
  it("matches .spec.md", () => expect(isFeatureSpec("auth.spec.md")).toBe(true));
  it("rejects .impl.yaml", () => expect(isFeatureSpec("auth.impl.yaml")).toBe(false));
  it("rejects .test.yaml", () => expect(isFeatureSpec("auth.test.yaml")).toBe(false));
  it("rejects random file", () => expect(isFeatureSpec("README.md")).toBe(false));
});

describe("isImplSpec", () => {
  it("matches .impl.yaml", () => expect(isImplSpec("rest.impl.yaml")).toBe(true));
  it("matches .impl.yml", () => expect(isImplSpec("rest.impl.yml")).toBe(true));
  it("matches .impl.md", () => expect(isImplSpec("rest.impl.md")).toBe(true));
  it("rejects .spec.yaml", () => expect(isImplSpec("auth.spec.yaml")).toBe(false));
});

describe("isMarkdownSpec", () => {
  it("matches .spec.md", () => expect(isMarkdownSpec("test.spec.md")).toBe(true));
  it("matches .impl.md", () => expect(isMarkdownSpec("test.impl.md")).toBe(true));
  it("rejects .spec.yaml", () => expect(isMarkdownSpec("test.spec.yaml")).toBe(false));
});

describe("parseSpecContent", () => {
  const yamlContent = `spectra:\n  type: feature\n  id: "feat:test"\nidentity:\n  title: Test`;
  const mdContent = `---\nspectra:\n  type: feature\n  id: "feat:test"\n  semver: "1.0.0"\n  status: draft\n  created: "2026-01-01T00:00:00Z"\n  updated: "2026-01-01T00:00:00Z"\n  authors: ["@user"]\nidentity:\n  title: Test\n  domain: [general]\n  tags: []\n  summary: A test\n---\n\n## AC-001: Basic\n\n> non_negotiable: true\n\n**Given** ctx\n**When** act\n**Then:**\n- result\n`;

  it("parses YAML file by extension", () => {
    const result = parseSpecContent(yamlContent, "test.spec.yaml");
    expect((result.spectra as Record<string, unknown>).type).toBe("feature");
  });

  it("parses Markdown feature spec by extension", () => {
    const result = parseSpecContent(mdContent, "test.spec.md");
    expect((result.spectra as Record<string, unknown>).type).toBe("feature");
    expect(result.acceptance_criteria).toBeDefined();
    expect(result.acceptance_criteria as Array<unknown>).toHaveLength(1);
  });

  it("parses Markdown impl spec by extension", () => {
    const implMd = `---\nspectra:\n  type: impl\n  id: "impl:test-rest"\n  semver: "1.0.0"\n  status: draft\n  created: "2026-01-01T00:00:00Z"\n  updated: "2026-01-01T00:00:00Z"\n  authors: ["@user"]\n  feature_ref: "feat:test@1.0.0"\n  concern: transport.rest\n---\n\n# Design\n\nBody content\n`;
    const result = parseSpecContent(implMd, "rest.impl.md");
    expect((result.spectra as Record<string, unknown>).type).toBe("impl");
    expect((result.design as Record<string, unknown>).description).toContain("Body content");
  });
});

describe("readSpecFile and resolveSpecFile", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "spectra-reader-"));
    await mkdir(join(tempDir, "features"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("reads a YAML spec file", async () => {
    const yaml = `spectra:\n  type: feature\n  id: "feat:test"\nidentity:\n  title: Test`;
    await writeFile(join(tempDir, "features", "test.spec.yaml"), yaml);

    const { raw, parsed } = await readSpecFile(join(tempDir, "features", "test.spec.yaml"));
    expect(raw).toBe(yaml);
    expect((parsed.spectra as Record<string, unknown>).id).toBe("feat:test");
  });

  it("reads a Markdown spec file", async () => {
    const md = `---\nspectra:\n  type: feature\n  id: "feat:test"\n  semver: "1.0.0"\n  status: draft\n  created: "2026-01-01T00:00:00Z"\n  updated: "2026-01-01T00:00:00Z"\n  authors: ["@user"]\nidentity:\n  title: Test\n  domain: [general]\n  tags: []\n  summary: Test\n---\n\n## AC-001: First\n\n> non_negotiable: true\n\n**Given** ctx\n**When** act\n**Then:**\n- outcome\n`;
    await writeFile(join(tempDir, "features", "test.spec.md"), md);

    const { parsed } = await readSpecFile(join(tempDir, "features", "test.spec.md"));
    expect((parsed.spectra as Record<string, unknown>).id).toBe("feat:test");
    expect(parsed.acceptance_criteria as Array<Record<string, unknown>>).toHaveLength(1);
  });

  it("resolveSpecFile prefers .md over .yaml", async () => {
    await writeFile(join(tempDir, "features", "test.spec.md"), "---\nkey: md\n---\nbody");
    await writeFile(join(tempDir, "features", "test.spec.yaml"), "key: yaml");

    const resolved = await resolveSpecFile(join(tempDir, "features"), "test", "spec");
    expect(resolved).toContain(".spec.md");
  });

  it("resolveSpecFile falls back to .yaml when .md absent", async () => {
    await writeFile(join(tempDir, "features", "test.spec.yaml"), "key: yaml");

    const resolved = await resolveSpecFile(join(tempDir, "features"), "test", "spec");
    expect(resolved).toContain(".spec.yaml");
  });
});
