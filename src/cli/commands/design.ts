import { Command } from "commander";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import chalk from "chalk";
import { resolveSpectraPath } from "../../core/config.js";
import type { ImplSpec } from "../../core/spec-types.js";
import { serializeImplSpec } from "../../core/frontmatter.js";

const DEFAULT_CONCERNS = ["transport.rest", "persistence.relational", "auth.middleware"];

function implTemplate(featureId: string, concern: string, featureRef: string): ImplSpec {
  const now = new Date().toISOString();
  const implId = `impl:${featureId.replace(/^feat:/, "")}-${concern.replace(/\./g, "-")}`;
  return {
    spectra: {
      version: "1.0",
      type: "impl",
      id: implId,
      semver: "1.0.0",
      status: "draft",
      created: now,
      updated: now,
      authors: [`@${process.env.USER ?? "user"}`],
      reviewers: [],
      feature_ref: featureRef,
      concern,
    },
    design: {
      description: `TODO: Describe the ${concern} design for ${featureId}`,
    },
  };
}

export const designCommand = new Command("design")
  .description("Generate implementation spec scaffolds for a feature")
  .argument("<feat-id>", "Feature spec ID (e.g., feat:user-authentication)")
  .option("--concerns <concerns>", "Comma-separated concern namespaces", DEFAULT_CONCERNS.join(","))
  .action(async (featId: string, opts) => {
    const projectRoot = process.cwd();

    // Verify feature spec exists
    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");
    const indexRaw = await readFile(indexPath, "utf8");
    const index = parse(indexRaw);
    const entry = index?.features?.find((f: { id: string }) => f.id === featId);

    if (!entry) {
      console.log(chalk.red(`Feature spec not found: ${featId}`));
      return;
    }

    const featureRef = `${featId}@${entry.semver}`;
    const featureName = featId.replace(/^feat:/, "");
    const implDir = resolveSpectraPath(projectRoot, "impl", featureName);
    await mkdir(implDir, { recursive: true });

    const concerns = opts.concerns.split(",").map((c: string) => c.trim());

    for (const concern of concerns) {
      const impl = implTemplate(featId, concern, featureRef);
      const fileName = `${concern.replace(/\./g, "-")}.impl.md`;
      await writeFile(join(implDir, fileName), serializeImplSpec(impl));
      console.log(
        chalk.green(`  Created: ${chalk.cyan(`.spectra/impl/${featureName}/${fileName}`)}`)
      );
    }

    console.log();
    console.log(
      `Next: Edit the impl specs, then ${chalk.bold(`spectra gate sign ${featId} --phase design`)}`
    );
  });
