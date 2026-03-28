import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";

import { generate } from "../../src/engine/generator.js";
import { lockGeneration, isLocked, readLockEntry, generateId } from "../../src/engine/lock.js";
import { enforceSchema } from "../../src/engine/schema-enforcer.js";
import {
  loadTemplate,
  loadTemplateById,
  loadTemplateRaw,
  listTemplates,
} from "../../src/engine/template-loader.js";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const FEATURE_SPEC_YAML = `\
spectra:
  version: "1.0"
  type: feature
  id: "feat:test-feature"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors: ["@user"]
identity:
  title: "Test Feature"
  domain: ["security"]
  summary: "A test feature"
acceptance_criteria:
  - id: "AC-001"
    title: "Test AC"
    given: "a condition"
    when: "something happens"
    then: ["expected result"]
    non_negotiable: true
`;

const CONSTITUTION_YAML = `\
spectra:
  version: "1.0"
  type: constitution
  semver: "1.0.0"
  updated: "2026-03-22T10:00:00Z"
  stewards: ["@team"]
vocabulary: ["security"]
constraints:
  - id: "SEC-001"
    title: "Test constraint"
    description: "A test"
    domain: ["security"]
    enforcement: "MUST"
`;

const TEMPLATE_CONTENT = `\
Feature: {{spec.identity.title}}
{{#each spec.acceptance_criteria}}
AC: {{this.id}} - {{this.title}}
{{/each}}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function makeProjectDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "spectra-engine-test-"));
  const spectraDir = join(dir, ".spectra");

  await mkdir(join(spectraDir, "features"), { recursive: true });
  await mkdir(join(spectraDir, "templates"), { recursive: true });
  await mkdir(join(spectraDir, "gates"), { recursive: true });

  // Write generate.lock
  await writeFile(join(spectraDir, "generate.lock"), JSON.stringify({}));
  // Write constitution
  await writeFile(join(spectraDir, "constitution.yaml"), CONSTITUTION_YAML);
  // Write feature spec
  await writeFile(join(spectraDir, "features", "test-feature.spec.yaml"), FEATURE_SPEC_YAML);

  return dir;
}

// ─── generator.ts ────────────────────────────────────────────────────────────

describe("generate()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns success with rendered output for valid spec + template", async () => {
    await writeFile(
      join(projectRoot, ".spectra", "templates", "feature-prompt.tmpl"),
      TEMPLATE_CONTENT
    );

    const result = await generate(projectRoot, {
      templateId: "feature-prompt",
      specId: "feat:test-feature",
      specVersion: "1.0.0",
      target: "tests",
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("Feature: Test Feature");
    expect(result.output).toContain("AC: AC-001 - Test AC");
    expect(result.skipped).toBeUndefined();
  });

  it("returns skipped:true on second call with same inputs (lock hit)", async () => {
    await writeFile(
      join(projectRoot, ".spectra", "templates", "feature-prompt.tmpl"),
      TEMPLATE_CONTENT
    );

    const opts = {
      templateId: "feature-prompt",
      specId: "feat:test-feature",
      specVersion: "1.0.0",
      target: "tests",
    };

    // First call — should generate
    const first = await generate(projectRoot, opts);
    expect(first.success).toBe(true);
    expect(first.skipped).toBeUndefined();

    // Second call — should be a lock hit
    const second = await generate(projectRoot, opts);
    expect(second.success).toBe(true);
    expect(second.skipped).toBe(true);
  });

  it("returns success:false when spec file not found", async () => {
    await writeFile(
      join(projectRoot, ".spectra", "templates", "feature-prompt.tmpl"),
      TEMPLATE_CONTENT
    );

    const result = await generate(projectRoot, {
      templateId: "feature-prompt",
      specId: "feat:missing-feature",
      specVersion: "1.0.0",
      target: "tests",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Spec file not found");
  });

  it("returns success:false when template not found", async () => {
    const result = await generate(projectRoot, {
      templateId: "nonexistent-template",
      specId: "feat:test-feature",
      specVersion: "1.0.0",
      target: "tests",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Template not found");
  });

  it("injects constitutional context from constitution.yaml", async () => {
    const tmpl = `Constitutional: {{constitutional_context}}`;
    await writeFile(join(projectRoot, ".spectra", "templates", "ctx-test.tmpl"), tmpl);

    const result = await generate(projectRoot, {
      templateId: "ctx-test",
      specId: "feat:test-feature",
      specVersion: "1.0.0",
      target: "tests",
    });

    expect(result.success).toBe(true);
    // The spec has domain:["security"] which matches SEC-001 constraint
    expect(result.output).toContain("SEC-001");
  });
});

// ─── lock.ts ─────────────────────────────────────────────────────────────────

describe("lockGeneration()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("writes an entry to generate.lock", async () => {
    const entry = await lockGeneration(projectRoot, "feat:test", "1.0.0", "impl", {
      template_id: "my-tmpl",
      template_version: "1.0",
      template_hash: "sha256:" + "a".repeat(64),
      input_spec_hash: "sha256:" + "b".repeat(64),
      model: "human",
      model_params: {},
      output_hash: "sha256:" + "c".repeat(64),
    });

    expect(entry.generation_id).toMatch(/^gen:/);
    expect(entry.generated_at).toBeTruthy();

    const stored = await readLockEntry(projectRoot, "feat:test", "1.0.0", "impl");
    expect(stored?.generation_id).toBe(entry.generation_id);
  });
});

describe("isLocked()", () => {
  let projectRoot: string;
  const INPUT_HASH = "sha256:" + "a".repeat(64);
  const TMPL_HASH = "sha256:" + "b".repeat(64);
  const OTHER_HASH = "sha256:" + "c".repeat(64);

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns true when input and template hashes match", async () => {
    await lockGeneration(projectRoot, "feat:test", "1.0.0", "impl", {
      template_id: "tmpl",
      template_version: "1.0",
      template_hash: TMPL_HASH,
      input_spec_hash: INPUT_HASH,
      model: "human",
      model_params: {},
      output_hash: "sha256:" + "d".repeat(64),
    });

    const locked = await isLocked(projectRoot, "feat:test", "1.0.0", "impl", INPUT_HASH, TMPL_HASH);
    expect(locked).toBe(true);
  });

  it("returns false when input hash differs", async () => {
    await lockGeneration(projectRoot, "feat:test", "1.0.0", "impl", {
      template_id: "tmpl",
      template_version: "1.0",
      template_hash: TMPL_HASH,
      input_spec_hash: INPUT_HASH,
      model: "human",
      model_params: {},
      output_hash: "sha256:" + "d".repeat(64),
    });

    const locked = await isLocked(projectRoot, "feat:test", "1.0.0", "impl", OTHER_HASH, TMPL_HASH);
    expect(locked).toBe(false);
  });
});

describe("readLockEntry()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns null when no entry exists", async () => {
    const entry = await readLockEntry(projectRoot, "feat:nonexistent", "1.0.0", "impl");
    expect(entry).toBeNull();
  });
});

describe("generateId()", () => {
  it("returns a string matching gen: prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^gen:[0-9a-f]+$/);
  });
});

// ─── schema-enforcer.ts ───────────────────────────────────────────────────────

describe("enforceSchema()", () => {
  const schema = z.object({
    name: z.string(),
    value: z.number(),
  });

  it("validates valid YAML against a Zod schema", () => {
    const yaml = `name: hello\nvalue: 42`;
    const result = enforceSchema(yaml, schema);
    expect(result.valid).toBe(true);
    expect(result.parsed).toEqual({ name: "hello", value: 42 });
    expect(result.attempts).toBe(1);
  });

  it("returns errors for YAML that doesn't match schema", () => {
    const yaml = `name: hello\nvalue: "not-a-number"`;
    const result = enforceSchema(yaml, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
    expect(result.errors![0]).toContain("value");
  });

  it("returns invalid result when parsed content is not an object", () => {
    // Use content that is likely to be parsed as a plain YAML string (scalar),
    // not an object. The YAML/JSON parsing itself may succeed, but the result
    // will fail validation against the expected object-shaped Zod schema.
    const plainString = `{{{{totally not yaml or json: [[[`;

    // Parsed content is not an object, so enforceSchema should report invalid.
    const result = enforceSchema(plainString, schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

// ─── template-loader.ts ───────────────────────────────────────────────────────

describe("loadTemplate()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("compiles and caches a Handlebars template", async () => {
    const tmplPath = join(projectRoot, ".spectra", "templates", "cached.tmpl");
    await writeFile(tmplPath, "Hello {{name}}");

    const tpl1 = await loadTemplate(tmplPath);
    const tpl2 = await loadTemplate(tmplPath);

    // Same compiled function reference (from cache)
    expect(tpl1).toBe(tpl2);
    expect(tpl1({ name: "World" })).toBe("Hello World");
  });
});

describe("loadTemplateById()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("finds project-local templates", async () => {
    await writeFile(
      join(projectRoot, ".spectra", "templates", "my-tmpl.tmpl"),
      "Project template: {{value}}"
    );

    const tpl = await loadTemplateById(projectRoot, "my-tmpl");
    expect(tpl).not.toBeNull();
    expect(tpl!({ value: "ok" })).toBe("Project template: ok");
  });
});

describe("loadTemplateRaw()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns raw template string", async () => {
    const content = "Raw template {{placeholder}}";
    await writeFile(join(projectRoot, ".spectra", "templates", "raw-tmpl.tmpl"), content);

    const raw = await loadTemplateRaw(projectRoot, "raw-tmpl");
    expect(raw).toBe(content);
  });
});

describe("listTemplates()", () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await makeProjectDir();
  });

  afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
  });

  it("returns template IDs from project directory", async () => {
    const templatesDir = join(projectRoot, ".spectra", "templates");
    await writeFile(join(templatesDir, "alpha.tmpl"), "a");
    await writeFile(join(templatesDir, "beta.tmpl"), "b");
    await writeFile(join(templatesDir, "not-a-template.txt"), "ignored");

    const ids = await listTemplates(projectRoot);
    expect(ids).toContain("alpha");
    expect(ids).toContain("beta");
    expect(ids).not.toContain("not-a-template");
    expect(ids).not.toContain("not-a-template.txt");
  });
});
