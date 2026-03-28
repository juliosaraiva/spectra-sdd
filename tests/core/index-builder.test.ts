import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse } from "yaml";
import { rebuildIndex } from "../../src/core/index-builder.js";

let TEST_DIR: string;
let FEATURES_DIR: string;
let IMPL_DIR: string;
let TESTS_DIR: string;

function makeFeatureSpec(id: string, title: string, domain: string[] = ["security"]) {
  return `spectra:
  version: "1.0"
  type: feature
  id: "${id}"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors: ["@user"]
identity:
  title: "${title}"
  domain: ${JSON.stringify(domain)}
  summary: "A test feature"
acceptance_criteria:
  - id: "AC-001"
    title: "Test"
    given: "a condition"
    when: "something happens"
    then: ["expected result"]
    non_negotiable: true
`;
}

beforeEach(async () => {
  TEST_DIR = await mkdtemp(join(tmpdir(), "spectra-test-index-builder-"));
  const SPECTRA_DIR = join(TEST_DIR, ".spectra");
  FEATURES_DIR = join(SPECTRA_DIR, "features");
  IMPL_DIR = join(SPECTRA_DIR, "impl");
  TESTS_DIR = join(SPECTRA_DIR, "tests");
  await mkdir(FEATURES_DIR, { recursive: true });
  await mkdir(IMPL_DIR, { recursive: true });
  await mkdir(TESTS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("rebuildIndex", () => {
  it("creates _index.yaml with entries for feature specs", async () => {
    await writeFile(
      join(FEATURES_DIR, "feat_auth.spec.yaml"),
      makeFeatureSpec("feat:auth", "Authentication")
    );

    const index = await rebuildIndex(TEST_DIR);
    expect(index.features).toHaveLength(1);
    expect(index.features[0].id).toBe("feat:auth");
    expect(index.features[0].title).toBe("Authentication");
    expect(index.features[0].status).toBe("draft");

    // Verify the file was written
    const written = await readFile(join(FEATURES_DIR, "_index.yaml"), "utf8");
    const parsed = parse(written);
    expect(parsed.features).toHaveLength(1);
  });

  it("counts impl specs correctly", async () => {
    await writeFile(
      join(FEATURES_DIR, "feat_payments.spec.yaml"),
      makeFeatureSpec("feat:payments", "Payments")
    );

    const featureImplDir = join(IMPL_DIR, "payments");
    await mkdir(featureImplDir, { recursive: true });
    await writeFile(join(featureImplDir, "transport-rest.impl.yaml"), "spec: {}");
    await writeFile(join(featureImplDir, "persistence-db.impl.yaml"), "spec: {}");
    // non-impl file should not be counted
    await writeFile(join(featureImplDir, "notes.txt"), "some notes");

    const index = await rebuildIndex(TEST_DIR);
    expect(index.features[0].impl_count).toBe(2);
  });

  it("counts test cases correctly", async () => {
    await writeFile(
      join(FEATURES_DIR, "feat_auth.spec.yaml"),
      makeFeatureSpec("feat:auth", "Authentication")
    );

    const testSpec = `spectra:
  version: "1.0"
  type: test
  id: "test:auth"
  semver: "1.0.0"
  status: draft
  created: "2026-03-22T10:00:00Z"
  updated: "2026-03-22T10:00:00Z"
  authors: ["@user"]
  feature_ref: "feat:auth"
test_cases:
  - id: "TC-001"
    ac_ref: "AC-001"
    title: "Test case one"
    given: "a user exists"
    when: "they login"
    then: ["they get a token"]
  - id: "TC-002"
    ac_ref: "AC-001"
    title: "Test case two"
    given: "a user exists"
    when: "they login with bad creds"
    then: ["they get a 401"]
`;
    await writeFile(join(TESTS_DIR, "auth.test.yaml"), testSpec);

    const index = await rebuildIndex(TEST_DIR);
    expect(index.features[0].test_count).toBe(2);
  });

  it("skips non-spec files", async () => {
    await writeFile(
      join(FEATURES_DIR, "feat_auth.spec.yaml"),
      makeFeatureSpec("feat:auth", "Authentication")
    );
    // These should be skipped
    await writeFile(join(FEATURES_DIR, "_index.yaml"), "# index file");
    await writeFile(join(FEATURES_DIR, "README.txt"), "readme");
    await writeFile(join(FEATURES_DIR, "notes.md"), "notes");

    const index = await rebuildIndex(TEST_DIR);
    expect(index.features).toHaveLength(1);
  });

  it("handles empty features directory", async () => {
    const index = await rebuildIndex(TEST_DIR);
    expect(index.features).toHaveLength(0);
    expect(index.spectra_index.version).toBe("1.0");
  });

  it("handles malformed spec YAML gracefully without throwing", async () => {
    await writeFile(
      join(FEATURES_DIR, "feat_auth.spec.yaml"),
      makeFeatureSpec("feat:auth", "Auth")
    );
    // Malformed: missing required spectra.id and identity.title
    await writeFile(join(FEATURES_DIR, "feat_broken.spec.yaml"), "not: valid\nspec: data\n");

    // Should not throw, and should only include the valid spec
    const index = await rebuildIndex(TEST_DIR);
    expect(index.features).toHaveLength(1);
    expect(index.features[0].id).toBe("feat:auth");
  });
});
