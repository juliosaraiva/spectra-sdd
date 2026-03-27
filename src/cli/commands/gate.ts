import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import chalk from "chalk";
import {
  signGate,
  verifyGate,
  listGates,
  expireGatesForSpec,
  checkPhaseReady,
} from "../../core/gate.js";
import { resolveSpectraPath } from "../../core/config.js";
import { contentHash } from "../../core/hash.js";
import { updateGateInTrace } from "../../core/trace.js";
import type { Phase } from "../../core/spec-types.js";
import { readSpecFile } from "../../core/spec-reader.js";

export const gateCommand = new Command("gate").description("Manage human review gates");

gateCommand
  .command("sign <spec-id>")
  .description("Sign a gate approval for a spec phase")
  .requiredOption(
    "--phase <phase>",
    "Phase to sign (specify, design, test-design, implement, reconcile)"
  )
  .option("--signer <signer>", "Signer identity", `@${process.env.USER ?? "user"}`)
  .option("--comment <comment>", "Approval comment")
  .option("--force", "Bypass phase ordering check", false)
  .action(async (specId: string, opts) => {
    const projectRoot = process.cwd();

    // Load spec to get hash
    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");
    const indexRaw = await readFile(indexPath, "utf8");
    const index = parse(indexRaw);
    const entry = index?.features?.find((f: { id: string }) => f.id === specId);

    if (!entry) {
      console.log(chalk.red(`Spec not found: ${specId}`));
      return;
    }

    const specPath = resolveSpectraPath(projectRoot, "features", entry.file);
    const { parsed: specParsed } = await readSpecFile(specPath);
    const hash = contentHash(specParsed);

    // Enforce phase ordering (unless --force)
    if (!opts.force) {
      const existingGates = await listGates(projectRoot, specId);
      const signedPhases = existingGates
        .filter((g) => g.gate.status === "approved")
        .map((g) => g.gate.phase);
      const readiness = checkPhaseReady(opts.phase as Phase, signedPhases);
      if (!readiness.ready) {
        console.log(
          chalk.red(
            `Cannot sign ${opts.phase}: missing prerequisite gates: ${readiness.missing.join(", ")}`
          )
        );
        console.log(chalk.yellow("Use --force to bypass phase ordering."));
        return;
      }
    }

    const gate = await signGate(
      projectRoot,
      specId,
      entry.semver,
      hash,
      opts.phase as Phase,
      opts.signer,
      "cli",
      opts.comment
    );

    await updateGateInTrace(projectRoot, specId, opts.phase, "approved");

    console.log(
      chalk.green(`Gate signed for ${chalk.bold(specId)} phase ${chalk.bold(opts.phase)}`)
    );
    console.log(`  Signer: ${gate.approval?.approved_by}`);
    console.log(`  Hash:   ${hash}`);
    if (opts.comment) console.log(`  Comment: ${opts.comment}`);
  });

gateCommand
  .command("check <spec-id>")
  .description("Check if a spec is ready for a phase")
  .requiredOption("--phase <phase>", "Target phase to check readiness for")
  .action(async (specId: string, opts) => {
    const projectRoot = process.cwd();

    // Get signed phases
    const gates = await listGates(projectRoot, specId);
    const signedPhases = gates.filter((g) => g.gate.status === "approved").map((g) => g.gate.phase);

    const readiness = checkPhaseReady(opts.phase as Phase, signedPhases);

    if (readiness.ready) {
      console.log(chalk.green(`Ready for phase: ${opts.phase}`));
    } else {
      console.log(chalk.red(`Not ready for phase: ${opts.phase}`));
      console.log(`  Missing gates: ${readiness.missing.join(", ")}`);
    }
  });

gateCommand
  .command("list")
  .description("List all gates")
  .argument("[spec-id]", "Filter by spec ID")
  .action(async (specId?: string) => {
    const projectRoot = process.cwd();
    const gates = await listGates(projectRoot, specId);

    if (gates.length === 0) {
      console.log(chalk.yellow("No gates found."));
      return;
    }

    console.log(chalk.bold("\nGates:\n"));
    console.log(
      `${"Spec".padEnd(30)} ${"Phase".padEnd(15)} ${"Status".padEnd(12)} ${"Signer".padEnd(15)} Date`
    );
    console.log("─".repeat(90));

    for (const g of gates) {
      const statusColor =
        g.gate.status === "approved"
          ? chalk.green
          : g.gate.status === "expired"
            ? chalk.red
            : chalk.yellow;
      console.log(
        `${g.gate.spec_id.padEnd(30)} ${g.gate.phase.padEnd(15)} ${statusColor(g.gate.status.padEnd(12))} ${(g.approval?.approved_by ?? "-").padEnd(15)} ${g.approval?.approved_at?.substring(0, 10) ?? "-"}`
      );
    }
    console.log();
  });

gateCommand
  .command("expire <spec-id>")
  .description("Expire all gates for a spec (e.g., after spec changes)")
  .action(async (specId: string) => {
    const projectRoot = process.cwd();
    const count = await expireGatesForSpec(projectRoot, specId);
    console.log(chalk.yellow(`Expired ${count} gate(s) for ${specId}`));
  });

gateCommand
  .command("verify <spec-id>")
  .description("Verify a gate is valid against current spec hash")
  .requiredOption("--phase <phase>", "Phase to verify")
  .action(async (specId: string, opts) => {
    const projectRoot = process.cwd();

    const indexPath = resolveSpectraPath(projectRoot, "features", "_index.yaml");
    const indexRaw = await readFile(indexPath, "utf8");
    const index = parse(indexRaw);
    const entry = index?.features?.find((f: { id: string }) => f.id === specId);

    if (!entry) {
      console.log(chalk.red(`Spec not found: ${specId}`));
      return;
    }

    const specPath = resolveSpectraPath(projectRoot, "features", entry.file);
    const { parsed: specParsed } = await readSpecFile(specPath);
    const hash = contentHash(specParsed);

    const result = await verifyGate(projectRoot, specId, opts.phase as Phase, hash);

    if (result.valid) {
      console.log(chalk.green(`Gate is valid for ${specId} phase ${opts.phase}`));
    } else {
      console.log(chalk.red(`Gate is invalid: ${result.reason}`));
    }
  });
