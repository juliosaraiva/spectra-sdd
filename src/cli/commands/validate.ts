import { Command } from "commander";
import chalk from "chalk";
import { validateSpec, validateAll, validateCrossRefs } from "../../core/validator.js";
import { resolveSpectraPath } from "../../core/config.js";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";

export const validateCommand = new Command("validate")
  .description("Validate spec files against their schemas")
  .argument("[spec-id]", "Spec ID to validate (omit for --all)")
  .option("--all", "Validate all specs")
  .option("--cross-refs", "Also check cross-references")
  .action(async (specId: string | undefined, opts) => {
    const projectRoot = process.cwd();

    if (specId && !opts.all) {
      // Find the spec file by ID
      const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");
      try {
        const indexRaw = await readFile(indexPath, "utf8");
        const index = parse(indexRaw);
        const entry = index?.features?.find(
          (f: { id: string }) => f.id === specId
        );

        if (!entry) {
          console.log(chalk.red(`Spec not found: ${specId}`));
          return;
        }

        const filePath = resolveSpectraPath(projectRoot, "features", entry.file);
        const result = await validateSpec(filePath);
        printResult(result);
      } catch (err) {
        console.log(chalk.red(`Error: ${err}`));
      }
    } else {
      // Validate all
      const results = await validateAll(projectRoot);
      let hasErrors = false;

      for (const result of results) {
        printResult(result);
        if (!result.valid) hasErrors = true;
      }

      if (opts.crossRefs) {
        const crossResults = await validateCrossRefs(projectRoot);
        for (const result of crossResults) {
          printResult(result);
          if (!result.valid) hasErrors = true;
        }
      }

      if (results.length === 0) {
        console.log(chalk.yellow("No specs found to validate."));
      } else if (!hasErrors) {
        console.log(chalk.green(`\nAll ${results.length} specs are valid.`));
      }
    }
  });

function printResult(result: { file: string; valid: boolean; errors: Array<{ path: string; message: string; severity: string }> }) {
  const shortFile = result.file.replace(process.cwd() + "/", "");
  if (result.valid) {
    console.log(`${chalk.green("PASS")} ${shortFile}`);
  } else {
    console.log(`${chalk.red("FAIL")} ${shortFile}`);
    for (const err of result.errors) {
      const icon = err.severity === "error" ? chalk.red("  ERROR") : chalk.yellow("  WARN ");
      console.log(`${icon} ${err.path ? `[${err.path}] ` : ""}${err.message}`);
    }
  }
}
