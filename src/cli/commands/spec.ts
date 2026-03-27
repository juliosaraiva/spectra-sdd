import { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";
import chalk from "chalk";
import { resolveSpectraPath } from "../../core/config.js";
import { contentHash } from "../../core/hash.js";
import { rebuildIndex } from "../../core/index-builder.js";
import type { FeatureSpec } from "../../core/spec-types.js";
import { serializeFeatureSpec } from "../../core/frontmatter.js";
import { readSpecFile } from "../../core/spec-reader.js";

function featureTemplate(name: string, idPrefix: string): FeatureSpec {
  const id = `${idPrefix}:${name}`;
  const now = new Date().toISOString();
  return {
    spectra: {
      version: "1.0",
      type: "feature",
      id,
      semver: "1.0.0",
      status: "draft",
      created: now,
      updated: now,
      authors: [`@${process.env.USER ?? "user"}`],
      reviewers: [],
    },
    identity: {
      title: name
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
      domain: ["general"],
      tags: [],
      summary: "TODO: Describe what this feature does for the user",
    },
    interfaces: {
      inputs: [],
      outputs: [],
      events_emitted: [],
      events_consumed: [],
    },
    acceptance_criteria: [
      {
        id: "AC-001",
        title: "TODO: First acceptance criterion",
        given: "TODO: initial context",
        when: "TODO: action occurs",
        then: ["TODO: expected outcome"],
        non_negotiable: true,
      },
    ],
    non_functional: {
      performance: [],
      security: [],
      observability: [],
      scalability: [],
    },
    dependencies: {
      feature_refs: [],
      schema_refs: [],
    },
  };
}

export const specCommand = new Command("spec").description("Manage feature specifications");

specCommand
  .command("new <name>")
  .description("Create a new feature spec")
  .option("--prefix <prefix>", "ID prefix", "feat")
  .action(async (name: string, opts) => {
    const projectRoot = process.cwd();
    const spec = featureTemplate(name, opts.prefix);
    const fileName = `${name}.spec.md`;
    const filePath = resolveSpectraPath(projectRoot, "features", fileName);

    await writeFile(filePath, serializeFeatureSpec(spec));
    await rebuildIndex(projectRoot);

    console.log(chalk.green(`Created feature spec: ${chalk.bold(spec.spectra.id)}`));
    console.log(`  File: ${chalk.cyan(`.spectra/features/${fileName}`)}`);
    console.log();
    console.log("Next steps:");
    console.log(`  1. Edit the spec: ${chalk.bold(`spectra spec edit ${spec.spectra.id}`)}`);
    console.log(`  2. Validate: ${chalk.bold(`spectra validate ${spec.spectra.id}`)}`);
    console.log(`  3. Lint: ${chalk.bold(`spectra lint ${spec.spectra.id}`)}`);
    console.log(
      `  4. Sign gate: ${chalk.bold(`spectra gate sign ${spec.spectra.id} --phase specify`)}`
    );
  });

specCommand
  .command("list")
  .description("List all feature specs")
  .action(async () => {
    const projectRoot = process.cwd();
    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");

    try {
      const raw = await readFile(indexPath, "utf8");
      const index = parse(raw);

      if (!index?.features?.length) {
        console.log(chalk.yellow("No feature specs found. Run: spectra spec new <name>"));
        return;
      }

      console.log(chalk.bold("\nFeature Specs:\n"));
      console.log(
        `${"ID".padEnd(30)} ${"Title".padEnd(25)} ${"Status".padEnd(10)} ${"Version".padEnd(10)} ACs`
      );
      console.log("─".repeat(85));

      for (const f of index.features) {
        const statusColor =
          f.status === "active"
            ? chalk.green
            : f.status === "draft"
              ? chalk.yellow
              : f.status === "deprecated"
                ? chalk.red
                : chalk.gray;
        console.log(
          `${f.id.padEnd(30)} ${f.title.substring(0, 24).padEnd(25)} ${statusColor(f.status.padEnd(10))} ${f.semver.padEnd(10)} ${f.ac_count}`
        );
      }
      console.log();
    } catch {
      console.log(chalk.yellow("No feature specs found. Run: spectra spec new <name>"));
    }
  });

specCommand
  .command("show <id>")
  .description("Display a feature spec")
  .action(async (id: string) => {
    const projectRoot = process.cwd();
    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");

    try {
      const indexRaw = await readFile(indexPath, "utf8");
      const index = parse(indexRaw);
      const entry = index?.features?.find((f: { id: string }) => f.id === id);

      if (!entry) {
        console.log(chalk.red(`Spec not found: ${id}`));
        return;
      }

      const specPath = resolveSpectraPath(projectRoot, "features", entry.file);
      const specRaw = await readFile(specPath, "utf8");
      console.log(specRaw);
    } catch (err) {
      console.log(chalk.red(`Error: ${err}`));
    }
  });

specCommand
  .command("rehash <id>")
  .description("Recompute content hash for a spec")
  .action(async (id: string) => {
    const projectRoot = process.cwd();
    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");

    try {
      const indexRaw = await readFile(indexPath, "utf8");
      const index = parse(indexRaw);
      const entry = index?.features?.find((f: { id: string }) => f.id === id);

      if (!entry) {
        console.log(chalk.red(`Spec not found: ${id}`));
        return;
      }

      const specPath = resolveSpectraPath(projectRoot, "features", entry.file);
      const { parsed } = await readSpecFile(specPath);
      const hash = contentHash(parsed);

      parsed.hash = {
        content_hash: hash,
        signed_at: new Date().toISOString(),
        signed_by: `@${process.env.USER ?? "user"}`,
      };

      // Write back in the original format
      if (specPath.endsWith(".spec.md")) {
        const { FeatureSpecSchema } = await import("../../core/spec-types.js");
        const specResult = FeatureSpecSchema.safeParse(parsed);
        if (specResult.success) {
          await writeFile(specPath, serializeFeatureSpec(specResult.data));
        } else {
          // Fallback: write as YAML
          const { stringify } = await import("yaml");
          await writeFile(specPath, stringify(parsed, { lineWidth: 120 }));
        }
      } else {
        const { stringify } = await import("yaml");
        await writeFile(specPath, stringify(parsed, { lineWidth: 120 }));
      }
      await rebuildIndex(projectRoot);

      console.log(chalk.green(`Hash updated: ${chalk.bold(hash)}`));
    } catch (err) {
      console.log(chalk.red(`Error: ${err}`));
    }
  });
