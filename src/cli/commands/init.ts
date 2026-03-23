import { Command } from "commander";
import {
  mkdir,
  writeFile,
  access,
  readdir,
  copyFile,
  chmod,
} from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import chalk from "chalk";
import { SPECTRA_DIR, DEFAULT_CONFIG } from "../../core/config.js";
import { defaultConstitution, constitutionToYaml } from "../../core/constitution.js";

type AiTool = "claude-code" | null;

async function detectAiTool(projectRoot: string): Promise<AiTool> {
  try {
    await access(join(projectRoot, ".claude"));
    return "claude-code";
  } catch {
    return null;
  }
}

async function findScaffoldsDir(): Promise<string | null> {
  // Resolve scaffolds/ relative to the package root.
  // Works from both dist/index.js (production) and src/cli/commands/init.ts (dev via tsx).
  const base = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    join(base, "..", "scaffolds"),         // from dist/
    join(base, "..", "..", "..", "scaffolds"), // from src/cli/commands/
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

async function copyScaffolds(
  src: string,
  dest: string
): Promise<string[]> {
  const copied: string[] = [];

  async function copyRecursive(srcDir: string, destDir: string) {
    await mkdir(destDir, { recursive: true });
    const entries = await readdir(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath);
      } else {
        // Skip existing files to avoid clobbering user customizations
        try {
          await access(destPath);
          continue;
        } catch {
          // File does not exist — safe to copy
        }
        await copyFile(srcPath, destPath);
        copied.push(destPath);

        // Make hook scripts executable
        if (entry.name.endsWith(".sh")) {
          await chmod(destPath, 0o755);
        }
      }
    }
  }

  await copyRecursive(src, dest);
  return copied;
}

export const initCommand = new Command("init")
  .description("Initialize a SPECTRA project")
  .option("--brownfield", "Initialize for an existing codebase")
  .option("--project-id <id>", "Project identifier", "my-project")
  .option("--claude", "Set up Claude Code integration")
  .option("--codex", "Set up Codex integration (coming soon)")
  .option("--copilot", "Set up GitHub Copilot integration (coming soon)")
  .option("--opencode", "Set up OpenCode integration (coming soon)")
  .option("--global", "Install AI tool scaffolds to home directory (e.g., ~/.claude/)")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const spectraDir = join(projectRoot, SPECTRA_DIR);

    // Check if already initialized
    try {
      await access(spectraDir);
      console.log(chalk.yellow("SPECTRA is already initialized in this project."));
      return;
    } catch {
      // not initialized — continue
    }

    // Handle reserved flags
    if (opts.codex) {
      console.log(chalk.yellow("Codex integration is coming soon."));
      return;
    }
    if (opts.copilot) {
      console.log(chalk.yellow("GitHub Copilot integration is coming soon."));
      return;
    }
    if (opts.opencode) {
      console.log(chalk.yellow("OpenCode integration is coming soon."));
      return;
    }

    console.log(chalk.blue("Initializing SPECTRA..."));

    // Create directory structure
    const dirs = [
      spectraDir,
      join(spectraDir, "features"),
      join(spectraDir, "impl"),
      join(spectraDir, "tests"),
      join(spectraDir, "migrations"),
      join(spectraDir, "gates"),
      join(spectraDir, "templates"),
      join(spectraDir, "adapters"),
    ];

    for (const dir of dirs) {
      await mkdir(dir, { recursive: true });
    }

    // Determine AI tool
    let aiTool: AiTool = null;
    if (opts.claude) {
      aiTool = "claude-code";
    } else {
      aiTool = await detectAiTool(projectRoot);
    }

    // Write config with detected AI tool
    const config = {
      ...DEFAULT_CONFIG,
      spectra: { ...DEFAULT_CONFIG.spectra, project_id: opts.projectId },
      ai_tools: {
        ...DEFAULT_CONFIG.ai_tools,
        adapter: aiTool ?? "none",
      },
    };
    await writeFile(
      join(spectraDir, "config.yaml"),
      stringify(config, { lineWidth: 120 })
    );

    // Write constitution
    if (!opts.brownfield) {
      const constitution = defaultConstitution();
      await writeFile(
        join(spectraDir, "constitution.yaml"),
        constitutionToYaml(constitution)
      );
      await writeFile(
        join(spectraDir, "constitution.changelog"),
        `${new Date().toISOString()} | INIT | @${process.env.USER ?? "user"} | Initial constitution v1.0.0 created\n`
      );
    } else {
      // Brownfield: minimal constitution placeholder
      const constitution = defaultConstitution();
      constitution.spectra.semver = "0.1.0";
      await writeFile(
        join(spectraDir, "constitution.yaml"),
        constitutionToYaml(constitution)
      );
      await writeFile(
        join(spectraDir, "constitution.changelog"),
        `${new Date().toISOString()} | INIT | @${process.env.USER ?? "user"} | Brownfield initialization — constitution is provisional\n`
      );
    }

    // Write empty index
    const emptyIndex = {
      spectra_index: {
        version: "1.0",
        last_updated: new Date().toISOString(),
      },
      features: [],
    };
    await writeFile(
      join(spectraDir, "features", "_index.yaml"),
      stringify(emptyIndex, { lineWidth: 120 })
    );

    // Write empty trace
    const emptyTrace = {
      version: "1.0",
      updated_at: new Date().toISOString(),
      specs: {},
    };
    await writeFile(
      join(spectraDir, "trace.json"),
      JSON.stringify(emptyTrace, null, 2)
    );

    // Write empty generate lock
    await writeFile(join(spectraDir, "generate.lock"), JSON.stringify({}, null, 2));

    // Write .gitignore for drift.json
    await writeFile(join(spectraDir, ".gitignore"), "drift.json\n");

    console.log(chalk.green("SPECTRA initialized successfully!"));
    console.log();
    console.log("Created:");
    console.log(`  ${chalk.cyan(".spectra/config.yaml")}          — Project configuration`);
    console.log(`  ${chalk.cyan(".spectra/constitution.yaml")}     — Constitutional constraints`);
    console.log(`  ${chalk.cyan(".spectra/features/_index.yaml")}  — Progressive disclosure index`);
    console.log(`  ${chalk.cyan(".spectra/trace.json")}            — Traceability matrix`);

    // Scaffold AI tool integration
    if (aiTool === "claude-code") {
      const scaffoldsRoot = await findScaffoldsDir();
      const scaffoldSrc = scaffoldsRoot ? join(scaffoldsRoot, "claude-code") : null;
      let targetDir: string;

      if (opts.global) {
        const home = homedir();
        if (!home) {
          console.log(chalk.red("Cannot determine home directory for --global installation."));
          return;
        }
        targetDir = join(home, ".claude");
      } else {
        targetDir = join(projectRoot, ".claude");
      }

      try {
        if (!scaffoldSrc) throw new Error("Scaffolds directory not found");
        await access(scaffoldSrc);
        const copied = await copyScaffolds(scaffoldSrc, targetDir);

        console.log();
        console.log(chalk.green(`Claude Code integration configured (${copied.length} files):`));
        console.log(`  ${chalk.cyan("skills/")}     — SDD workflow phases: /spectra-setup, /spectra-specify, /spectra-design, ...`);
        console.log(`  ${chalk.cyan("commands/")}   — Operational tools: /spectra-status, /spectra-validate, /spectra-lint, ...`);
        console.log(`  ${chalk.cyan("agents/")}     — Spec reviewer agent`);
        console.log(`  ${chalk.cyan("hooks/")}      — Enforcement + drift detection`);
        console.log(`  ${chalk.cyan("rules/")}      — Spec editing + code generation rules`);
        console.log(`  ${chalk.cyan("settings.json")} — Permissions + hook wiring`);

        const enforcementLevel = config.ai_tools.enforcement;
        console.log();
        console.log(`  Enforcement: ${chalk.bold(enforcementLevel)} (change in .spectra/config.yaml → ai_tools.enforcement)`);
      } catch {
        console.log();
        console.log(chalk.yellow("Claude Code scaffolds not found. Skipping AI tool setup."));
      }
    } else if (!aiTool) {
      console.log();
      console.log(chalk.dim("No AI tool detected. Use --claude to set up Claude Code integration."));
    }

    console.log();
    console.log(`Next: ${chalk.bold("spectra spec new <name>")} to create your first feature spec.`);
  });
