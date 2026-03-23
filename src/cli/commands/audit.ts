import { Command } from "commander";
import chalk from "chalk";

export const auditCommand = new Command("audit").description("Audit framework properties");

auditCommand
  .command("determinism <feat-id>")
  .description("Verify generation determinism by re-running and comparing hashes")
  .action(async (_featId: string) => {
    console.log(chalk.yellow("Determinism audit requires an AI adapter and a locked generation."));
    console.log("Configure an AI adapter in .spectra/config.yaml");
    console.log();
    console.log(chalk.blue("The audit will:"));
    console.log("  1. Read the generate.lock entry for this spec");
    console.log("  2. Re-run generation with the same template, input, and parameters");
    console.log("  3. Compare the output hash against the locked hash");
    console.log("  4. Report whether generation is deterministic");
  });
