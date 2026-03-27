import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import chalk from "chalk";
import { lintFeatureSpec, lintAll, type LintResult } from "../../core/linter.js";
import { resolveSpectraPath } from "../../core/config.js";
import { FeatureSpecSchema } from "../../core/spec-types.js";
import { loadConstitution } from "../../core/constitution.js";
import { readSpecFile } from "../../core/spec-reader.js";

export const lintCommand = new Command("lint")
  .description("Lint spec files for quality issues")
  .argument("[spec-id]", "Spec ID to lint (omit for --all)")
  .option("--all", "Lint all specs")
  .action(async (specId: string | undefined, opts) => {
    const projectRoot = process.cwd();

    if (specId && !opts.all) {
      // Find and lint specific spec
      const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");
      try {
        const indexRaw = await readFile(indexPath, "utf8");
        const index = parse(indexRaw);
        const entry = index?.features?.find((f: { id: string }) => f.id === specId);

        if (!entry) {
          console.log(chalk.red(`Spec not found: ${specId}`));
          return;
        }

        const filePath = resolveSpectraPath(projectRoot, "features", entry.file);
        const { parsed } = await readSpecFile(filePath);
        const specResult = FeatureSpecSchema.safeParse(parsed);

        if (!specResult.success) {
          console.log(chalk.red(`Spec is not valid. Run: spectra validate ${specId}`));
          return;
        }

        let vocabulary: string[] | undefined;
        try {
          const constitution = await loadConstitution(projectRoot);
          vocabulary = constitution.vocabulary;
        } catch {
          // no constitution
        }

        const results = lintFeatureSpec(specResult.data, filePath, vocabulary, parsed);
        printLintResults(results);
      } catch (err) {
        console.log(chalk.red(`Error: ${err}`));
      }
    } else {
      const results = await lintAll(projectRoot);
      printLintResults(results);
    }
  });

function printLintResults(results: LintResult[]) {
  if (results.length === 0) {
    console.log(chalk.green("No lint issues found."));
    return;
  }

  const errors = results.filter((r) => r.severity === "error");
  const warnings = results.filter((r) => r.severity === "warning");

  for (const r of results) {
    const icon = r.severity === "error" ? chalk.red("ERROR") : chalk.yellow("WARN ");
    const shortLoc = r.location.replace(process.cwd() + "/", "");
    console.log(`${icon} [${r.rule}] ${shortLoc}`);
    console.log(`       ${r.message}`);
  }

  console.log();
  console.log(`${errors.length} error(s), ${warnings.length} warning(s)`);
}
