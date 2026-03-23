import { describe, it, expect, beforeEach } from "vitest";
import { mkdir, rm, readFile, access, writeFile, stat } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { parse } from "yaml";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "..", "..");
const CLI_PATH = join(PROJECT_ROOT, "src", "cli", "index.ts");
const TEST_DIR = join(tmpdir(), "spectra-test-init-" + Date.now());

/** Known scaffold file paths relative to the .claude/ target directory */
const EXPECTED_SCAFFOLD_FILES = [
  "settings.json",
  join("agents", "spectra-reviewer.md"),
  join("hooks", "spectra-pre-edit-guard.sh"),
  join("hooks", "spectra-post-edit.sh"),
  join("hooks", "spectra-session-start.sh"),
  join("commands", "spectra-status.md"),
  join("rules", "spectra-spec-editing.md"),
  join("rules", "spectra-code-generation.md"),
  join("skills", "spectra-setup", "SKILL.md"),
  join("skills", "spectra-specify", "SKILL.md"),
  join("skills", "spectra-design", "SKILL.md"),
  join("skills", "spectra-implement", "SKILL.md"),
  join("skills", "spectra-reconcile", "SKILL.md"),
  join("skills", "spectra-test-design", "SKILL.md"),
];

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

  it("sets ai_tools.adapter to none when no AI tool is detected", async () => {
    execSync(`npx tsx ${CLI_PATH} init`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const config = parse(
      await readFile(join(TEST_DIR, ".spectra", "config.yaml"), "utf8")
    );
    expect(config.ai_tools.adapter).toBe("none");
  });

  it("sets ai_tools.adapter to claude-code when --claude flag is used", async () => {
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const config = parse(
      await readFile(join(TEST_DIR, ".spectra", "config.yaml"), "utf8")
    );
    expect(config.ai_tools.adapter).toBe("claude-code");
  });

  it("creates .claude/ scaffold files when --claude flag is used", async () => {
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const claudeDir = join(TEST_DIR, ".claude");
    for (const relPath of EXPECTED_SCAFFOLD_FILES) {
      await expect(access(join(claudeDir, relPath))).resolves.toBeUndefined();
    }
  });

  it("makes hook scripts executable when --claude flag is used", async () => {
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const claudeDir = join(TEST_DIR, ".claude");
    const hookFiles = [
      "spectra-pre-edit-guard.sh",
      "spectra-post-edit.sh",
      "spectra-session-start.sh",
    ];
    for (const hookFile of hookFiles) {
      const fileStat = await stat(join(claudeDir, "hooks", hookFile));
      // Check executable bits (owner, group, or other)
      expect(fileStat.mode & 0o111).toBeGreaterThan(0);
    }
  });

  it("auto-detects claude-code when .claude directory already exists in project", async () => {
    // Pre-create a .claude directory to simulate an existing Claude Code project
    await mkdir(join(TEST_DIR, ".claude"), { recursive: true });

    execSync(`npx tsx ${CLI_PATH} init`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const config = parse(
      await readFile(join(TEST_DIR, ".spectra", "config.yaml"), "utf8")
    );
    expect(config.ai_tools.adapter).toBe("claude-code");
  });

  it("installs scaffolds to $HOME/.claude when --global flag is used", async () => {
    // Use a temporary directory as a fake HOME to avoid polluting the real home
    const fakeHome = join(TEST_DIR, "fake-home");
    await mkdir(fakeHome, { recursive: true });

    execSync(`npx tsx ${CLI_PATH} init --claude --global`, {
      cwd: TEST_DIR,
      env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome },
      encoding: "utf8",
    });

    const globalClaudeDir = join(fakeHome, ".claude");
    for (const relPath of EXPECTED_SCAFFOLD_FILES) {
      await expect(
        access(join(globalClaudeDir, relPath))
      ).resolves.toBeUndefined();
    }

    // Local .claude should NOT have been created
    await expect(access(join(TEST_DIR, ".claude"))).rejects.toThrow();
  });

  it("does not overwrite existing scaffold files when .claude/ already has customizations", async () => {
    // Pre-create .claude/settings.json with custom content (simulating an existing Claude config)
    const claudeDir = join(TEST_DIR, ".claude");
    await mkdir(claudeDir, { recursive: true });
    const customSettings = JSON.stringify({ custom: true, sentinel: "do-not-overwrite" });
    await writeFile(join(claudeDir, "settings.json"), customSettings);

    // Run init --claude — auto-detects .claude/ but must NOT overwrite the existing settings.json
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const afterContent = await readFile(join(claudeDir, "settings.json"), "utf8");
    expect(afterContent).toBe(customSettings);
  });

  it("does not overwrite scaffold files once .spectra is initialized (re-init guard)", async () => {
    // First init with --claude writes scaffolds
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    const scaffoldFile = join(TEST_DIR, ".claude", "settings.json");
    const originalContent = await readFile(scaffoldFile, "utf8");

    // Overwrite the scaffold file with sentinel content
    const sentinel = JSON.stringify({ sentinel: true });
    await writeFile(scaffoldFile, sentinel);

    // Second init is blocked by the "already initialized" guard
    const output = execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    expect(output).toContain("already initialized");

    // The sentinel content must still be intact (scaffold was not overwritten)
    const afterContent = await readFile(scaffoldFile, "utf8");
    expect(afterContent).toBe(sentinel);
    expect(afterContent).not.toBe(originalContent);
  });

  it("does not overwrite pre-existing .claude/ files on first init", async () => {
    // Pre-create .claude/ with a customized settings.json before any spectra init
    const claudeDir = join(TEST_DIR, ".claude");
    await mkdir(claudeDir, { recursive: true });
    const sentinel = JSON.stringify({ customized: true });
    await writeFile(join(claudeDir, "settings.json"), sentinel);

    // Run spectra init --claude for the first time
    execSync(`npx tsx ${CLI_PATH} init --claude`, {
      cwd: TEST_DIR,
      encoding: "utf8",
    });

    // The pre-existing file must not have been overwritten
    const afterContent = await readFile(join(claudeDir, "settings.json"), "utf8");
    expect(afterContent).toBe(sentinel);

    // Other scaffold files that did NOT pre-exist should have been created
    await expect(
      access(join(claudeDir, "hooks", "spectra-pre-edit-guard.sh"))
    ).resolves.toBeUndefined();
  });
});
