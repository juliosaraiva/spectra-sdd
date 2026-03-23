import { Command } from "commander";
import chalk from "chalk";
import { generateDriftReport, type DriftReport } from "../../core/drift.js";
import { writeFile } from "node:fs/promises";
import { resolveSpectraPath } from "../../core/config.js";

export const diffCommand = new Command("diff")
  .description("Detect drift between specs and implementation")
  .option("--json", "Output as JSON")
  .option("--save", "Save drift report to .spectra/drift.json")
  .action(async (opts) => {
    const projectRoot = process.cwd();
    const report = await generateDriftReport(projectRoot);

    if (opts.save) {
      const driftPath = resolveSpectraPath(projectRoot, "drift.json");
      await writeFile(driftPath, JSON.stringify(report, null, 2));
    }

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    printDriftReport(report);
  });

function printDriftReport(report: DriftReport) {
  const scoreColor =
    report.project_drift_score === 0
      ? chalk.green
      : report.project_drift_score < 0.3
        ? chalk.yellow
        : chalk.red;

  console.log(chalk.bold("\nDrift Report\n"));
  console.log(
    `  Score: ${scoreColor(report.project_drift_score.toFixed(2))} (0 = clean, 1 = fully drifted)`
  );
  console.log(`  Total issues: ${report.items.length}`);
  console.log();

  if (report.items.length === 0) {
    console.log(chalk.green("  No drift detected."));
    console.log();
    return;
  }

  for (const [specId, feature] of Object.entries(report.features)) {
    const statusIcon = feature.status === "drifted" ? chalk.red("DRIFT") : chalk.green("CLEAN");
    console.log(`  ${statusIcon} ${specId} [${feature.drift_types.join(", ")}]`);

    for (const item of feature.items) {
      const severity = item.severity === "error" ? chalk.red("  ERROR") : chalk.yellow("  WARN ");
      const file = item.file ? ` (${item.file})` : "";
      console.log(`    ${severity} [${item.type}] ${item.message}${file}`);
    }
    console.log();
  }
}
