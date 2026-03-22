import { Command } from "commander";
import chalk from "chalk";

export const generateCommand = new Command("generate")
  .description("Generate artifacts from specs (requires AI adapter)");

generateCommand
  .command("tests <feat-id>")
  .description("Generate test spec from feature spec acceptance criteria")
  .action(async (featId: string) => {
    console.log(chalk.yellow("Generation engine requires an AI adapter."));
    console.log(`Configure one in .spectra/config.yaml or use ${chalk.bold("spectra generate tests --template-only")} to render the prompt template.`);
    console.log();
    console.log(chalk.blue("To generate test specs manually:"));
    console.log(`  1. Run: ${chalk.bold(`spectra context ${featId}`)}`);
    console.log(`  2. Copy the output to your AI assistant`);
    console.log(`  3. Save the result to .spectra/tests/${featId.replace(/^feat:/, "")}.test.yaml`);
  });

generateCommand
  .command("code <feat-id>")
  .description("Generate implementation code from impl specs")
  .action(async (featId: string) => {
    console.log(chalk.yellow("Generation engine requires an AI adapter."));
    console.log(`Configure one in .spectra/config.yaml`);
    console.log();
    console.log(chalk.blue("To generate code manually:"));
    console.log(`  1. Run: ${chalk.bold(`spectra context ${featId} --full`)}`);
    console.log(`  2. Copy the output to your AI assistant`);
    console.log(`  3. Save generated files and run: ${chalk.bold(`spectra trace update`)}`);
  });
