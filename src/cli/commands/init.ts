import { Command } from "commander";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import chalk from "chalk";
import { SPECTRA_DIR, DEFAULT_CONFIG } from "../../core/config.js";
import { defaultConstitution, constitutionToYaml } from "../../core/constitution.js";

export const initCommand = new Command("init")
  .description("Initialize a SPECTRA project")
  .option("--brownfield", "Initialize for an existing codebase")
  .option("--project-id <id>", "Project identifier", "my-project")
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

    // Write config
    const config = {
      ...DEFAULT_CONFIG,
      spectra: { ...DEFAULT_CONFIG.spectra, project_id: opts.projectId },
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
    console.log();
    console.log(`Next: ${chalk.bold("spectra spec new <name>")} to create your first feature spec.`);
  });
