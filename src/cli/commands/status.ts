import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import chalk from "chalk";
import { resolveSpectraPath } from "../../core/config.js";
import { traceForward, computeCoverage } from "../../core/trace.js";
import { listGates } from "../../core/gate.js";
import { contentHash } from "../../core/hash.js";

export const statusCommand = new Command("status")
  .description("Show spec health status")
  .argument("[spec-id]", "Spec ID (omit for project overview)")
  .action(async (specId?: string) => {
    const projectRoot = process.cwd();

    if (specId) {
      await showSpecStatus(projectRoot, specId);
    } else {
      await showProjectStatus(projectRoot);
    }
  });

async function showSpecStatus(projectRoot: string, specId: string) {
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

    console.log(chalk.bold(`\nStatus: ${specId}\n`));
    console.log(`  Title:   ${entry.title}`);
    console.log(`  Version: ${entry.semver}`);
    console.log(`  Status:  ${entry.status}`);
    console.log(`  ACs:     ${entry.ac_count}`);
    console.log(`  Impls:   ${entry.impl_count}`);
    console.log(`  Tests:   ${entry.test_count}`);
    console.log(`  Hash:    ${entry.hash}`);

    // Gates
    const gates = await listGates(projectRoot, specId);
    if (gates.length > 0) {
      console.log(`\n  Gates:`);
      for (const g of gates) {
        const color =
          g.gate.status === "approved"
            ? chalk.green
            : g.gate.status === "expired"
              ? chalk.red
              : chalk.yellow;
        console.log(`    ${g.gate.phase.padEnd(15)} ${color(g.gate.status)}`);
      }
    }

    // Coverage
    const coverage = await computeCoverage(projectRoot, specId);
    if (coverage) {
      console.log(`\n  AC Coverage: ${coverage.coverage_percent}% (${coverage.covered_acs}/${coverage.total_acs})`);
    }

    console.log();
  } catch (err) {
    console.log(chalk.red(`Error: ${err}`));
  }
}

async function showProjectStatus(projectRoot: string) {
  const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");

  try {
    const indexRaw = await readFile(indexPath, "utf8");
    const index = parse(indexRaw);

    console.log(chalk.bold("\nSPECTRA Project Status\n"));

    const features = index?.features ?? [];
    const byStatus: Record<string, number> = {};
    for (const f of features) {
      byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
    }

    console.log(`  Total specs: ${features.length}`);
    for (const [status, count] of Object.entries(byStatus)) {
      console.log(`    ${status}: ${count}`);
    }

    const gates = await listGates(projectRoot);
    const approved = gates.filter((g) => g.gate.status === "approved").length;
    const pending = gates.filter((g) => g.gate.status === "pending").length;
    const expired = gates.filter((g) => g.gate.status === "expired").length;

    console.log(`\n  Gates: ${gates.length} total (${approved} approved, ${pending} pending, ${expired} expired)`);
    console.log();
  } catch {
    console.log(chalk.yellow("SPECTRA not initialized. Run: spectra init"));
  }
}
